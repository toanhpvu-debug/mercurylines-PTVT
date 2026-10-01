import "server-only";

import ExcelJS from "exceljs";
import { tongDonMua } from "@/lib/donMuaQuyTrinh";

/**
 * File Excel PURCHASE ORDER theo form công ty — cùng nội dung bản in trên trang
 * đơn mua (/purchasing/[id]): đầu chứng từ (logo + công ty theo chuẩn biểu mẫu
 * của tàu), khối To / From, bảng hàng, các dòng tổng, điều khoản, ba ô ký
 * (Người lập · Lãnh đạo phòng Kỹ thuật – Vật tư duyệt · Nhà cung cấp xác nhận).
 * Gửi kèm thư cho nhà cung cấp, họ ký / đóng dấu xác nhận rồi gửi lại.
 */

export type DuLieuPoExcel = {
  poNo: string;
  ngay: string;
  daDuyet: boolean;
  tienTe: string;
  tieuDe: string | null;
  yRef: string | null;
  ghiChu: string | null;
  chietKhau: number;
  phiVanChuyen: number;
  phiGiaoHang: number;
  dong: { moTa: string; partNo: string | null; donVi: string; soLuong: number; donGia: number }[];
  ncc: { ten: string; diaChi: string | null; dienThoai: string | null; lienHe: string | null; email: string | null };
  tau: { ten: string; hullNo: string | null; imo: string | null };
  congTy: { ten: string; diaChi: string; vpDaiDien: string | null; lienLac: string | null };
  logo: { data: Buffer; ext: "png" | "jpeg" | "gif" } | null;
  nguoiLap: string | null;
  ngayLap: string | null;
  nguoiDuyet: string | null;
  ngayDuyet: string | null;
  nccXacNhan: string | null;
};

const NAVY = "FF0C2A5C";
const VIEN = { style: "thin" as const, color: { argb: "FF94A3B8" } };
const VIEN_DU = { top: VIEN, left: VIEN, bottom: VIEN, right: VIEN };
const SO = "#,##0.00";

