"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { LAM_BAO_CAO_THIET_YEU, coQuanLyThietYeu } from "@/lib/roles";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { fileExtension } from "@/lib/uploads";
import { laBanTau } from "@/lib/banCai";
import { cungTauTep, doiChieuThietYeu, gomNhom, laThieu, soTuToiThieu, thangHopLe, thangTuongLai, type KetQuaDocMLS1104, type MucThietYeuDoc } from "@/lib/thietYeu";
import { DUOI_TEP_THIET_YEU, docTepThietYeu } from "@/lib/thietYeuTep";
import { apDungNhapThietYeu, luuBangThietYeu, type CheDoNhapThietYeu, type DongHieuChinh } from "@/lib/thietYeuServer";

/*
 * PHỤ TÙNG THIẾT YẾU (MLS-11-04) — quản lý RIÊNG, tách khỏi danh mục vật tư
 * chung: nhập danh mục từ tệp Word / Excel của tàu (xem trước rồi mới nhập; nhập lại tệp
 * tháng sau là cập nhật số, giữ lịch sử), sửa / thêm / xóa mục, lưu số kiểm tra
 * hằng tháng. Người làm: Máy trưởng, Đại phó, Thuyền trưởng của đúng tàu, và
 * quản trị (coQuanLyThietYeu).
 */

export type KetQuaThietYeu = { message: string; success?: boolean };

const TOI_DA_MUC = 400;
const chuanKhop = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Gắn mục với mặt hàng có sẵn trong danh mục kho của tàu: Part No. trước, tên sau. */
async function timMatHangKhop(vesselId: number, muc: { partNo: string | null; moTa: string }[]): Promise<(number | null)[]> {
  const links = await prisma.vesselMaterial.findMany({
    where: { vesselId },
    select: { material: { select: { id: true, partNumber: true, nameVn: true, nameEn: true } } },
  });
  const theoPn = new Map<string, number>();
  const theoTen = new Map<string, number>();
  for (const { material: m } of links) {
    const pn = chuanKhop(m.partNumber);
    if (pn.length >= 3 && !theoPn.has(pn)) theoPn.set(pn, m.id);
    for (const ten of [m.nameVn, m.nameEn]) {
      const k = chuanKhop(ten);
      if (k.length >= 4 && !theoTen.has(k)) theoTen.set(k, m.id);
    }
  }
  return muc.map((x) => {
    const pn = chuanKhop(x.partNo);
    return (pn.length >= 3 && theoPn.get(pn)) || theoTen.get(chuanKhop(x.moTa)) || null;
  });
}

/** Kiểm quyền + đọc tệp gửi lên (dùng chung cho xem trước và nhập). */
async function docTepGuiLen(
  formData: FormData,
  t: Awaited<ReturnType<typeof layT>>["t"]
): Promise<{ loi: string } | { actor: NonNullable<Awaited<ReturnType<typeof requireActiveRole>>>; vesselId: number; tenTep: string; kq: KetQuaDocMLS1104 }> {
  const actor = await requireActiveRole([...LAM_BAO_CAO_THIET_YEU]);
  if (!actor) return { loi: t("chung.khongCoQuyen") };
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) return { loi: t("actions.vuiLongChonTau") };
  if (!coQuanLyThietYeu(actor, vesselId)) return { loi: t("chung.khongCoQuyen") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { loi: t("actions.nhap_vuiLongChonFile") };
  const duoi = fileExtension(file.name);
  if (!(DUOI_TEP_THIET_YEU as readonly string[]).includes(duoi)) return { loi: t("thietYeu.chiNhanTep") };
  if (file.size > 10 * 1024 * 1024) return { loi: t("actions.nhap_fileQua10MB") };
  const doc = await docTepThietYeu(duoi, Buffer.from(await file.arrayBuffer()));
  if (!doc.ok) return { loi: doc.loi === "duoi" ? t("thietYeu.chiNhanTep") : t("thietYeu.khongDocDuocTep") };
  if (!doc.kq.muc.length) return { loi: t("thietYeu.khongThayMuc") };
  return { actor, vesselId, tenTep: file.name, kq: { ...doc.kq, muc: doc.kq.muc.slice(0, TOI_DA_MUC) } };
}

