/**
 * PHIẾU GIAO / NHẬN SƠN → TỒN SƠN CỦA TÀU — phần thuần.
 *
 * Mọi nguồn đọc (MLS-11-05 qua lib/yeuCauNhap.ts, bảng sơn Excel / dán qua
 * lib/paintImport.ts, phiếu giao dạng chữ qua lib/phieuGiaoParse.ts, bộ đọc AI
 * chế độ "phieuGiao") quy về MỘT kiểu dòng `DongNhanSon`; ghép với DANH MỤC SƠN
 * (lib/yeuCauSon.ts ghepSon), người dùng soát ở trang /paint/<tàu>/nhan/<id>
 * rồi mới nhập vào tồn. Kiểm ở scripts/kiem-tra-phieu-son.ts.
 */
import type { DongAi } from "@/lib/docPhieuBangAi";
import type { DongPhieuGiao } from "@/lib/phieuGiaoParse";
import type { ImportedPaint } from "@/lib/paintImport";
import type { DongYeuCauFile } from "@/lib/yeuCauNhap";
import { ghepSon, type SonGhep } from "@/lib/yeuCauSon";
import { nhanDangTenSon } from "@/lib/tenSon";
import { chuanNgayYeuCau } from "@/lib/yeuCauNhap";

export const DUOI_PHIEU_SON = [".xlsx", ".xls", ".docx", ".doc", ".pdf"] as const;
export const TOI_DA_DONG_PHIEU_SON = 300;

export type DongNhanSon = {
  /** Mô tả như trên phiếu. */
  ten: string;
  hang: string | null;
  mau: string | null;
  maMau: string | null;
  /** Mã / Part No. / mã sơn ghi trên phiếu. */
  ma: string | null;
  dvt: string | null;
  /** Số lượng NHẬN (cộng vào tồn); null = phiếu để trống. */
  soLuong: number | null;
  /** Dung tích một lon / thùng (lít) nếu phiếu có. */
  dungTich: number | null;
  /** Hệ sơn đoán được (PRIMER, ANTI_FOULING…) — dùng khi tạo loại sơn mới. */
  loaiSon: string | null;
  /** Loại sơn trong danh mục (ghép tự động hoặc người dùng chọn); null = tạo loại mới khi nhập. */
  paintProductId: number | null;
  /** Bỏ qua (dòng rác / không nhập). */
  boQua: boolean;
  canhBao: string | null;
  ghiChu: string | null;
};

const sach = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const chuoiHoacNull = (s: unknown, toiDa = 200) => sach(s).slice(0, toiDa) || null;
const soHoacNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

const dongMoi = (ten: string, them: Partial<DongNhanSon> = {}): DongNhanSon => ({
  ten: ten.slice(0, 300),
  hang: null,
  mau: null,
  maMau: null,
  ma: null,
  dvt: null,
  soLuong: null,
  dungTich: null,
  loaiSon: null,
  paintProductId: null,
  boQua: false,
  canhBao: null,
  ghiChu: null,
  ...them,
});

/**
 * Phiếu theo mẫu MLS-11-05: số NHẬN lấy cột S.lượng duyệt (Q'ty App.) nếu có
 * ghi — phiếu giao kèm theo yêu cầu đã duyệt ghi số giao ở đó; không có thì
 * lấy S.lượng yêu cầu và nhắc người dùng đối chiếu.
 */
export function dongTuYeuCauFile(dong: DongYeuCauFile[]): DongNhanSon[] {
  return dong.slice(0, TOI_DA_DONG_PHIEU_SON).map((d) => {
    const coDuyet = d.duyet !== undefined && d.duyet !== null && d.duyet > 0;
    return dongMoi(d.moTa, {
      ma: d.partNo ?? d.impa ?? null,
      dvt: d.donVi,
      soLuong: coDuyet ? d.duyet! : d.soLuong,
      ghiChu: [d.phan, d.ghiChu].filter(Boolean).join("; ").slice(0, 300) || null,
      canhBao:
        d.canhBao ??
        (!coDuyet && d.soLuong !== null ? "Phiếu không ghi S.lượng duyệt — đang lấy S.lượng yêu cầu, đối chiếu số thực nhận" : null),
    });
  });
}

