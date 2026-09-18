/**
 * Kiểm bộ tách dòng hàng từ chữ của phiếu giao hàng (lib/phieuGiaoParse.ts).
 *
 * Chạy:  npx tsx scripts/kiem-tra-doc-phieu-giao.ts
 *
 * Mẫu là những dạng phiếu thật hay gặp: bảng có cột ngăn bằng " | " (từ lớp chữ
 * PDF), dòng OCR rời rạc, tiếng Anh lẫn tiếng Việt, đơn vị viết đủ kiểu. Kỳ vọng
 * viết TAY. Không đụng database.
 */
import { docPhieuGiaoTuChu } from "@/lib/phieuGiaoParse";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
const tomTat = (r: ReturnType<typeof docPhieuGiaoTuChu>) =>
  r.dong.map((d) => ({ ten: d.ten, partNo: d.partNo, impa: d.impa, sl: d.soLuong, dv: d.donVi, loai: d.loai, tb: d.thietBi }));

// 1) Phiếu giao PDF số, bảng có cột.
const p1 = docPhieuGiaoTuChu(`--- trang 1 ---
MARINE SUPPLY CO., LTD | DELIVERY NOTE
Delivery Note No: DN-2026-0912 | Date: 12/09/2026
Vessel: M. ODYSSEY | Supplier: Marine Supply Co., Ltd
No | Description | Part No | Qty | Unit
1 | Piston ring set | 21001-1234 | 2 | SET
2 | Fuel injector nozzle | DLF-155 | 6 | PCS
3 | Cotton rags | 190405 | 25 | KG
Total | 3 items
Received by: C/E | Signature`);
kiemTra("p1 so dong", p1.dong.length, 3);
kiemTra("p1 dong", tomTat(p1), [
  { ten: "Piston ring set", partNo: "21001-1234", impa: null, sl: 2, dv: "SET", loai: "SPARE", tb: null },
  { ten: "Fuel injector nozzle", partNo: "DLF-155", impa: null, sl: 6, dv: "PCS", loai: "SPARE", tb: null },
  { ten: "Cotton rags", partNo: null, impa: "190405", sl: 25, dv: "KG", loai: "STORE", tb: null },
]);
kiemTra("p1 so phieu", p1.soPhieu, "DN-2026-0912");
kiemTra("p1 ngay", p1.ngayGiao, "12/09/2026");
kiemTra("p1 ncc", p1.nhaCungCap, "Marine Supply Co., Ltd");

// 2) Bản OCR: không có dấu cột, có tiêu đề thiết bị, đơn vị tiếng Việt, số thập phân kiểu Việt.
const p2 = docPhieuGiaoTuChu(`PHIEU GIAO HANG So phieu: PG-0077 Ngay: 05/09/2026
Nha cung cap: Cong ty TNHH Hai Long
MAIN ENGINE
1. Bac truc  P/N 11-2233  4 cai
2. Gioang nap xi lanh  PN: GK-771  2 bo
A/E No.2
3. Loc dau  10,5 kg
Tong cong: 3 muc
Nguoi nhan: Thuyen truong`);
kiemTra("p2 so dong", p2.dong.length, 3);
kiemTra("p2 dong", tomTat(p2), [
  { ten: "Bac truc", partNo: "11-2233", impa: null, sl: 4, dv: "PCS", loai: "SPARE", tb: "MAIN ENGINE" },
  { ten: "Gioang nap xi lanh", partNo: "GK-771", impa: null, sl: 2, dv: "SET", loai: "SPARE", tb: "MAIN ENGINE" },
  { ten: "Loc dau", partNo: null, impa: null, sl: 10.5, dv: "KG", loai: "SPARE", tb: "A/E No.2" },
]);
kiemTra("p2 so phieu", p2.soPhieu, "PG-0077");
kiemTra("p2 ncc", p2.nhaCungCap, "Cong ty TNHH Hai Long");

// 3) Dòng số lượng viết ngược "Qty: 3 pcs", mã đứng trước tên, đơn vị "ea".
const p3 = docPhieuGiaoTuChu(`EN3200A Thermostat 85C Qty: 3 pcs
IMPA 550102 Grease gun 1 ea
Page 1 of 1`);
kiemTra("p3 dong", tomTat(p3), [
  { ten: "Thermostat 85C", partNo: "EN3200A", impa: null, sl: 3, dv: "PCS", loai: "SPARE", tb: null },
  { ten: "Grease gun", partNo: null, impa: "550102", sl: 1, dv: "PCS", loai: "STORE", tb: null },
]);
kiemTra("p3 bo qua (Page)", p3.boQua, 1);

// 4) Chuỗi rỗng và chuỗi không có hàng.
kiemTra("rong", docPhieuGiaoTuChu("").dong.length, 0);
kiemTra("chi co chu ky", docPhieuGiaoTuChu("Received by: Master\nSignature").dong.length, 0);

// 5) Số lượng 6 chữ số không bị nhầm thành IMPA khi đã gắn đơn vị.
const p5 = docPhieuGiaoTuChu(`1 | Welding rod 3.2mm | 100000 | PCS`);
kiemTra("p5 sl lon", tomTat(p5)[0]?.sl, 100000);
kiemTra("p5 khong nham impa", tomTat(p5)[0]?.impa, null);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