export type MucXemTruoc = Pick<MucThietYeuDoc, "nhom" | "stt" | "moTa" | "partNo" | "toiThieu" | "tonDau" | "nhan" | "tieuThu" | "hienCo" | "viTri"> & {
  thieu: boolean;
  /** Trùng mục đã có trong danh mục của tàu (sẽ cập nhật, giữ lịch sử). */
  trung: boolean;
};

export type XemTruocThietYeu = {
  message: string;
  success?: boolean;
  tep?: {
    ten: string;
    tenTau: string | null;
    /** null = tệp không ghi tên tàu. */
    khopTau: boolean | null;
    tauDangChon: string;
    ngay: string | null;
    thang: string | null;
    nhom: { ten: string; soMuc: number; soThieu: number }[];
    muc: MucXemTruoc[];
    coSo: number;
    soThieu: number;
    boQua: number;
    soCoSan: number;
    soTrung: number;
    /** Mục đang có mà tệp không có (đồng bộ thì bị xóa). */
    soKhongTrongTep: number;
  };
};

/**
 * Bước 1 của nhập tệp: ĐỌC THỬ, không ghi gì — trả về các nhóm / mục đọc được, tên tàu và
 * ngày trên tệp, mục nào trùng danh mục đang có, để người nhập kiểm rồi mới bấm nhập.
 */
export async function xemTruocThietYeu(_prev: XemTruocThietYeu, formData: FormData): Promise<XemTruocThietYeu> {
  const { t } = await layT();
  const r = await docTepGuiLen(formData, t);
  if ("loi" in r) return { message: r.loi };
  const [tau, coSan] = await Promise.all([
    prisma.vessel.findUnique({ where: { id: r.vesselId }, select: { name: true, code: true } }),
    prisma.phuTungThietYeu.findMany({ where: { vesselId: r.vesselId }, select: { id: true, nhom: true, stt: true, moTa: true, partNo: true } }),
  ]);
  if (!tau) return { message: t("actions.tau_khongTonTai") };
  const { khop, khongTrongTep } = doiChieuThietYeu(r.kq.muc, coSan);
  const muc = r.kq.muc.map((m, i) => ({
    nhom: m.nhom,
    stt: m.stt,
    moTa: m.moTa,
    partNo: m.partNo,
    toiThieu: m.toiThieu,
    tonDau: m.tonDau,
    nhan: m.nhan,
    tieuThu: m.tieuThu,
    hienCo: m.hienCo,
    viTri: m.viTri,
    thieu: laThieu(m),
    trung: khop[i] !== null,
  }));
  return {
    message: "",
    success: true,
    tep: {
      ten: r.tenTep,
      tenTau: r.kq.tenTau,
      khopTau: cungTauTep(r.kq.tenTau, tau),
      tauDangChon: tau.name,
      ngay: r.kq.ngay,
      thang: r.kq.thang,
      nhom: gomNhom(muc).map((g) => ({ ten: g.nhom, soMuc: g.dong.length, soThieu: g.dong.filter((d) => d.thieu).length })),
      muc,
      coSo: muc.filter((m) => [m.tonDau, m.nhan, m.tieuThu, m.hienCo].some((v) => v !== null)).length,
      soThieu: muc.filter((m) => m.thieu).length,
      boQua: r.kq.boQua,
      soCoSan: coSan.length,
      soTrung: khop.filter((k) => k !== null).length,
      soKhongTrongTep: khongTrongTep.length,
    },
  };
}

/**
 * Bước 2: NHẬP tệp vào danh mục phụ tùng thiết yếu của tàu (lib/thietYeuServer.ts
 * apDungNhapThietYeu). Đọc lại tệp ở máy chủ — không tin số trình duyệt gửi. `thang` = tháng
 * của số trong tệp (mặc định theo ô Ngày của tệp), `cheDo` khi tàu đã có danh mục: cập nhật
 * (giữ mục không có trong tệp) hoặc đồng bộ (xóa mục không còn trong tệp).
 */
