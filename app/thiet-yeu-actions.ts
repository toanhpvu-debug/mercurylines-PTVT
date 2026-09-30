"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { LAM_BAO_CAO_THIET_YEU, coQuanLyThietYeu } from "@/lib/roles";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { fileExtension } from "@/lib/uploads";
import { laBanTau } from "@/lib/banCai";
import { docHangMLS1104, soTuToiThieu, tachHang, thangHopLe } from "@/lib/thietYeu";

/*
 * PHỤ TÙNG THIẾT YẾU (MLS-11-04) — quản lý RIÊNG, tách khỏi danh mục vật tư
 * chung: nhập danh mục từ tệp Word mẫu, sửa / thêm / xóa mục, lưu số kiểm tra
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

/**
 * Nhập danh mục phụ tùng thiết yếu từ tệp Word MLS-11-04 (.doc / .docx).
 * cheDo "thay": xóa danh mục cũ của tàu rồi nạp mới (số tháng đã lưu của mục cũ
 * mất theo); "them": thêm vào cuối. Số "Hiện có" trong tệp (nếu có) thành số
 * hiện có ban đầu của mục.
 */
export async function nhapThietYeuTuWord(_prev: KetQuaThietYeu, formData: FormData): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAM_BAO_CAO_THIET_YEU]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) return { message: t("actions.vuiLongChonTau") };
  if (!coQuanLyThietYeu(actor, vesselId)) return { message: t("chung.khongCoQuyen") };
  const cheDo = String(formData.get("cheDo") || "thay") === "them" ? "them" : "thay";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  if (![".doc", ".docx"].includes(fileExtension(file.name))) return { message: t("thietYeu.chiNhanWord") };
  if (file.size > 10 * 1024 * 1024) return { message: t("actions.nhap_fileQua10MB") };

  let body: string;
  try {
    const { default: WordExtractor } = await import("word-extractor");
    body = (await new WordExtractor().extract(Buffer.from(await file.arrayBuffer()))).getBody();
  } catch {
    return { message: t("thietYeu.khongDocDuocWord") };
  }
  const doc = docHangMLS1104(tachHang(body));
  if (!doc.muc.length) return { message: t("thietYeu.khongThayMuc") };
  const muc = doc.muc.slice(0, TOI_DA_MUC);
  const khop = await timMatHangKhop(vesselId, muc);

  const daCo = cheDo === "them" ? await prisma.phuTungThietYeu.aggregate({ where: { vesselId }, _max: { thuTu: true } }) : null;
  const thuTuDau = (daCo?._max.thuTu ?? 0) + 1;
  const thang = thangHopLe(null);
  await prisma.$transaction(async (tx) => {
    if (cheDo === "thay") await tx.phuTungThietYeu.deleteMany({ where: { vesselId } });
    for (let i = 0; i < muc.length; i++) {
      const m = muc[i];
      const moi = await tx.phuTungThietYeu.create({
        data: {
          vesselId,
          nhom: m.nhom.slice(0, 200),
          thuTu: thuTuDau + i,
          stt: m.stt,
          moTa: m.moTa,
          partNo: m.partNo?.slice(0, 80) ?? null,
          toiThieu: m.toiThieu?.slice(0, 60) ?? null,
          toiThieuSo: m.toiThieuSo,
          viTri: m.viTri?.slice(0, 120) ?? null,
          hienCo: m.hienCo,
          materialId: khop[i],
        },
        select: { id: true },
      });
      // Tệp đã điền số tháng: giữ lại làm số của tháng hiện tại.
      if ([m.tonDau, m.nhan, m.tieuThu, m.hienCo].some((x) => x !== null)) {
        await tx.phuTungThietYeuThang.create({
          data: { itemId: moi.id, thang, tonDau: m.tonDau, nhan: m.nhan, tieuThu: m.tieuThu, hienCo: m.hienCo, viTri: m.viTri, nguoiLuu: actor.name },
        });
      }
    }
  });
  const soGan = khop.filter(Boolean).length;
  await ghiNhatKyNguoiDung(actor, {
    action: "thiet-yeu-nhap",
    path: "/materials/thiet-yeu",
    vesselId,
    detail: `Nhập MLS-11-04 "${file.name}" (${cheDo === "thay" ? "thay danh mục" : "thêm vào"}): ${muc.length} mục, ${new Set(muc.map((m) => m.nhom)).size} nhóm, ${soGan} gắn mặt hàng kho`,
  });
  revalidatePath("/materials/thiet-yeu");
  revalidatePath("/dashboard");
  return {
    message: t("thietYeu.daNhap", { n: muc.length, nhom: new Set(muc.map((m) => m.nhom)).size, gan: soGan }),
    success: true,
  };
}

