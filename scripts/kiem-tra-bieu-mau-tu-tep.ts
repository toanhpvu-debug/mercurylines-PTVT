/**
 * Kiểm bộ đọc đầu chứng từ từ file Word / Excel gốc (lib/bieuMauTuTep.ts):
 * nhận dạng trường từ dòng chữ, lấy chữ + logo từ .docx / .xlsx tự dựng, và
 * chạy thử trên các file mẫu thật có trên máy (chỉ in kết quả).
 *
 * Dữ liệu mẫu là thông tin GIẢ — repo công khai, không đưa thông tin liên hệ
 * thật của công ty vào mã nguồn (xem lib/formStandards.ts).
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-bieu-mau-tu-tep.ts
 */
import os from "node:os";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { phanTichDauChungTu, trichBieuMauTuTep } from "@/lib/bieuMauTuTep";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

console.log("\n=== 1) Nhan dang truong tu dong chu ===");
const mau1 = phanTichDauChungTu([
  "CÔNG TY TNHH VẬN TẢI BIỂN THỬ NGHIỆM",
  "SAMPLE SHIPPING COMPANY LIMITED",
  "Head office: 12 Sample Street, Ward 1, District 3, Ho Chi Minh City, Vietnam",
  "Rep Add: 99 Example Road, Thu Duc City, HCMC, VN",
  "Tel: (0084) 028 0000 1111 · Fax: (0084) 028 0000 2222 · tech@sample-shipping.example · http://www.sample-shipping.example",
]);
kiemTra("ten cong ty tieng Anh in hoa", mau1.companyName, "SAMPLE SHIPPING COMPANY LIMITED");
kiemTra("dia chi tru so giu nhan", mau1.address, "Head office: 12 Sample Street, Ward 1, District 3, Ho Chi Minh City, Vietnam");
kiemTra("VP dai dien", mau1.repAddress, "Rep Add: 99 Example Road, Thu Duc City, HCMC, VN");
kiemTra("dien thoai bo phan Fax", mau1.tel, "(0084) 028 0000 1111");
kiemTra("email", mau1.email, "tech@sample-shipping.example");
kiemTra("website", mau1.website, "http://www.sample-shipping.example");
const mau2 = phanTichDauChungTu(["EXAMPLE ALLIANCE JOINT STOCK COMPANY", "No.1, Test Street, An Khanh Ward, Ho Chi Minh City, Vietnam", "Phone: +84.900000000", "Email: ops@example-alliance.example"]);
kiemTra("JSC + dia chi khong nhan", [mau2.companyName, mau2.address, mau2.tel, mau2.email, mau2.website], [
  "EXAMPLE ALLIANCE JOINT STOCK COMPANY",
  "No.1, Test Street, An Khanh Ward, Ho Chi Minh City, Vietnam",
  "+84.900000000",
  "ops@example-alliance.example",
  "",
]);
const mau3 = phanTichDauChungTu(["Công ty Cổ phần Thử", "Địa chỉ: 5 Đường Mẫu, Phường 2, Quận 1, TP. Hồ Chí Minh", "Điện thoại: 028 1234 5678"]);
kiemTra("chi co ten tieng Viet", [mau3.companyName, mau3.address, mau3.tel], ["Công ty Cổ phần Thử", "Địa chỉ: 5 Đường Mẫu, Phường 2, Quận 1, TP. Hồ Chí Minh", "028 1234 5678"]);
kiemTra("khong co gi -> trong", phanTichDauChungTu(["PURCHASE ORDER", "No: 123"]), { companyName: "", address: "", repAddress: "", tel: "", email: "", website: "" });