export async function nhapThietYeuTuTep(_prev: KetQuaThietYeu, formData: FormData): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const r = await docTepGuiLen(formData, t);
  if ("loi" in r) return { message: r.loi };
  const thangRaw = String(formData.get("thang") ?? "");
  const thang = thangHopLe(thangRaw);
  if (thang !== thangRaw || thangTuongLai(thang)) return { message: t("thietYeu.thangSai") };
  const cheDo: CheDoNhapThietYeu = String(formData.get("cheDo")) === "dongBo" ? "dongBo" : "capNhat";
  const muc = r.kq.muc;
  const ganKho = await timMatHangKhop(r.vesselId, muc);
  const kq = await prisma.$transaction(
    (tx) => apDungNhapThietYeu(tx, { vesselId: r.vesselId, muc, ganKho, cheDo, thang, nguoi: r.actor.name }),
    { timeout: 60_000, maxWait: 10_000 }
  );
  const soNhom = new Set(muc.map((m) => m.nhom)).size;
  const soGan = ganKho.filter(Boolean).length;
  await ghiNhatKyNguoiDung(r.actor, {
    action: "thiet-yeu-nhap",
    path: "/materials/thiet-yeu",
    vesselId: r.vesselId,
    detail: `Nhập MLS-11-04 "${r.tenTep}" (${cheDo === "dongBo" ? "đồng bộ" : "cập nhật"}, số tháng ${thang}): ${muc.length} mục, ${soNhom} nhóm — ${kq.taoMoi} mới, ${kq.capNhat} cập nhật, ${kq.xoa} xóa, ${kq.soThang} mục có số tháng, ${soGan} gắn mặt hàng kho`,
  });
  revalidatePath("/materials/thiet-yeu");
  revalidatePath("/dashboard");
  // Mở đúng tháng của số trong tệp, báo kết quả ở đầu trang (?daNhap=n.nhom.moi.capNhat.xoa.
  // soThang.gan). Chuyển trang ở máy chủ: lần nhập đầu tiên làm trang đổi hẳn (từ "chưa có
  // danh mục" sang bảng) nên form gọi action đã biến mất trước khi kịp tự chuyển.
  redirect(`/materials/thiet-yeu?vessel=${r.vesselId}&thang=${thang}&daNhap=${[muc.length, soNhom, kq.taoMoi, kq.capNhat, kq.xoa, kq.soThang, soGan].join(".")}`);
}

export type DongLuuThang = {
  id: number;
  /** Nhóm như in trên mẫu ("A. Phụ tùng cho Máy chính …") — đổi tên nhóm / chuyển nhóm. */
  nhom: string;
  stt: string;
  moTa: string;
  partNo: string;
  toiThieu: string;
  tonDau: string;
  nhan: string;
  tieuThu: string;
  hienCo: string;
  viTri: string;
};

