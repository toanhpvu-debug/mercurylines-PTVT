/**
 * Kiểm phần thuần của Phụ tùng thiết yếu MLS-11-04: đọc bảng mẫu Word
 * (lib/thietYeu.ts) và điền tệp Word mẫu (lib/bieuMauThietYeu.ts).
 *
 * Chạy:  npx tsx scripts/kiem-tra-thiet-yeu.ts
 *
 * Phần 1–3 chạy trên dữ liệu giả (luôn chạy). Phần 4 đọc các tệp MLS-11-04 thật
 * trên Desktop nếu có; phần 5 điền tệp mẫu thật templates/MLS-11-04.docx nếu có
 * (tài liệu nội bộ, không vào git) và ghi bản thử ra _thu-xuat/MLS-11-04-thu.docx
 * để mở xem bằng Word. Không đụng database.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { chuCua } from "@/lib/bieuMauChangBuoc";
import { dienBieuMauThietYeu, dienXmlThietYeu, kiemTraBieuMauThietYeu } from "@/lib/bieuMauThietYeu";
import {
  docHangMLS1104,
  gomNhom,
  laThieu,
  ngayBaoCao,
  soIn,
  soTuToiThieu,
  tachHang,
  thangHopLe,
  type DongThietYeu,
} from "@/lib/thietYeu";

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

// ─── 1) Quy đổi & tiện ích ──────────────────────────────────────────────────
console.log("\n=== 1) Quy doi toi thieu, thang, ngay ===");
kiemTra("01 set", soTuToiThieu("01 set"), 1);
kiemTra("1/2 set", soTuToiThieu("1/2 set"), 0.5);
kiemTra("½ set", soTuToiThieu("½ set"), 0.5);
kiemTra("06", soTuToiThieu("06"), 6);
kiemTra("1 of each type", soTuToiThieu("1 of each type"), 1);
kiemTra("2,5 kg", soTuToiThieu("2,5 kg"), 2.5);
kiemTra("chu khong so", soTuToiThieu("as required"), 0);
kiemTra("trong", soTuToiThieu(""), 0);
const bayGio = new Date(2026, 8, 30, 10); // 30/09/2026
kiemTra("thang hop le", thangHopLe("2026-08", bayGio), "2026-08");
kiemTra("thang sai → thang hien tai", thangHopLe("2026-13", bayGio), "2026-09");
kiemTra("thang rong → thang hien tai", thangHopLe(null, bayGio), "2026-09");
kiemTra("ngay bao cao thang dang chay = hom nay", ngayBaoCao("2026-09", bayGio), "30/09/2026");
kiemTra("ngay bao cao thang da qua = cuoi thang", ngayBaoCao("2026-02", bayGio), "28/02/2026");
kiemTra("thieu khi hien co < toi thieu", laThieu({ toiThieuSo: 1, hienCo: 0 }), true);
kiemTra("khong thieu khi chua co so", laThieu({ toiThieuSo: 1, hienCo: null }), false);
kiemTra("khong thieu khi du", laThieu({ toiThieuSo: 0.5, hienCo: 0.5 }), false);
kiemTra("khong thieu khi khong co muc toi thieu", laThieu({ toiThieuSo: 0, hienCo: 0 }), false);
kiemTra("so in", [soIn(null), soIn(2), soIn(1.005), soIn(0)], ["", "2", "1", "0"]);
kiemTra(
  "gom nhom giu thu tu, gop nhom roi rac",
  gomNhom([{ nhom: "A" }, { nhom: "B" }, { nhom: "A" }]).map((g) => [g.nhom, g.dong.length]),
  [["A", 2], ["B", 1]]
);

// ─── 2) Đọc hàng giả cùng dạng word-extractor ──────────────────────────────
console.log("\n=== 2) Doc bang MLS-11-04 (gia) ===");
const body = [
  "DANH MỤC KIỂM TRA PHỤ TÙNG THIẾT YẾU TRÊN TÀU",
  "Tên tàu (Vessel) ODYSSEY…………..                              Ngày (Date):……../…….. /2026……",
  ["stt", "Mô tả Description", "Số phụ tùng Spare Part No.", "Tối thiểu Minimum", "Số phụ tùng ban đầu Begin stock", "Nhận", "Tổng tiêu thụ", "Hiện có", "Vị trí", ""].join("\t"),
  ["A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)", ""].join("\t"),
  ["1", "Cylinder cover complete (mặt qui lát hoàn chỉnh)", "", "01 set", "", "", "", "", "", ""].join("\t"),
  ["2", "Exhaust valve  complete", "P-123", "1/2 set", "2", "1", "0", "3", "Kho máy", ""].join("\t"),
  ["B.Phụ tùng cho Máy đèn (Spare Parts for Diesel generator)", ""].join("\t"),
  ["1", "Piston ring", "", "1 of each type", "", "", "", "0,5", "", ""].join("\t"),
  ["C", "SPARE PARTS FOR BOILERS"].join("\t"),
  ["1", "Burner nozzle", "", "06", "", "", "", "", "", ""].join("\t"),
  ["D", "SPARE PART FOR ESSENTIAL AUXILIAIES", " ", " ", "", ""].join("\t"),
  ["1", "Fuel oil pump shaft seal", "", "01", "", "", "", "", "", ""].join("\t"),
  ["", "", "", "", "", "", "", "", "", ""].join("\t"),
  ["Máy trưởng", "Thuyền trưởng"].join("\t"),
].join("\r\n");
const doc = docHangMLS1104(tachHang(body));
kiemTra("so muc", doc.muc.length, 5);
kiemTra("ten tau", doc.tenTau, "ODYSSEY");
kiemTra(
  "nhom",
  [...new Set(doc.muc.map((m) => m.nhom))],
  [
    "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)",
    "B. Phụ tùng cho Máy đèn (Spare Parts for Diesel generator)",
    "C. SPARE PARTS FOR BOILERS",
    "D. SPARE PART FOR ESSENTIAL AUXILIAIES",
  ]
);
kiemTra("muc 1", [doc.muc[0].stt, doc.muc[0].moTa, doc.muc[0].partNo, doc.muc[0].toiThieu, doc.muc[0].toiThieuSo, doc.muc[0].hienCo], ["1", "Cylinder cover complete (mặt qui lát hoàn chỉnh)", null, "01 set", 1, null]);
kiemTra("muc 2 day so", [doc.muc[1].moTa, doc.muc[1].partNo, doc.muc[1].toiThieuSo, doc.muc[1].tonDau, doc.muc[1].nhan, doc.muc[1].tieuThu, doc.muc[1].hienCo, doc.muc[1].viTri], ["Exhaust valve complete", "P-123", 0.5, 2, 1, 0, 3, "Kho máy"]);
kiemTra("so thap phan dau phay", doc.muc[2].hienCo, 0.5);
kiemTra("hang tieu de cot / chu ky bi bo qua", doc.boQua >= 2, true);
kiemTra("muc khong co nhom → Khac", docHangMLS1104([["1", "Loose item", "", "01"]]).muc[0].nhom, "Khác");

// ─── 3) Điền XML giả cùng cấu trúc mẫu ─────────────────────────────────────
console.log("\n=== 3) Dien XML gia ===");
const o = (chu: string, span = 0) =>
  `<w:tc><w:tcPr><w:tcW w:w="100" w:type="dxa"/>${span ? `<w:gridSpan w:val="${span}"/>` : ""}</w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>${chu ? `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${chu}</w:t></w:r>` : ""}</w:p></w:tc>`;
const hangTieuDe = `<w:tr><w:trPr><w:trHeight w:val="870"/></w:trPr>${["stt", "Mô tả", "Số phụ tùng", "Tối thiểu"].map((c) => o(c)).join("")}${o("Ban đầu", 2)}${["Nhận", "Tiêu thụ", "Hiện có", "Vị trí"].map((c) => o(c)).join("")}</w:tr>`;
const hangNhom = `<w:tr w:rsidR="1"><w:trPr><w:trHeight w:val="300"/></w:trPr>${o("A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)", 10)}</w:tr>`;
const hangMuc = (n: string) => `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>${o(n)}${o("Cylinder cover")}${o("")}${o("01 set")}${o("", 2)}${o("")}${o("")}${o("")}${o("")}</w:tr>`;
const hangTrong = `<w:tr><w:trPr><w:trHeight w:val="315"/></w:trPr>${o("")}${o("")}${o("")}${o("")}${o("", 2)}${o("")}${o("")}${o("")}${o("")}</w:tr>`;
const doanTau = `<w:p><w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Tên tàu</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> (</w:t></w:r><w:r><w:rPr><w:i/><w:sz w:val="24"/></w:rPr><w:t>Vessel</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>) ODYSSEY…………..   Ngày (</w:t></w:r><w:r><w:rPr><w:i/><w:sz w:val="24"/></w:rPr><w:t>Date</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>):……../…….. /2026……</w:t></w:r></w:p>`;
const xmlMau = `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>CHECK LIST FOR ESSENTIAL SPARE PARTS ONBOARD</w:t></w:r></w:p>${doanTau}<w:tbl><w:tblPr><w:tblW w:w="10000" w:type="dxa"/></w:tblPr><w:tblGrid>${'<w:gridCol w:w="1"/>'.repeat(10)}</w:tblGrid>${hangTieuDe}${hangNhom}${hangMuc("1")}${hangMuc("2")}${hangTrong}${hangTrong}</w:tbl><w:p><w:r><w:t>Máy trưởng</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;

const dong = (id: number, nhom: string, stt: string, moTa: string, x: Partial<DongThietYeu> = {}): DongThietYeu => ({
  id,
  nhom,
  stt,
  moTa,
  partNo: null,
  toiThieu: "01 set",
  toiThieuSo: 1,
  tonDau: null,
  nhan: null,
  tieuThu: null,
  hienCo: null,
  viTri: null,
  nguon: "UOC",
  maVatTu: null,
  ...x,
});
const ra = dienXmlThietYeu(xmlMau, {
  tenTau: "M. ODYSSEY",
  ngay: "30/09/2026",
  dong: [
    dong(1, "A. Máy chính", "1", "Cylinder cover", { partNo: "P-1", tonDau: 2, nhan: 1, tieuThu: 1, hienCo: 2, viTri: "Kho <máy>" }),
    dong(2, "A. Máy chính", "2", "Piston & ring"),
    dong(3, "B. Máy đèn", "1", "Fuel pump", { toiThieu: "1/2 set", hienCo: 0.5 }),
  ],
});
const bang = ra.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0];
const hang = bang.match(/<w:tr\b[\s\S]*?<\/w:tr>/g)!;
const oCua = (tr: string) => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => chuCua(tc));
kiemTra("so hang = tieu de + 2 nhom + 3 muc + 1 hang trong", hang.length, 7);
kiemTra("tieu de cot giu nguyen", oCua(hang[0]).slice(0, 2), ["stt", "Mô tả"]);
kiemTra("hang nhom A mot o", oCua(hang[1]), ["A. Máy chính"]);
kiemTra("hang nhom giu gridSpan 10", /<w:gridSpan w:val="10"\/>/.test(hang[1]), true);
kiemTra("muc 1 du 9 o", oCua(hang[2]), ["1", "Cylinder cover", "P-1", "01 set", "2", "1", "1", "2", "Kho &lt;máy&gt;"]);
kiemTra("muc 2 escape &", oCua(hang[3])[1], "Piston &amp; ring");
kiemTra("o ban dau giu gridSpan 2", /<w:gridSpan w:val="2"\/>/.test(hang[2]), true);
kiemTra("hang nhom B", oCua(hang[4]), ["B. Máy đèn"]);
// Ô trống ghi một dấu cách (datChuO) để Word giữ chiều cao dòng như mẫu.
kiemTra("muc B so thap phan", oCua(hang[5]).slice(3, 8).map((c) => c.trim()), ["1/2 set", "", "", "", "0.5"]);
kiemTra("hang trong cuoi", oCua(hang[6]).every((c) => !c.trim()), true);
kiemTra("giu trPr cao hang muc", /<w:trHeight w:val="400"\/>/.test(hang[2]), true);
kiemTra("the can bang", [dem(ra, /<w:tc>/g) === dem(ra, /<\/w:tc>/g), dem(ra, /<w:tr\b/g) === dem(ra, /<\/w:tr>/g)], [true, true]);
const pTau = (ra.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/, "").match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => chuCua(p).includes("Vessel"))!;
kiemTra("doan ten tau / ngay", chuCua(pTau).replace(/\s+/g, " "), "Tên tàu (Vessel) M. ODYSSEY Ngày (Date): 30/09/2026");
kiemTra("doan ten tau het dau cham", /…/.test(chuCua(pTau)), false);
kiemTra("Vessel / Date van nghieng", dem(pTau, /<w:i\/>/g), 2);
kiemTra("mau khong co bang → loi", (() => { try { dienXmlThietYeu("<w:document/>", { tenTau: "", ngay: "", dong: [] }); return "khong loi"; } catch { return "loi"; } })(), "loi");

// ─── 4) Tệp MLS-11-04 thật trên Desktop (nếu có) ───────────────────────────
const desktop = path.join(os.homedir(), "Desktop");
const tepThat = existsSync(desktop) ? readdirSync(desktop).filter((f) => /^MLS-11-04.*\.docx?$/i.test(f)) : [];
let mucThat: DongThietYeu[] = [];
async function docThat() {
  if (!tepThat.length) {
    console.log("\n=== 4) Bo qua: khong co tep MLS-11-04 tren Desktop ===");
    return;
  }
  console.log(`\n=== 4) Doc ${tepThat.length} tep MLS-11-04 that ===`);
  const { default: WordExtractor } = await import("word-extractor");
  for (const f of tepThat) {
    const kq = docHangMLS1104(tachHang((await new WordExtractor().extract(path.join(desktop, f))).getBody()));
    const nhom = gomNhom(kq.muc).map((g) => `${g.nhom.slice(0, 1)}:${g.dong.length}`);
    console.log(`  ${f}: ${kq.muc.length} muc, nhom ${nhom.join(" ")}, tau ${kq.tenTau}`);
    kiemTra(`${f}: co muc`, kq.muc.length > 40, true);
    kiemTra(`${f}: 4 nhom A-D`, gomNhom(kq.muc).map((g) => g.nhom.slice(0, 1)), ["A", "B", "C", "D"]);
    kiemTra(`${f}: moi muc co toi thieu quy doi duoc`, kq.muc.filter((m) => m.toiThieuSo <= 0).map((m) => m.toiThieu), []);
    kiemTra(`${f}: stt nhom A bat dau tu 1`, kq.muc[0].stt, "1");
    if (!mucThat.length) mucThat = kq.muc.map((m, i) => ({ ...m, id: i + 1, nguon: "UOC" as const, maVatTu: null, hienCo: i % 7 === 0 ? 0 : 1 }));
  }
}

// ─── 5) Tệp mẫu thật templates/MLS-11-04.docx (nếu có) ─────────────────────
async function dienThat() {
  const tep = path.join(process.cwd(), "templates", "MLS-11-04.docx");
  if (!existsSync(tep)) {
    console.log("\n=== 5) Bo qua: khong co templates/MLS-11-04.docx ===");
    return;
  }
  console.log("\n=== 5) Dien tep mau that ===");
  const mau = readFileSync(tep);
  kiemTra("mau hop le", await kiemTraBieuMauThietYeu(mau), { ok: true });
  const dongThu = mucThat.length ? mucThat : [dong(1, "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)", "1", "Cylinder cover complete")];
  const ra = await dienBieuMauThietYeu(mau, { tenTau: "M. ODYSSEY", ngay: "30/09/2026", dong: dongThu });
  const xml = await (await JSZip.loadAsync(ra)).file("word/document.xml")!.async("string");
  const hang = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0].match(/<w:tr\b[\s\S]*?<\/w:tr>/g)!;
  const soNhom = gomNhom(dongThu).length;
  kiemTra("so hang = tieu de + nhom + muc + 1 trong", hang.length, 1 + soNhom + dongThu.length + 1);
  kiemTra("ten tau da dien", chuCua(xml).includes("M. ODYSSEY"), true);
  kiemTra("header / footer con nguyen", Object.keys((await JSZip.loadAsync(ra)).files).filter((f) => /word\/(header|footer)\d\.xml/.test(f)).length >= 2, true);
  const thuMuc = path.join(process.cwd(), "_thu-xuat");
  if (!existsSync(thuMuc)) mkdirSync(thuMuc);
  writeFileSync(path.join(thuMuc, "MLS-11-04-thu.docx"), ra);
  console.log(`  Da ghi _thu-xuat/MLS-11-04-thu.docx (${dongThu.length} muc, ${soNhom} nhom)`);
}

(async () => {
  await docThat();
  await dienThat();
  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  if (truot) process.exit(1);
})();
