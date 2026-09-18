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

function taoPdf(): Buffer {
  const o = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);
  const dong: [number, [number, string][]][] = [
    [780, [[50, "MARINE SUPPLY CO., LTD"], [350, "DELIVERY NOTE"]]],
    [760, [[50, "Delivery Note No: DN-2026-0912"], [350, "Date: 12/09/2026"]]],
    [740, [[50, "Vessel: M. ODYSSEY"], [350, "Supplier: Marine Supply Co., Ltd"]]],
    [700, [[50, "No"], [80, "Description"], [300, "Part No"], [420, "Qty"], [470, "Unit"]]],
    [680, [[50, "1"], [80, "Piston ring set"], [300, "21001-1234"], [420, "2"], [470, "SET"]]],
    [660, [[50, "2"], [80, "Fuel injector nozzle"], [300, "DLF-155"], [420, "6"], [470, "PCS"]]],
    [640, [[50, "3"], [80, "Cotton rags"], [300, "190405"], [420, "25"], [470, "KG"]]],
    [600, [[50, "Total"], [420, "3 items"]]],
    [560, [[50, "Received by: C/E"], [350, "Signature"]]],
  ];
  let noiDung = "";
  for (const [y, o2] of dong) {
    for (const [x, chu] of o2) noiDung += `BT /F1 10 Tf ${x} ${y} Td (${o(chu)}) Tj ET\n`;
  }
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(noiDung)} >>\nstream\n${noiDung}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

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