/** Bảng sơn (Excel / bảng dán / lớp chữ PDF có tiêu đề cột) — có sẵn hãng, màu, ĐVT, dung tích. */
export function dongTuBangSon(items: ImportedPaint[]): DongNhanSon[] {
  return items.slice(0, TOI_DA_DONG_PHIEU_SON).map((i) =>
    dongMoi(i.name, {
      hang: i.maker,
      mau: i.colorName,
      maMau: i.colorCode,
      dvt: i.uom,
      soLuong: i.quantity,
      dungTich: i.packSize,
      loaiSon: i.paintType,
      ghiChu: i.sheet ? `Sheet ${i.sheet}` : null,
    })
  );
}

/** Phiếu giao của nhà cung cấp đọc từ chữ (lớp chữ PDF / OCR). */
export function dongTuChuPhieuGiao(dong: DongPhieuGiao[]): DongNhanSon[] {
  return dong.slice(0, TOI_DA_DONG_PHIEU_SON).map((d) => dongMoi(d.ten, { ma: d.partNo ?? d.impa, dvt: d.donVi, soLuong: d.soLuong > 0 ? d.soLuong : null }));
}

/** Bộ đọc AI (chế độ phiếu giao) — PDF scan. */
export function dongTuAiSon(dong: DongAi[]): DongNhanSon[] {
  return dong.slice(0, TOI_DA_DONG_PHIEU_SON).map((d) =>
    dongMoi(d.ten, {
      ma: d.partNo ?? d.impa,
      dvt: d.donVi || null,
      soLuong: d.soLuongTrong || !(d.soLuong > 0) ? null : d.soLuong,
      canhBao: d.canhBao ? d.canhBao.slice(0, 300) : null,
    })
  );
}

const chuanKhoa = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Khóa một loại sơn theo tên chuẩn + màu + mã màu (lib/tenSon.ts) — "SON JOTAFIX PU TC RAL 3000 A 18L" ↔ "JOTAFIX PU TC COMP A" / RAL 3000. */
const khoaLoaiSon = (ten: string, mau: string | null | undefined, maMau: string | null | undefined) =>
  [ten, mau, maMau].map(chuanKhoa).join("|");

/**
 * Điền hãng / màu / mã màu / dung tích / hệ sơn nhận dạng từ mô tả trên phiếu
 * (lib/tenSon.ts) — chỉ ô còn trống; mô tả gốc giữ nguyên để soát với phiếu.
 */
export function boSungNhanDang(dong: DongNhanSon[]): DongNhanSon[] {
  return dong.map((d) => {
    const n = nhanDangTenSon(d.ten);
    return {
      ...d,
      hang: d.hang ?? n.hang,
      mau: d.mau ?? n.mau,
      maMau: d.maMau ?? n.maMau,
      dungTich: d.dungTich ?? n.dungTich,
      loaiSon: d.loaiSon ?? n.loaiSon,
    };
  });
}

/** Ghép mỗi dòng (chưa chọn loại sơn) với danh mục sơn — mô tả ghép kèm hãng / màu nếu phiếu tách cột. */
export function ghepDongSon(dong: DongNhanSon[], son: SonGhep[]): DongNhanSon[] {
  // Trước hết: đúng loại đã tạo từ lần nhập trước (tên chuẩn + màu + mã màu trùng hệt) —
  // cách ghép theo chữ bên dưới không thấy "COMP A" trong "… RAL 3000 A 18L".
  const theoKhoa = new Map(son.map((s) => [khoaLoaiSon(s.name, s.colorName, s.colorCode), s]));
  const daKhop = dong.map((d) => {
    if (d.paintProductId !== null) return d;
    const n = nhanDangTenSon(d.ten);
    const s = theoKhoa.get(khoaLoaiSon(n.ten, d.mau ?? n.mau, d.maMau ?? n.maMau));
    return s ? { ...d, paintProductId: s.id } : d;
  });
  const ghep = ghepSon(
    daKhop.map((d) => ({ moTa: [d.hang, d.ten, d.mau].filter(Boolean).join(" "), partNo: d.ma, impa: null })),
    son
  );
  return daKhop.map((d, i) => (d.paintProductId === null && ghep[i] ? { ...d, paintProductId: ghep[i]!.id } : d));
}