const soHoacNull = (s: string) => {
  const t = String(s ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : NaN;
};

/**
 * Lưu bảng HIỆU CHỈNH DANH MỤC & SỐ LƯỢNG (lib/thietYeuServer.ts luuBangThietYeu): danh mục —
 * nhóm (đổi tên / chuyển nhóm), số thứ tự, thứ tự dòng như trên bảng, mô tả, số phụ tùng, tối
 * thiểu, vị trí — và số kiểm tra của tháng (chốt báo cáo tháng). `chiDanhMuc`: chỉ lưu danh mục,
 * không chốt số tháng. Số hiện có của tháng mới nhất đã lưu thành hienCo của mục — Dashboard và
 * tháng sau dựa vào đó.
 */
export async function luuThangThietYeu(
  vesselIdRaw: number,
  thangRaw: string,
  dong: DongLuuThang[],
  tuyChon?: { chiDanhMuc?: boolean }
): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAM_BAO_CAO_THIET_YEU]);
  const vesselId = Number(vesselIdRaw);
  if (!actor || !Number.isInteger(vesselId) || !coQuanLyThietYeu(actor, vesselId)) return { message: t("chung.khongCoQuyen") };
  const thang = thangHopLe(thangRaw);
  if (thang !== thangRaw) return { message: t("chung.duLieuKhongHopLe") };
  const chiDanhMuc = tuyChon?.chiDanhMuc === true;
  const ds = Array.isArray(dong) ? dong.slice(0, TOI_DA_MUC) : [];
  const muc = await prisma.phuTungThietYeu.findMany({ where: { vesselId, id: { in: ds.map((d) => Number(d.id)).filter(Number.isInteger) } }, select: { id: true } });
  const hopLe = new Set(muc.map((m) => m.id));
  const chu = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const sach: DongHieuChinh[] = [];
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i];
    if (!hopLe.has(Number(d.id))) continue;
    const so = [soHoacNull(d.tonDau), soHoacNull(d.nhan), soHoacNull(d.tieuThu), soHoacNull(d.hienCo)].map((x) => (chiDanhMuc && Number.isNaN(x) ? null : x));
    // Chỉ lưu danh mục thì số tháng không ghi — ô số gõ dở không chặn việc lưu.
    if (!chiDanhMuc && so.some((x) => Number.isNaN(x))) return { message: t("thietYeu.soSai", { n: i + 1 }) };
    const moTa = chu(d.moTa, 300);
    if (moTa.length < 2) return { message: t("thietYeu.thieuMoTa", { n: i + 1 }) };
    // Bản trình duyệt cũ (trước khi có cột nhóm / số thứ tự) không gửi hai ô này → giữ nguyên.
    const nhom = d.nhom === undefined ? undefined : chu(d.nhom, 200);
    if (nhom === "") return { message: t("thietYeu.thieuNhom", { n: i + 1 }) };
    sach.push({
      id: Number(d.id),
      nhom,
      stt: d.stt === undefined ? undefined : chu(d.stt, 12) || null,
      moTa,
      partNo: chu(d.partNo, 80) || null,
      toiThieu: chu(d.toiThieu, 60) || null,
      tonDau: so[0],
      nhan: so[1],
      tieuThu: so[2],
      hienCo: so[3],
      viTri: chu(d.viTri, 120) || null,
    });
  }
  const kq = await prisma.$transaction((tx) => luuBangThietYeu(tx, { vesselId, thang, dong: sach, chiDanhMuc, nguoi: actor.name }), {
    timeout: 60_000,
    maxWait: 10_000,
  });
  const chiTiet = [
    `${kq.doiDanhMuc} mục sửa danh mục${kq.doiNhom ? ` (${kq.doiNhom} đổi nhóm)` : ""}`,
    kq.doiThuTu ? "đổi thứ tự dòng" : "",
  ]
    .filter(Boolean)
    .join(", ");
  await ghiNhatKyNguoiDung(actor, {
    action: chiDanhMuc ? "thiet-yeu-sua-danh-muc" : "thiet-yeu-luu-thang",
    path: "/materials/thiet-yeu",
    vesselId,
    detail: chiDanhMuc
      ? `Hiệu chỉnh danh mục phụ tùng thiết yếu (không chốt số tháng): ${chiTiet}`
      : `Lưu báo cáo phụ tùng thiết yếu tháng ${thang}: ${kq.soThang} mục; ${chiTiet}`,
  });
  revalidatePath("/materials/thiet-yeu");
  revalidatePath("/dashboard");
  return {
    message: chiDanhMuc
      ? t("thietYeu.daLuuDanhMuc", { n: kq.doiDanhMuc, thuTu: kq.doiThuTu ? t("thietYeu.daLuuDanhMucThuTu") : "" })
      : t("thietYeu.daLuuThang", { n: kq.soThang, thang }),
    success: true,
  };
}