async function docxTuDung() {
  console.log("\n=== 2) .docx tu dung (header + logo) ===");
  const p = (s: string) => `<w:p><w:r><w:t xml:space="preserve">${s}</w:t></w:r></w:p>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document><w:body>${p("PURCHASE ORDER")}<w:sectPr/></w:body></w:document>`);
  zip.file(
    "word/header1.xml",
    `<?xml version="1.0"?><w:hdr>${p("SAMPLE SHIPPING COMPANY LIMITED")}<w:p><w:r><w:t>Head office:</w:t></w:r><w:r><w:tab/><w:t>12 Sample Street, District 3, Ho Chi Minh City</w:t></w:r></w:p>${p("Tel: 028 0000 1111 &amp; Email: a@b.example")}</w:hdr>`
  );
  zip.file("word/_rels/header1.xml.rels", '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="image" Target="media/image1.png"/></Relationships>');
  zip.file("word/media/image1.png", PNG_1x1);
  const kq = await trichBieuMauTuTep(await zip.generateAsync({ type: "nodebuffer" }), "PO mau.docx");
  kiemTra("docx: doc duoc", kq.ok, true);
  if (!kq.ok) return;
  kiemTra("docx: truong", [kq.truong.companyName, kq.truong.address, kq.truong.tel, kq.truong.email], [
    "SAMPLE SHIPPING COMPANY LIMITED",
    "Head office: 12 Sample Street, District 3, Ho Chi Minh City",
    "028 0000 1111",
    "a@b.example",
  ]);
  kiemTra("docx: logo tu header", [kq.logo?.mime, kq.logo?.data.length], ["image/png", PNG_1x1.length]);
}

async function xlsxTuDung() {
  console.log("\n=== 3) .xlsx tu dung (o dau trang + logo) ===");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PO");
  ws.getCell("C1").value = "EXAMPLE ALLIANCE JOINT STOCK COMPANY";
  ws.getCell("C2").value = "Head office: No.1, Test Street, Ho Chi Minh City";
  ws.getCell("C3").value = "Tel: +84.900000000 - Email: ops@example-alliance.example";
  ws.getCell("A6").value = "PURCHASE ORDER";
  const id = wb.addImage({ buffer: PNG_1x1 as unknown as ExcelJS.Buffer, extension: "png" });
  ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 40 } });
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const kq = await trichBieuMauTuTep(buf, "PO mau.xlsx");
  kiemTra("xlsx: doc duoc", kq.ok, true);
  if (!kq.ok) return;
  kiemTra("xlsx: truong", [kq.truong.companyName, kq.truong.address, kq.truong.tel, kq.truong.email], [
    "EXAMPLE ALLIANCE JOINT STOCK COMPANY",
    "Head office: No.1, Test Street, Ho Chi Minh City",
    "+84.900000000",
    "ops@example-alliance.example",
  ]);
  kiemTra("xlsx: logo tu ban ve", kq.logo?.mime, "image/png");
  kiemTra("sai dinh dang -> loi", (await trichBieuMauTuTep(Buffer.from("x"), "a.pdf")).ok, false);
}

async function tepThat() {
  console.log("\n=== 4) File mau that tren may (chi in) ===");
  const ds = [
    "templates/MLS-11-13.docx",
    "templates/MLS-11-04.docx",
    path.join(os.homedir(), "Desktop", "MLS-11-06 Store & Spare Part Inventory 11.4.2017.xlsx"),
    path.join(os.homedir(), "Desktop", "MLS-11-13 BAO CAO DUNG CU CHANG BUOC (NEW)  11.4.2017.doc"),
  ].filter((f) => existsSync(f));
  for (const f of ds) {
    const kq = await trichBieuMauTuTep(readFileSync(f), f);
    if (!kq.ok) {
      console.log(`  ${path.basename(f)}: LOI ${kq.loi}`);
      truot++;
      continue;
    }
    console.log(`  ${path.basename(f)}: cong ty="${kq.truong.companyName}" · logo=${kq.logo ? `${kq.logo.mime} ${kq.logo.data.length}B` : "khong"} · ${kq.dongChu.length} dong${kq.canhBao.length ? ` · canh bao: ${kq.canhBao.join(" | ").slice(0, 80)}` : ""}`);
    kiemTra(`${path.basename(f)}: nhan ra ten cong ty`, kq.truong.companyName.length > 5, true);
    if (f.endsWith(".docx")) kiemTra(`${path.basename(f)}: lay duoc logo`, Boolean(kq.logo), true);
  }
}

(async () => {
  try {
    await docxTuDung();
    await xlsxTuDung();
    await tepThat();
  } catch (e) {
    truot++;
    console.error(e);
  }
  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
})();