/** Đếm cho dòng tóm tắt: dòng sẽ nhập, khớp danh mục, loại sơn mới, thiếu số lượng, cảnh báo. */
export function demPhieuSon(dong: DongNhanSon[]) {
  const nhap = dong.filter((d) => !d.boQua);
  return {
    tong: dong.length,
    nhap: nhap.length,
    khop: nhap.filter((d) => d.paintProductId !== null).length,
    moi: nhap.filter((d) => d.paintProductId === null).length,
    thieuSo: nhap.filter((d) => !(d.soLuong !== null && d.soLuong > 0)).length,
    canhBao: nhap.filter((d) => d.canhBao).length,
  };
}

/** Đọc dòng từ cột JSON (bỏ phần tử hỏng). */
export function docDongNhanSon(v: unknown): DongNhanSon[] {
  if (!Array.isArray(v)) return [];
  const ra: DongNhanSon[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const d = x as Record<string, unknown>;
    const ten = chuoiHoacNull(d.ten, 300);
    if (!ten) continue;
    const id = Number(d.paintProductId);
    ra.push({
      ten,
      hang: chuoiHoacNull(d.hang, 120),
      mau: chuoiHoacNull(d.mau, 120),
      maMau: chuoiHoacNull(d.maMau, 60),
      ma: chuoiHoacNull(d.ma, 80),
      dvt: chuoiHoacNull(d.dvt, 20),
      soLuong: soHoacNull(d.soLuong),
      dungTich: soHoacNull(d.dungTich),
      loaiSon: chuoiHoacNull(d.loaiSon, 30),
      paintProductId: Number.isInteger(id) && id > 0 ? id : null,
      boQua: d.boQua === true,
      canhBao: chuoiHoacNull(d.canhBao, 300),
      ghiChu: chuoiHoacNull(d.ghiChu, 300),
    });
  }
  return ra.slice(0, TOI_DA_DONG_PHIEU_SON);
}

/**
 * Dòng người dùng sửa gửi lên (ô số là chuỗi gõ tay). Dòng có tên mà ô số sai /
 * âm → báo đúng số dòng (đánh từ 1) thay vì lặng lẽ bỏ. Dòng trống hẳn bỏ qua.
 */
export function sachDongNhanSon(raw: unknown): { ok: true; dong: DongNhanSon[] } | { ok: false; n: number } {
  if (!Array.isArray(raw)) return { ok: true, dong: [] };
  const so = (v: unknown): number | null | "sai" => {
    if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null;
    const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : "sai";
  };
  const dong: DongNhanSon[] = [];
  for (let i = 0; i < raw.length && i < TOI_DA_DONG_PHIEU_SON; i++) {
    const d = (raw[i] && typeof raw[i] === "object" ? raw[i] : {}) as Record<string, unknown>;
    const ten = chuoiHoacNull(d.ten, 300);
    const id = Number(d.paintProductId);
    const paintProductId = Number.isInteger(id) && id > 0 ? id : null;
    if (!ten && !paintProductId) continue;
    const soLuong = so(d.soLuong);
    const dungTich = so(d.dungTich);
    if (soLuong === "sai" || dungTich === "sai") return { ok: false, n: i + 1 };
    dong.push({
      ten: ten ?? "",
      hang: chuoiHoacNull(d.hang, 120),
      mau: chuoiHoacNull(d.mau, 120),
      maMau: chuoiHoacNull(d.maMau, 60),
      ma: chuoiHoacNull(d.ma, 80),
      dvt: chuoiHoacNull(d.dvt, 20),
      soLuong,
      dungTich,
      loaiSon: chuoiHoacNull(d.loaiSon, 30),
      paintProductId,
      boQua: d.boQua === true,
      canhBao: chuoiHoacNull(d.canhBao, 300),
      ghiChu: chuoiHoacNull(d.ghiChu, 300),
    });
  }
  return { ok: true, dong };
}

