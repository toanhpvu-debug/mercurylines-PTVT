/**
 * Kiểm chứng trọn đường đọc PDF phiếu giao hàng: tự dựng một PDF có lớp chữ
 * (bảng 5 cột, đặt từng ô theo tọa độ như phần mềm nhà cung cấp xuất ra), cho
 * pdfjs dựng lại dòng (lib/pdfChu.ts) rồi bộ tách (lib/phieuGiaoParse.ts) đọc
 * dòng hàng. Khác scripts/kiem-tra-doc-phieu-giao.ts (chỉ kiểm bộ tách trên
 * chuỗi): ở đây pdfjs thật sự chạy, nên bắt được cả lỗi nạp thư viện trong Node.
 *
 * Chạy:  npx tsx scripts/kiem-tra-pdf-giao.ts
 * Ghi PDF mẫu ra _thu-xuat/phieu-giao-mau.pdf (thư mục không vào git) để mở xem.
 */
import { mkdirSync, writeFileSync } from "fs";
import { docChuTuPdf } from "@/lib/pdfChu";
import { docPhieuGiaoTuChu } from "@/lib/phieuGiaoParse";
import { taoPdfMauPhieuGiao as taoPdf } from "@/lib/pdfMauPhieuGiao";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}

async function main() {
  const pdf = taoPdf();
  try {
    mkdirSync("_thu-xuat", { recursive: true });
    writeFileSync("_thu-xuat/phieu-giao-mau.pdf", pdf);
  } catch {
    /* không ghi được file mẫu cũng không sao */
  }
  const kq = await docChuTuPdf(pdf);
  kiemTra("pdfjs doc duoc", kq.ok, true);
  if (!kq.ok) {
    console.log("  loi:", kq.loi);
    console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
    process.exit(1);
  }
  const dongChu = kq.text.split("\n").filter((d) => !d.startsWith("--- trang"));
  kiemTra("so dong dung lai", dongChu.length, 9);
  kiemTra("dong bang co cot", dongChu[4], "1 | Piston ring set | 21001-1234 | 2 | SET");
  kiemTra("dong impa co nhan", dongChu[6], "3 | Cotton rags | IMPA 190405 | 25 | KG");
  const doc = docPhieuGiaoTuChu(kq.text);
  kiemTra("so dong hang", doc.dong.length, 3);
  kiemTra(
    "dong hang",
    doc.dong.map((d) => [d.ten, d.partNo, d.impa, d.soLuong, d.donVi, d.loai]),
    [
      ["Piston ring set", "21001-1234", null, 2, "SET", "SPARE"],
      ["Fuel injector nozzle", "DLF-155", null, 6, "PCS", "SPARE"],
      ["Cotton rags", null, "190405", 25, "KG", "STORE"],
    ]
  );
  kiemTra("so phieu", doc.soPhieu, "DN-2026-0912");
  kiemTra("ngay", doc.ngayGiao, "12/09/2026");
  kiemTra("nha cung cap", doc.nhaCungCap, "Marine Supply Co., Ltd");
  // Bản scan (không lớp chữ): PDF chỉ có ảnh → phải báo ok:false chứ không ném lỗi.
  const scan = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
    "latin1"
  );
  const kqScan = await docChuTuPdf(scan);
  kiemTra("pdf khong lop chu -> ok:false", kqScan.ok, false);
  const rac = await docChuTuPdf(Buffer.from("khong phai pdf"));
  kiemTra("file rac -> ok:false", rac.ok, false);
  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
}
main();
