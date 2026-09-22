/**
 * Kiểm phần điền tệp Word mẫu MLS-11-13 (lib/bieuMauChangBuoc.ts).
 *
 * Chạy:  npx tsx scripts/kiem-tra-bieu-mau-chang-buoc.ts
 *
 * Phần 1 chạy trên XML giả có cùng cấu trúc mẫu (luôn chạy). Phần 2 chạy trên
 * tệp mẫu thật templates/MLS-11-13.docx nếu có (tài liệu nội bộ, không vào git)
 * và ghi bản điền thử ra _thu-xuat/MLS-11-13-thu.docx để mở xem bằng Word.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import JSZip from "jszip";
import { chuCua, datChuO, dienBieuMauChangBuoc, dienDocumentXml, type DongChangBuoc } from "@/lib/bieuMauChangBuoc";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
const dem = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const canBang = (xml: string) => ({
  tc: dem(xml, /<w:tc>/g) === dem(xml, /<\/w:tc>/g),
  tr: dem(xml, /<w:tr\b/g) === dem(xml, /<\/w:tr>/g),
  p: dem(xml, /<w:p[ >]/g) === dem(xml, /<\/w:p>/g),
  r: dem(xml, /<w:r>/g) + dem(xml, /<w:r /g) === dem(xml, /<\/w:r>/g),
});

// ─── 1) XML giả cùng cấu trúc mẫu ───────────────────────────────────────────
const o = (chu: string, jc = true, dayKe = false) =>
  `<w:tc><w:tcPr><w:tcW w:w="100" w:type="dxa"/><w:tcBorders><w:bottom w:val="${dayKe ? "single" : "nil"}"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr><w:p w:rsidR="00"><w:pPr>${jc ? '<w:jc w:val="center"/>' : ""}<w:rPr><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${chu}</w:t></w:r></w:p></w:tc>`;
// Như mẫu thật: hàng số liệu cuối kẻ đáy, các hàng khác không.
const hangSoLieu = (n: number, cuoi = false) =>
  `<w:tr w:rsidR="00"><w:trPr><w:trHeight w:val="${cuoi ? 331 : 330}"/></w:trPr>${o(String(n), true, cuoi)}${o(" ", false, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}${o(" ", true, cuoi)}</w:tr>`;
const hangTieuDe = `<w:tr><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">No.     </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>Stt</w:t></w:r></w:p></w:tc>${o("TYPE")}${o("PART")}${o("Minimum")}${o("Standard")}${o("In Order")}${o("Out of")}${o("Total")}${o("Short")}${o(" ")}</w:tr>`;
const doanShip = `<w:p w:rsidR="00C5"><w:pPr><w:spacing w:after="120"/><w:rPr><w:sz w:val="28"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t>Ship's Name (</w:t></w:r><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">Tên tàu</w:t></w:r><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">): . . . . </w:t><w:tab/><w:t>Port (</w:t></w:r><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>Cảng</w:t></w:r><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">): . . . </w:t><w:tab/><w:t>Date (</w:t></w:r><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>Ngày</w:t></w:r><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">): . . / . . / . . . </w:t></w:r></w:p>`;
const chuKy = `<w:p><w:pPr><w:rPr><w:sz w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="32"/></w:rPr><w:t>Người kiểm kê</w:t><w:tab/><w:t>Đại Phó</w:t></w:r></w:p>`;
const xmlMau = `<?xml version="1.0"?><w:document><w:body><w:p/>${doanShip}<w:tbl><w:tblPr><w:tblW w:w="15196" w:type="dxa"/></w:tblPr><w:tblGrid>${'<w:gridCol w:w="1"/>'.repeat(10)}</w:tblGrid>${hangTieuDe}${hangSoLieu(1)}${hangSoLieu(2, true)}</w:tbl><w:p/>${chuKy}<w:sectPr/></w:body></w:document>`;

const dong = (stt: number, ten: string): DongChangBuoc => ({ stt, ten, kyHieu: `K-${stt}`, toiThieu: 10 * stt, chuan: 11, conDung: 9, hong: 1, tong: 10, thieu: 1, yeuCau: 2 });
const ra = dienDocumentXml(xmlMau, { tenTau: "M. ODYSSEY", cang: "HAI PHONG", ngay: "16/09/2026", dong: [dong(1, "TWIST LOCK"), dong(2, "R&D <BAR>"), dong(3, "CONE")] });
const bang = ra.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0];
const hang = bang.match(/<w:tr\b[\s\S]*?<\/w:tr>/g)!;
kiemTra("so hang = 1 tieu de + 3 so lieu (mau chi co 2)", hang.length, 4);
const oCua = (tr: string) => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => chuCua(tc));
kiemTra("tieu de giu nguyen", oCua(hang[0])[0], "No.     Stt");
kiemTra("hang 1", oCua(hang[1]), ["1", "TWIST LOCK", "K-1", "10", "11", "9", "1", "10", "1", "2"]);
kiemTra("hang 2 escape & <", oCua(hang[2]).slice(1, 3), ["R&amp;D &lt;BAR&gt;", "K-2"]);
kiemTra("hang 3 them moi", oCua(hang[3])[0], "3");
kiemTra("o ten khong can giua (giu pPr mau)", /<w:jc/.test(hang[1].match(/<w:tc>[\s\S]*?<\/w:tc>/g)![1]), false);
kiemTra("o so can giua", /<w:jc w:val="center"\/>/.test(hang[1].match(/<w:tc>[\s\S]*?<\/w:tc>/g)![3]), true);
kiemTra("giu rPr cua o", dem(hang[1], /<w:szCs w:val="20"\/>/g) >= 10, true);
kiemTra("hang giua: khong ke day, cao 330", [/<w:bottom w:val="nil"\/>/.test(hang[2]), /<w:trHeight w:val="330"\/>/.test(hang[2])], [true, true]);
kiemTra("hang cuoi: ke day theo khuon cuoi, cao 331", [dem(hang[3], /<w:bottom w:val="single"\/>/g), /<w:trHeight w:val="331"\/>/.test(hang[3])], [10, true]);
const pShip = (ra.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/, "").match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => chuCua(p).includes("Ship's Name"))!;
kiemTra("ship's name dien du", chuCua(pShip), "Ship's Name (Tên tàu): M. ODYSSEY Port (Cảng): HAI PHONG Date (Ngày): 16/09/2026");
kiemTra("ship's name con dau cham?", /\. \./.test(chuCua(pShip)), false);
kiemTra("ship's name 2 tab", dem(pShip, /<w:tab\/>/g), 2);
kiemTra("ship's name giu chu nghieng", dem(pShip, /<w:i\/>/g), 3);
kiemTra("ship's name giu spacing", /<w:spacing w:after="120"\/>/.test(pShip), true);
kiemTra("chu ky giu nguyen", ra.includes(chuKy), true);
kiemTra("can bang the", canBang(ra), { tc: true, tr: true, p: true, r: true });
// Ít dòng hơn mẫu: vẫn đủ số hàng của mẫu (hàng trống đánh số).
const raIt = dienDocumentXml(xmlMau, { tenTau: "A", cang: "", ngay: "", dong: [dong(1, "X")] });
const hangIt = raIt.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0].match(/<w:tr\b[\s\S]*?<\/w:tr>/g)!;
kiemTra("it dong -> giu 2 hang mau", hangIt.length, 3);
kiemTra("hang trong danh so + o trong = ' '", oCua(hangIt[2]), ["2", " ", " ", " ", " ", " ", " ", " ", " ", " "]);
// Không có bảng → ném lỗi.
let nem = "";
try {
  dienDocumentXml("<w:document><w:body/></w:document>", { tenTau: "", cang: "", ngay: "", dong: [] });
} catch (e) {
  nem = (e as Error).message;
}
kiemTra("khong bang -> loi", nem, "Mẫu không có bảng.");
kiemTra("datChuO rong -> khoang trang", chuCua(datChuO(o("x"), "")), " ");

// ─── 2) Tệp mẫu thật (nếu có) ───────────────────────────────────────────────
async function mauThat() {
  const duong = "templates/MLS-11-13.docx";
  if (!existsSync(duong)) {
    console.log("  (bo qua phan 2: khong co templates/MLS-11-13.docx)");
    return;
  }
  const mau = readFileSync(duong);
  const ds: DongChangBuoc[] = Array.from({ length: 12 }, (_, i) => dong(i + 1, `GEAR ${i + 1}`));
  const tep = await dienBieuMauChangBuoc(mau, { tenTau: "M. ODYSSEY", cang: "HAI PHONG", ngay: "16/09/2026", dong: ds });
  const zip = await JSZip.loadAsync(tep);
  const xml = await zip.file("word/document.xml")!.async("string");
  const hangThat = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0].match(/<w:tr\b[\s\S]*?<\/w:tr>/g)!;
  kiemTra("mau that: 5 tieu de + 12 so lieu", hangThat.length, 17);
  kiemTra("mau that: hang 6 = dong 1", oCua(hangThat[5]).slice(0, 4), ["1", "GEAR 1", "K-1", "10"]);
  kiemTra("mau that: hang 17 = dong 12", oCua(hangThat[16])[0], "12");
  kiemTra("mau that: chi hang cuoi ke day", [/<w:bottom w:val="single"/.test(hangThat[16]), /<w:bottom w:val="single"/.test(hangThat[15])], [true, false]);
  const pS = (xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/, "").match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => chuCua(p).includes("Ship's Name"))!;
  kiemTra("mau that: ship's name", chuCua(pS).includes("M. ODYSSEY") && chuCua(pS).includes("16/09/2026"), true);
  kiemTra("mau that: can bang the", canBang(xml), { tc: true, tr: true, p: true, r: true });
  kiemTra("mau that: header co logo van con", zip.file("word/header2.xml") !== null && Object.keys(zip.files).some((f) => f.startsWith("word/media/")), true);
  kiemTra("mau that: chu ky con", chuCua(xml).includes("Thuyền Trưởng"), true);
  mkdirSync("_thu-xuat", { recursive: true });
  writeFileSync("_thu-xuat/MLS-11-13-thu.docx", tep);
  console.log("  da ghi _thu-xuat/MLS-11-13-thu.docx");
}

mauThat().then(() => {
  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
});
