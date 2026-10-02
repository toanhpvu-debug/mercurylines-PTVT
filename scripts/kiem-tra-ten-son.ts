/**
 * Kiểm NHẬN DẠNG TÊN SƠN (lib/tenSon.ts) trên đúng các dòng phiếu giao sơn thật
 * người dùng đã nhập (chữ hoa không dấu, xuất từ phần mềm kế toán), các dòng của
 * mẫu MLS-11-05 Paint, và vài tên có dấu / chữ thường.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-ten-son.ts
 */
import { nhanDangTenSon } from "@/lib/tenSon";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
const gon = (s: string) => {
  const n = nhanDangTenSon(s);
  return [n.ten, n.hang, n.loaiSon, n.maMau, n.mau, n.thanhPhan, n.dungTich];
};

// ── Phiếu giao sơn thật (ảnh người dùng gửi 2026-10-02) ──
const PHIEU: [string, unknown[]][] = [
  ["CHAT DONG RAN JOTAFIX PU TC, COMP B 2L", ["JOTAFIX PU TC COMP B (ĐÓNG RẮN)", "Jotun", "TOPCOAT", null, null, "B", 2]],
  ["DUNG MOI JOTUN THINNER NO. 10 20L", ["JOTUN THINNER NO.10", "Jotun", "OTHER", null, null, null, 20]],
  ["DUNG MOI JOTUN THINNER NO. 17 20L", ["JOTUN THINNER NO.17", "Jotun", "OTHER", null, null, null, 20]],
  ["JOTAFIX PU TC BLACK A 18L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", null, "BLACK", "A", 18]],
  ["JOTAFIX PU TC RAL 3000 A 18L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "RAL 3000", null, "A", 18]],
  ["JOTAFIX PU TC STD038 GREY A18L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "STD 038", "GREY", "A", 18]],
  ["SON JOTAFIX EPOXY PRIMER GRE A 15L", ["JOTAFIX EPOXY PRIMER COMP A", "Jotun", "PRIMER", null, "GREY", "A", 15]],
  ["SON JOTAFIX EPOXY PRIMER RED A 15L", ["JOTAFIX EPOXY PRIMER COMP A", "Jotun", "PRIMER", null, "RED", "A", 15]],
  ["SON JOTAFIX EPOXY PRIMER, CPB 3L", ["JOTAFIX EPOXY PRIMER COMP B", "Jotun", "PRIMER", null, null, "B", 3]],
  ["SON JOTAFIX PU TC RAL 5002 A 17.91L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "RAL 5002", null, "A", 17.91]],
  ["SON JOTAFIX PU TC RAL 5012 A 17. 1L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "RAL 5012", null, "A", 17.1]],
  ["SON JOTAFIX PU TC STD257 GRN A 18L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "STD 257", "GREEN", "A", 18]],
  ["SON JOTAFIX PU TC STD2880 A 18L", ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "STD 2880", null, "A", 18]],
];
for (const [vao, mong] of PHIEU) kiemTra(`phieu: ${vao}`, gon(vao), mong);

// ── Dòng của mẫu MLS-11-05 Paint (Desktop) ──
kiemTra("mau: hartop white", gon("JOTUN HARTOP PAL 9003A WHITE"), ["JOTUN HARTOP PAL 9003A", "Jotun", "TOPCOAT", null, "WHITE", null, null]);
kiemTra("mau: hartopx std green", gon("JOTUN HARTOPX STD 2571C GREEN"), ["JOTUN HARTOPX", "Jotun", "TOPCOAT", "STD 2571C", "GREEN", null, null]);
kiemTra("mau: hartopx black A", gon("JOTUN HARTOPX  BLACK A"), ["JOTUN HARTOPX COMP A", "Jotun", "TOPCOAT", null, "BLACK", "A", null]);
// Màu không đứng cuối (sau còn mã số) → không tách, giữ nguyên tên.
kiemTra("mau: pilot yellow 1023", gon("PILOT II BASE 5 YELLOW 1023"), ["PILOT II BASE 5 YELLOW 1023", "Jotun", "TOPCOAT", null, null, null, null]);
kiemTra("mau: thinner no17", gon("JOTUN THINNER NO17"), ["JOTUN THINNER NO17", "Jotun", "OTHER", null, null, null, null]);

// ── Có dấu / chữ thường / không nhận ra hãng ──
kiemTra("co dau: son chong ri", gon("Sơn chống rỉ"), ["Sơn chống rỉ", null, "ANTI_CORROSIVE", null, null, null, null]);
kiemTra("chu thuong: hempadur grey", gon("Hempadur 45143 Grey"), ["Hempadur 45143", "Hempel", "ANTI_CORROSIVE", null, "Grey", null, null]);
kiemTra("chu thuong: light grey", gon("Hardtop XP Light Grey 20 ltr"), ["Hardtop XP", "Jotun", "TOPCOAT", null, "Light grey", null, 20]);
kiemTra("co dau: chat dong ran", gon("Chất đóng rắn Interthane 990, Comp B 2,5L"), ["Interthane 990 Comp B (đóng rắn)", "International", "TOPCOAT", null, null, "B", 2.5]);
kiemTra("mau viet", gon("Bình sơn xịt đỏ"), ["Bình sơn xịt", null, null, null, "Đỏ", null, null]);
kiemTra("khong nhan ra gi", gon("Cọ lăn sơn 9 inch"), ["Cọ lăn sơn 9 inch", null, null, null, null, null, null]);
kiemTra("rong", gon("  "), ["", null, null, null, null, null, null]);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
if (truot) process.exit(1);