/** Thêm một mục vào danh mục thiết yếu của tàu (nhóm có sẵn hoặc nhóm mới). */
export async function themPhuTungThietYeu(
  vesselIdRaw: number,
  x: { nhom: string; moTa: string; partNo: string; toiThieu: string }
): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAM_BAO_CAO_THIET_YEU]);
  const vesselId = Number(vesselIdRaw);
  if (!actor || !Number.isInteger(vesselId) || !coQuanLyThietYeu(actor, vesselId)) return { message: t("chung.khongCoQuyen") };
  const nhom = String(x?.nhom ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const moTa = String(x?.moTa ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!nhom || moTa.length < 2) return { message: t("thietYeu.canNhomVaMoTa") };
  const toiThieu = String(x?.toiThieu ?? "").trim().slice(0, 60) || null;
  const partNo = String(x?.partNo ?? "").trim().slice(0, 80) || null;
  const cungNhom = await prisma.phuTungThietYeu.findMany({ where: { vesselId, nhom }, orderBy: { thuTu: "desc" }, select: { thuTu: true, stt: true } });
  const cuoi = await prisma.phuTungThietYeu.aggregate({ where: { vesselId }, _max: { thuTu: true } });
  // Đặt ngay sau mục cuối của nhóm (hoặc cuối danh mục nếu nhóm mới), dời các mục sau xuống.
  const thuTu = cungNhom.length ? cungNhom[0].thuTu + 1 : (cuoi._max.thuTu ?? 0) + 1;
  const sttMoi = String(Math.max(0, ...cungNhom.map((c) => Number(c.stt) || 0)) + 1);
  const [khop] = await timMatHangKhop(vesselId, [{ partNo, moTa }]);
  await prisma.$transaction([
    prisma.phuTungThietYeu.updateMany({ where: { vesselId, thuTu: { gte: thuTu } }, data: { thuTu: { increment: 1 } } }),
    prisma.phuTungThietYeu.create({
      data: { vesselId, nhom, thuTu, stt: sttMoi, moTa, partNo, toiThieu, toiThieuSo: soTuToiThieu(toiThieu), materialId: khop },
    }),
  ]);
  await ghiNhatKyNguoiDung(actor, { action: "thiet-yeu-them", path: "/materials/thiet-yeu", vesselId, detail: `Thêm phụ tùng thiết yếu "${moTa}" vào nhóm "${nhom}"` });
  revalidatePath("/materials/thiet-yeu");
  return { message: t("thietYeu.daThem", { moTa }), success: true };
}

/** Xóa một mục khỏi danh mục thiết yếu (mặt hàng kho gắn kèm, nếu có, vẫn giữ). */
export async function xoaPhuTungThietYeu(idRaw: number): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAM_BAO_CAO_THIET_YEU]);
  const muc = actor ? await prisma.phuTungThietYeu.findUnique({ where: { id: Number(idRaw) || -1 }, select: { id: true, vesselId: true, moTa: true, nhom: true } }) : null;
  if (!actor || !muc || !coQuanLyThietYeu(actor, muc.vesselId)) return { message: t("chung.khongCoQuyen") };
  await prisma.phuTungThietYeu.delete({ where: { id: muc.id } });
  await ghiNhatKyNguoiDung(actor, { action: "thiet-yeu-xoa", path: "/materials/thiet-yeu", vesselId: muc.vesselId, detail: `Xóa phụ tùng thiết yếu "${muc.moTa}" (${muc.nhom})` });
  revalidatePath("/materials/thiet-yeu");
  revalidatePath("/dashboard");
  return { message: t("thietYeu.daXoa", { moTa: muc.moTa }), success: true };
}

/**
 * Gỡ TOÀN BỘ danh mục phụ tùng thiết yếu (tệp MLS-11-04 đã nhập) của một tàu,
 * kèm mọi số tháng đã lưu (xóa theo khóa ngoại). Mặt hàng kho đã gắn vẫn giữ.
 * Như các chức năng gỡ / xóa khác: chỉ quản trị ở bản cài văn phòng.
 */
export async function goDanhMucThietYeu(vesselIdRaw: number): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) return { message: t("chung.khongCoQuyen") };
  if (await laBanTau()) return { message: t("thietYeu.goChiVanPhong") };
  const vessel = await prisma.vessel.findUnique({ where: { id: Number(vesselIdRaw) || -1 }, select: { id: true, code: true, name: true } });
  if (!vessel) return { message: t("actions.tau_khongTonTai") };
  const [soMuc, soThang] = await Promise.all([
    prisma.phuTungThietYeu.count({ where: { vesselId: vessel.id } }),
    prisma.phuTungThietYeuThang.count({ where: { item: { vesselId: vessel.id } } }),
  ]);
  if (!soMuc) return { message: t("thietYeu.chuaCoDanhMuc") };
  await prisma.phuTungThietYeu.deleteMany({ where: { vesselId: vessel.id } });
  await ghiNhatKyNguoiDung(admin, {
    action: "thiet-yeu-go-danh-muc",
    path: "/materials/thiet-yeu",
    vesselId: vessel.id,
    detail: `Gỡ danh mục phụ tùng thiết yếu MLS-11-04 của tàu ${vessel.code}: ${soMuc} mục, ${soThang} bản ghi số tháng`,
  });
  revalidatePath("/materials/thiet-yeu");
  revalidatePath("/dashboard");
  return { message: t("thietYeu.daGoDanhMuc", { tau: vessel.name, n: soMuc, thang: soThang }), success: true };
}