export type DongLuuThang = {
  id: number;
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
 * Lưu số kiểm tra tháng (và các chỉnh sửa mô tả / số phụ tùng / tối thiểu / vị
 * trí) của cả bảng. Số hiện có của tháng mới nhất đã lưu thành hienCo của mục —
 * Dashboard và tháng sau dựa vào đó.
 */
export async function luuThangThietYeu(vesselIdRaw: number, thangRaw: string, dong: DongLuuThang[]): Promise<KetQuaThietYeu> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAM_BAO_CAO_THIET_YEU]);
  const vesselId = Number(vesselIdRaw);
  if (!actor || !Number.isInteger(vesselId) || !coQuanLyThietYeu(actor, vesselId)) return { message: t("chung.khongCoQuyen") };
  const thang = thangHopLe(thangRaw);
  if (thang !== thangRaw) return { message: t("chung.duLieuKhongHopLe") };
  const ds = Array.isArray(dong) ? dong.slice(0, TOI_DA_MUC) : [];
  const muc = await prisma.phuTungThietYeu.findMany({ where: { vesselId, id: { in: ds.map((d) => Number(d.id)) } }, select: { id: true } });
  const hopLe = new Set(muc.map((m) => m.id));
  const sach: { id: number; moTa: string; partNo: string | null; toiThieu: string | null; tonDau: number | null; nhan: number | null; tieuThu: number | null; hienCo: number | null; viTri: string | null }[] = [];
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i];
    if (!hopLe.has(Number(d.id))) continue;
    const so = [soHoacNull(d.tonDau), soHoacNull(d.nhan), soHoacNull(d.tieuThu), soHoacNull(d.hienCo)];
    if (so.some((x) => Number.isNaN(x))) return { message: t("thietYeu.soSai", { n: i + 1 }) };
    const moTa = String(d.moTa ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (moTa.length < 2) return { message: t("thietYeu.thieuMoTa", { n: i + 1 }) };
    sach.push({
      id: Number(d.id),
      moTa,
      partNo: String(d.partNo ?? "").trim().slice(0, 80) || null,
      toiThieu: String(d.toiThieu ?? "").trim().slice(0, 60) || null,
      tonDau: so[0],
      nhan: so[1],
      tieuThu: so[2],
      hienCo: so[3],
      viTri: String(d.viTri ?? "").trim().slice(0, 120) || null,
    });
  }
  // Tháng này có phải tháng mới nhất đã / đang lưu không — chỉ khi đó mới đè hienCo của mục.
  const moiNhat = await prisma.phuTungThietYeuThang.findFirst({
    where: { item: { vesselId }, thang: { gt: thang } },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const d of sach) {
      await tx.phuTungThietYeu.update({
        where: { id: d.id },
        data: {
          moTa: d.moTa,
          partNo: d.partNo,
          toiThieu: d.toiThieu,
          toiThieuSo: soTuToiThieu(d.toiThieu),
          viTri: d.viTri,
          ...(moiNhat ? {} : { hienCo: d.hienCo }),
        },
      });
      await tx.phuTungThietYeuThang.upsert({
        where: { itemId_thang: { itemId: d.id, thang } },
        update: { tonDau: d.tonDau, nhan: d.nhan, tieuThu: d.tieuThu, hienCo: d.hienCo, viTri: d.viTri, nguoiLuu: actor.name },
        create: { itemId: d.id, thang, tonDau: d.tonDau, nhan: d.nhan, tieuThu: d.tieuThu, hienCo: d.hienCo, viTri: d.viTri, nguoiLuu: actor.name },
      });
    }
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "thiet-yeu-luu-thang",
    path: "/materials/thiet-yeu",
    vesselId,
    detail: `Lưu báo cáo phụ tùng thiết yếu tháng ${thang}: ${sach.length} mục`,
  });
  revalidatePath("/materials/thiet-yeu");
  revalidatePath("/dashboard");
  return { message: t("thietYeu.daLuuThang", { n: sach.length, thang }), success: true };
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
