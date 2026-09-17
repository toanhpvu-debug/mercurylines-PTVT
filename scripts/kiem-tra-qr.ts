/**
 * Kiểm bộ đọc mã từ nội dung QR (lib/qr.ts) — hàm thuần, không cần database.
 *
 * Chạy:  npx tsx scripts/kiem-tra-qr.ts
 *
 * Nhãn in ở văn phòng, quét trên tàu bằng bản cài khác; nhãn cũ in kiểu mã trần;
 * người gõ tay có khoảng trắng thừa; mã bị mã hóa URL... Mỗi biến thể là một
 * lần "quét mà không mở được gì" nếu bộ đọc không lường trước. Kỳ vọng viết
 * TAY, không suy từ hàm đang kiểm.
 */
import { docMaTuQr, duongDanQr, noiDungQr } from "@/lib/qr";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}: duoc ${JSON.stringify(thuc)}, mong ${JSON.stringify(mong)}`);
  }
}

// Đường đi thuận: in ở gốc nào, quét ở đâu cũng ra đúng mã.
kiemTra("duong dan trong app", duongDanQr("E-SPR-0001"), "/qr/E-SPR-0001");
kiemTra("noi dung QR, goc co dau / thua", noiDungQr("https://site.example/", "E-SPR-0001"), "https://site.example/qr/E-SPR-0001");
kiemTra("noi dung QR, goc noi bo tau", noiDungQr("http://192.168.1.10:3000", "C-IMPA-0014"), "http://192.168.1.10:3000/qr/C-IMPA-0014");
for (const goc of ["https://site.example", "http://192.168.1.10:3000", "http://localhost:3000"]) {
  kiemTra(`vong di-ve qua ${goc}`, docMaTuQr(noiDungQr(goc, "E-SPR-0001")), "E-SPR-0001");
}

// Các dạng nội dung quét được.
kiemTra("dia chi day du", docMaTuQr("https://site.example/qr/E-SPR-0001"), "E-SPR-0001");
kiemTra("dia chi kem ?query#hash", docMaTuQr("https://site.example/qr/E-SPR-0001?x=1#y"), "E-SPR-0001");
kiemTra("chi duong dan", docMaTuQr("/qr/E-SPR-0001"), "E-SPR-0001");
kiemTra("ma tran", docMaTuQr("E-SPR-0001"), "E-SPR-0001");
kiemTra("ma tran co khoang trang thua", docMaTuQr("  E-SPR-0001 \n"), "E-SPR-0001");
kiemTra("ma da ma hoa URL", docMaTuQr("https://site.example/qr/E%2DSPR%2D0001"), "E-SPR-0001");
kiemTra("ma co dau cham va gach duoi", docMaTuQr("/qr/AB_1.2-x"), "AB_1.2-x");
kiemTra("ma co ky tu unicode ma hoa hop le van bi tu choi", docMaTuQr("/qr/%C4%90-01"), null);
kiemTra("giu nguyen chu hoa/thuong (server so khong phan biet)", docMaTuQr("e-spr-0001"), "e-spr-0001");

// Phải từ chối.
kiemTra("rong", docMaTuQr(""), null);
kiemTra("chi khoang trang", docMaTuQr("   "), null);
kiemTra("dia chi la khong co /qr/", docMaTuQr("https://evil.example/login"), null);
kiemTra("chuoi co khoang trang giua", docMaTuQr("E-SPR 0001"), null);
kiemTra("bat dau bang dau gach", docMaTuQr("-abc"), null);
kiemTra("qua dai (65 ky tu)", docMaTuQr("A".repeat(65)), null);
kiemTra("dung 64 ky tu thi nhan", docMaTuQr("A".repeat(64)), "A".repeat(64));
kiemTra("ma hoa URL hong", docMaTuQr("/qr/%E0%A4%A"), null);
kiemTra("co ky tu < >", docMaTuQr("<script>"), null);
kiemTra("duong dan /qr/ rong", docMaTuQr("https://site.example/qr/"), null);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