/** Lời nhắc gắn vào dòng đọc ra mà không có số lượng (đã tự bỏ tick). */
export const CANH_BAO_THIEU_SO = "Không đọc được số lượng — đã bỏ tick; điền số nếu đây là dòng sơn nhận (dòng tự tick lại)";

/**
 * Dòng đọc từ file mà KHÔNG có số lượng (tiêu đề nhóm, ô trống, chữ mờ…): bỏ tick
 * sẵn và nói rõ trên dòng — không để cả phiếu kẹt ở bước Nhập với lỗi "Dòng 1:
 * chưa có số lượng nhận". Điền số vào ô thì bảng soát tự tick lại dòng đó.
 */
export function boTickDongThieuSo(dong: DongNhanSon[]): DongNhanSon[] {
  return dong.map((d) =>
    d.boQua || (d.soLuong !== null && d.soLuong > 0)
      ? d
      : { ...d, boQua: true, canhBao: (d.canhBao ? `${d.canhBao}; ${CANH_BAO_THIEU_SO}` : CANH_BAO_THIEU_SO).slice(0, 300) }
  );
}

/** Kiểm trước khi NHẬP: mọi dòng nhập phải có số lượng > 0; dòng tạo loại mới phải có tên. Trả số dòng lỗi (đánh từ 1) hoặc null. */
export function dongLoiKhiNhap(dong: DongNhanSon[]): { n: number; lyDo: "thieuSo" | "thieuTen" } | null {
  for (let i = 0; i < dong.length; i++) {
    const d = dong[i];
    if (d.boQua) continue;
    if (!(d.soLuong !== null && d.soLuong > 0)) return { n: i + 1, lyDo: "thieuSo" };
    if (d.paintProductId === null && !d.ten.trim()) return { n: i + 1, lyDo: "thieuTen" };
  }
  return null;
}

/**
 * Gộp dòng nhập theo loại sơn trước khi ghi: phiếu thật hay có một loại ở nhiều
 * dòng (nhiều lô, nhiều mẻ). Dòng chưa có loại sơn gộp theo tên + hãng + màu
 * (chuẩn hóa) — cùng một loại mới chỉ tạo một lần.
 */
export function gopDongNhap(dong: DongNhanSon[]): { khoa: string; dau: DongNhanSon; soLuong: number; soDong: number }[] {
  const khop = (s: string | null) => (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const gop = new Map<string, { khoa: string; dau: DongNhanSon; soLuong: number; soDong: number }>();
  for (const d of dong) {
    if (d.boQua || !(d.soLuong !== null && d.soLuong > 0)) continue;
    const khoa = d.paintProductId !== null ? `id:${d.paintProductId}` : `moi:${khop(d.ten)}|${khop(d.hang)}|${khop(d.mau)}`;
    const cu = gop.get(khoa);
    if (cu) {
      cu.soLuong += d.soLuong;
      cu.soDong += 1;
    } else gop.set(khoa, { khoa, dau: d, soLuong: d.soLuong, soDong: 1 });
  }
  return [...gop.values()];
}

/** Ngày nhận yyyy-mm-dd từ ô đầu phiếu bất kỳ kiểu ("05/10/2026", "5-Oct-26"...). */
export const ngayNhanTuChu = chuanNgayYeuCau;