export async function taoExcelDonMua(du: DuLieuPoExcel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = du.congTy.ten;
  const ws = wb.addWorksheet("PO", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 6 }, { width: 44 }, { width: 16 }, { width: 8 }, { width: 9 }, { width: 14 }, { width: 15 }, { width: 13 }];
  const gop = (o: string, gt: ExcelJS.CellValue, font: Partial<ExcelJS.Font> = {}, align: Partial<ExcelJS.Alignment> = {}) => {
    ws.mergeCells(o);
    const c = ws.getCell(o.split(":")[0]);
    c.value = gt;
    c.font = { name: "Arial", size: 10, ...font };
    c.alignment = { vertical: "middle", wrapText: true, ...align };
    return c;
  };

  // ── Đầu chứng từ ──
  if (du.logo) {
    const id = wb.addImage({ buffer: du.logo.data as unknown as ExcelJS.Buffer, extension: du.logo.ext });
    ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: 150, height: 52 } });
  }
  gop("C1:H1", du.congTy.ten, { bold: true, size: 13, color: { argb: NAVY } });
  gop("C2:H2", du.congTy.diaChi, { size: 9 });
  if (du.congTy.vpDaiDien) gop("C3:H3", du.congTy.vpDaiDien, { size: 9 });
  if (du.congTy.lienLac) gop("C4:H4", du.congTy.lienLac, { size: 9 });
  for (let c = 1; c <= 8; c++) ws.getCell(5, c).border = { bottom: { style: "medium", color: { argb: NAVY } } };
  ws.getRow(1).height = 22;

  gop("A7:H7", du.daDuyet ? "PURCHASE ORDER" : "PURCHASE ORDER — BẢN NHÁP, CHƯA DUYỆT (DRAFT — NOT APPROVED)", { bold: true, size: 15, color: { argb: du.daDuyet ? NAVY : "FFB91C1C" } }, { horizontal: "center" });
  ws.getRow(7).height = 26;

  // ── To / From ──
  const nhan = (o: string, s: string) => {
    const c = ws.getCell(o);
    c.value = s;
    c.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  };
  const giaTri = (o: string, s: string | null) => gop(o, s ?? "", { size: 10 });
  const to: [string, string | null][] = [
    ["To", du.ncc.ten],
    ["Add", du.ncc.diaChi],
    ["Tel/Fax", du.ncc.dienThoai],
    ["Attn", du.ncc.lienHe],
    ["Y/ref", du.yRef],
  ];
  const tu: [string, string | null][] = [
    ["From", du.congTy.ten],
    ["Our ref", du.poNo],
    ["Date", du.ngay],
    ["Subject", du.tieuDe || "Supply ship stores"],
    ["Vessel", `${du.tau.ten}${du.tau.hullNo ? ` / Hull No: ${du.tau.hullNo}` : ""}${du.tau.imo ? ` / IMO ${du.tau.imo}` : ""}`],
  ];
  for (let i = 0; i < 5; i++) {
    const r = 9 + i;
    nhan(`A${r}`, to[i][0]);
    giaTri(`B${r}:C${r}`, to[i][1]);
    nhan(`D${r}`, tu[i][0]);
    giaTri(`E${r}:H${r}`, tu[i][1]);
  }
  gop("A15:H15", `Dear ${du.ncc.lienHe || "Sirs"}, please arrange to supply the following items for MV ${du.tau.ten}${du.tau.hullNo ? ` / Hull No: ${du.tau.hullNo}` : ""}.`, { size: 10 });

  // ── Bảng hàng ──
  const dau = 17;
  const tieuDe = ["Item", "Description", "PN", "Unit", "Q'ty", `U.Price (${du.tienTe})`, `Amount (${du.tienTe})`, "Remark"];
  tieuDe.forEach((s, i) => {
    const c = ws.getCell(dau, i + 1);
    c.value = s;
    c.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = VIEN_DU;
  });
  ws.getRow(dau).height = 28;
  du.dong.forEach((d, i) => {
    const r = ws.getRow(dau + 1 + i);
    r.values = [i + 1, d.moTa, d.partNo ?? "", d.donVi, d.soLuong, d.donGia || null, { formula: `E${dau + 1 + i}*F${dau + 1 + i}`, result: d.soLuong * d.donGia }, ""];
    r.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = { name: "Arial", size: 9 };
      c.border = VIEN_DU;
      c.alignment = { vertical: "top", wrapText: true, horizontal: col === 2 ? "left" : col >= 6 ? "right" : "center" };
      if (col >= 6 && col <= 7) c.numFmt = SO;
    });
  });
  const cuoi = dau + du.dong.length;
  const tong = tongDonMua(du.dong.map((d) => ({ quantity: d.soLuong, unitPrice: d.donGia })), du.chietKhau, du.phiVanChuyen, du.phiGiaoHang);
  const dongTong: [string, number, boolean][] = [["Total", tong.cong, false]];
  if (du.chietKhau > 0) dongTong.push([`Special discount (${du.chietKhau}%)`, tong.giam, false], ["Total after discount", tong.sauGiam, false]);
  if (du.phiVanChuyen > 0) dongTong.push(["Transportation fee", du.phiVanChuyen, false]);
  if (du.phiGiaoHang > 0) dongTong.push(["Onboard delivery fee", du.phiGiaoHang, false]);
  dongTong.push([`TOTAL (${du.tienTe})`, tong.tong, true]);
  dongTong.forEach(([nhanTong, gt, dam], i) => {
    const r = cuoi + 1 + i;
    gop(`A${r}:F${r}`, nhanTong, { bold: dam, size: 9 }, { horizontal: "right" });
    const c = ws.getCell(`G${r}`);
    c.value = gt;
    c.numFmt = SO;
    c.font = { name: "Arial", size: 9, bold: dam };
    for (let col = 1; col <= 8; col++) ws.getCell(r, col).border = VIEN_DU;
    if (dam) for (let col = 1; col <= 8; col++) ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  });

  // ── Điều khoản ──
  let r = cuoi + dongTong.length + 2;
  const dieuKhoan = [
    "Terms and Condition",
    "* Quality: New 100%",
    "* Delivery term: onboard delivery",
    "* Packing: Standard as marine ship's spare shipment",
    "* Damage or incorrect parts can be refused or accepted for changing with good ones under your account.",
    "* Payment term: By TT after delivery with delivery note",
    "* Documents required: Signed Delivery Note, Final Invoice",
    ...(du.ghiChu ? [`* Note: ${du.ghiChu}`] : []),
  ];
  dieuKhoan.forEach((s, i) => gop(`A${r + i}:H${r + i}`, s, { size: 9, bold: i === 0, color: i === 0 ? { argb: NAVY } : undefined }));
  r += dieuKhoan.length + 1;

  // ── Ba ô ký ──
  const o = [
    { cot: "A", den: "B", tieu: "Prepared by / Người lập", ten: du.nguoiLap, ngay: du.ngayLap },
    { cot: "C", den: "E", tieu: "Approved by / Lãnh đạo phòng KT-VT", ten: du.nguoiDuyet, ngay: du.ngayDuyet },
    { cot: "F", den: "H", tieu: "Supplier confirmation / NCC xác nhận (sign & stamp)", ten: du.nccXacNhan, ngay: null },
  ];
  for (const k of o) {
    gop(`${k.cot}${r}:${k.den}${r}`, k.tieu, { bold: true, size: 9, color: { argb: NAVY } }, { horizontal: "center" });
    gop(`${k.cot}${r + 5}:${k.den}${r + 5}`, k.ten ?? "", { size: 9 }, { horizontal: "center" });
    gop(`${k.cot}${r + 6}:${k.den}${r + 6}`, k.ngay ? `Date: ${k.ngay}` : "Date: ............", { size: 8, color: { argb: "FF64748B" } }, { horizontal: "center" });
    const cotDau = k.cot.charCodeAt(0) - 64;
    const cotCuoi = k.den.charCodeAt(0) - 64;
    for (let col = cotDau; col <= cotCuoi; col++) ws.getCell(r + 5, col).border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
  }
  ws.pageSetup.printArea = `A1:H${r + 6}`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
