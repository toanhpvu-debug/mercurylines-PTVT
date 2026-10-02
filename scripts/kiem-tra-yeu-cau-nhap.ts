/**
 * Kiểm YÊU CẦU NHANH TỪ FILE MLS-11-05B / MLS-11-05A: đọc đầu phiếu (tàu, ngày —
 * không lấy "Ngày ban hành" của khung biểu mẫu —, bộ phận, số y/cầu, loại, thiết
 * bị / hãng / số máy của phiếu phụ tùng), dò cột theo chữ tiêu đề hai hàng Anh /
 * Việt, tiêu đề phần ("ELECTRIC"), dừng ở dòng chữ ký; Excel / Word dựng tại chỗ
 * (và file mẫu thật trên Desktop nếu có), lớp chữ PDF, chế độ "yeuCau" của bộ đọc
 * AI, ghép danh mục, dựng dòng form, R.O.B của hàng mới qua docDongYeuCau, và —
 * chỉ ĐỌC database thật — dựng phần điền sẵn của form.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-yeu-cau-nhap.ts
 */
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import {
  boPhanTuChu,
  chuanImpa,
  chuanNgayYeuCau,
  dauTuAiYeuCau,
  docDongYeuCauFile,
  dongFormTuFile,
  dongTuAiYeuCau,
  dongTuChuPdfYeuCau,
  dongTuLuoiYeuCau,
  ghepDongYeuCau,
  loaiCuaFile,
  type DongYeuCauFile,
  type VatTuGhep,
} from "@/lib/yeuCauNhap";
import { CONG_CU_GHI_YEU_CAU, chuanHoaKetQuaAi, gopLuot, loiNhac } from "@/lib/docPhieuBangAi";
import { docYeuCauKhongAi } from "@/lib/yeuCauTep";
import { docDongYeuCau } from "@/lib/yeuCauVatTu";
import { dienFormTuTep } from "@/lib/yeuCauTepServer";

const prisma = new PrismaClient();
let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
const gon = (d: DongYeuCauFile[]) => d.map((x) => [x.moTa, x.impa ?? x.partNo, x.donVi, x.rob, x.soLuong]);

// Lưới giống MLS-11-05B thật (sheet "4-2026"): khung biểu mẫu có "Ngày ban hành",
// đầu phiếu nhãn / giá trị ở ô rời, tiêu đề cột hai hàng, mô tả gộp ô, phần ELECTRIC, chữ ký.
const LUOI_05B: string[][] = [
  ["MERCURY LINES COMPANY LIMITED", "", "", "REQUISITION FOR STORES", "", "", "", "MLS-11-05", ""],
  ["", "", "", "YÊU CẦU VẬT TƯ", "", "", "", "Ngày ban hành: 10/01/2024", ""],
  ["", "", "", "Phù hợp: Bộ luật ISM 5.2,6.1.3,10.1", "", "", "", "Soát xét: 0", ""],
  ["", "", "", "", "", "", "", "Trang: 1 of 1", ""],
  ["Vsl./Tàu:", "", "M.ODYSSEY", "", "", "", "Date/Ngày:", "1-Apr-26", ""],
  ["Dept./ Bộ phận:", "", "ENGINE DEPARTERMENT", "", "", "", "Req. No.", "001/2026", ""],
  ["", "", "", "", "", "", " Số y/cầu:", "", ""],
  ["S. No.", "Description ", "", "", "IMPA Code", "Unit", "R.O.B", "Q'ty. Req.", "Q'ty. App."],
  ["Stt.", "Mô tả", "", "", "Mã IMPA", "Đơn vị", "Còn tồn trên tàu", "S.lượng yêu cầu", "S.lượng duyệt"],
  ["1", "Welder gloves five finger(găng tay hàn", "", "", "851163", "pair", "0", "2", ""],
  ["2", "Wiping rags(giẻ lau)", "", "", "23 29 08", "kg", "5", "300", ""],
  ["3", "Hand cleaner paste", "", "", "NA", "botle", "", "12", ""],
  ["4", "Seal kit (chưa rõ số)", "", "", "", "set", "1", "", ""],
  ["", "ELECTRIC", "", "", "", "", "", "", ""],
  ["5", "Insulation tapes", "", "", "795422", "pcs", "0", "10", ""],
  ["6", "Led fluorescent lamp T8", "", "", "791478", "pcs", "-", "50", ""],
  ["", "", "", "", "", "", "", "", ""],
  ["Chief Engineer/ Chief Officer", "", "Captain", "", "Tech.&Pur Dept", "", "Vice Director", "", ""],
  ["7", "Không được đọc (sau chữ ký)", "", "", "111111", "pcs", "0", "1", ""],
];

// Lưới MLS-11-05A (phụ tùng): thêm thiết bị / hãng / kiểu / số máy, cột ITEM, Part No.
const LUOI_05A: string[][] = [
  ["MERCURY LINES COMPANY LIMITED", "", "REQUISITION FOR SPARE PARTS", "", "", "", "MLS-11-05A", ""],
  ["", "", "YÊU CẦU PHỤ TÙNG", "", "", "", "Ngày hiệu lực: 01/03/2025", ""],
  ["M/V (Tàu):", "MERCURY STAR", "", "", "Date (Ngày):", "15/06/2026", "", ""],
  ["Dept. (Bộ phận):", "Engine", "", "", "Req. No. (Số y/cầu):", "SR-07/2026", "", ""],
  ["Equipment (Thiết bị):", "Main engine", "", "", "Maker (Hãng SX):", "MAN B&W", "", ""],
  ["Type/Model:", "6S50MC-C", "", "", "Serial/Engine No.:", "SN 12345", "", ""],
  ["S.No", "NAME OF PART", "ITEM", "PART NO.", "UNIT", "ROB", "REQ", "APP"],
  ["Stt", "Tên phụ tùng", "Hạng mục", "Số phụ tùng", "Đơn vị", "S.L Tồn", "S.L Yêu cầu", "S.L Duyệt"],
  ["1", "O-ring", "Cylinder cover", "90512-0045", "pcs", "2", "10", ""],
  ["2", "Exhaust valve spindle", "Exhaust valve", "90801-12", "pcs", "0", "1", ""],
  ["3", "Fuel pump plunger", "", "P/N 455-01", "set", "", "2", ""],
  ["Prepared by", "", "", "Approved by", "", "", "", ""],
];

async function xlsxTuLuoi(luoi: string[][], tenSheet = "Sheet1"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tenSheet);
  for (const r of luoi) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function oWord(chu: string) {
  const x = chu.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<w:tc><w:p><w:r><w:t xml:space="preserve">${x}</w:t></w:r></w:p></w:tc>`;
}
const doanWord = (chu: string) =>
  `<w:p>${chu
    .split("\t")
    .map((x, i) => `${i ? "<w:r><w:tab/></w:r>" : ""}<w:r><w:t xml:space="preserve">${x.replace(/&/g, "&amp;")}</w:t></w:r>`)
    .join("")}</w:p>`;

/** .docx tối thiểu: tiêu đề biểu mẫu ở header trang, đầu phiếu là đoạn văn có tab, bảng dòng hàng. */
async function docxMau(): Promise<Buffer> {
  const bang = [LUOI_05B[7], LUOI_05B[8], ...LUOI_05B.slice(9, 16), LUOI_05B[17]]
    .map((r) => `<w:tr>${r.map(oWord).join("")}</w:tr>`)
    .join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${doanWord(
    "Vsl./Tàu: M.ODYSSEY\tDate/Ngày: 02/04/2026"
  )}${doanWord("Dept./ Bộ phận: DECK\tReq. No.: 015/2026")}<w:tbl>${bang}</w:tbl></w:body></w:document>`;
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${doanWord(
    "MERCURY LINES COMPANY LIMITED\tREQUISITION FOR STORES\tMLS-11-05B"
  )}${doanWord("Ngày ban hành: 10/01/2024")}</w:hdr>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file("word/document.xml", doc);
  zip.file("word/header1.xml", header);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  // ── Ô đơn lẻ ──
  kiemTra("ngay 1-Apr-26", chuanNgayYeuCau("1-Apr-26"), "2026-04-01");
  kiemTra("ngay 15/06/2026", chuanNgayYeuCau("15/06/2026"), "2026-06-15");
  kiemTra("ngay 2.4.26", chuanNgayYeuCau("2.4.26"), "2026-04-02");
  kiemTra("ngay iso", chuanNgayYeuCau("2026-04-01T00:00"), "2026-04-01");
  kiemTra("ngay so Excel 46113", chuanNgayYeuCau("46113"), "2026-04-01");
  kiemTra("ngay sai", chuanNgayYeuCau("31/13/2026"), null);
  kiemTra("impa cach", chuanImpa("23 29 08"), "232908");
  kiemTra("impa NA", chuanImpa("NA"), null);
  kiemTra("impa 5 so", chuanImpa("12345"), null);
  kiemTra("bo phan engine", boPhanTuChu("ENGINE DEPARTERMENT"), "ENGINE");
  kiemTra("bo phan dien", boPhanTuChu("Electric"), "ELECTRICAL");
  kiemTra("bo phan boong", boPhanTuChu("Bộ phận Boong"), "DECK");
  kiemTra("bo phan bep", boPhanTuChu("Galley"), "GENERAL");

  // ── Lưới MLS-11-05B ──
  const b = dongTuLuoiYeuCau(LUOI_05B);
  if ("loi" in b) throw new Error(b.loi);
  kiemTra("05B dau", b.dau, {
    tau: "M.ODYSSEY",
    ngay: "2026-04-01",
    boPhan: "ENGINE",
    soYeuCau: "001/2026",
    loai: "STORE",
    thietBi: null,
    hang: null,
    kieu: null,
    soSeri: null,
  });
  kiemTra("05B dong", gon(b.dong), [
    ["Welder gloves five finger(găng tay hàn", "851163", "pair", 0, 2],
    ["Wiping rags(giẻ lau)", "232908", "kg", 5, 300],
    ["Hand cleaner paste", null, "botle", null, 12],
    ["Seal kit (chưa rõ số)", null, "set", 1, null],
    ["Insulation tapes", "795422", "pcs", 0, 10],
    ["Led fluorescent lamp T8", "791478", "pcs", 0, 50],
  ]);
  kiemTra("05B phan", b.dong.map((d) => d.phan), [null, null, null, null, "ELECTRIC", "ELECTRIC"]);
  kiemTra("05B canh bao thieu so", b.dong.map((d) => Boolean(d.canhBao)), [false, false, false, true, false, false]);
  kiemTra("05B loai", loaiCuaFile(b.dau, b.dong), "STORE");

  // ── Lưới MLS-11-05A ──
  const a = dongTuLuoiYeuCau(LUOI_05A);
  if ("loi" in a) throw new Error(a.loi);
  kiemTra("05A dau", a.dau, {
    tau: "MERCURY STAR",
    ngay: "2026-06-15",
    boPhan: "ENGINE",
    soYeuCau: "SR-07/2026",
    loai: "SPARE",
    thietBi: "Main engine",
    hang: "MAN B&W",
    kieu: "6S50MC-C",
    soSeri: "SN 12345",
  });
  kiemTra("05A dong", gon(a.dong), [
    ["O-ring", "90512-0045", "pcs", 2, 10],
    ["Exhaust valve spindle", "90801-12", "pcs", 0, 1],
    ["Fuel pump plunger", "P/N 455-01", "set", null, 2],
  ]);
  kiemTra("05A hang muc", a.dong.map((d) => d.hangMuc), ["Cylinder cover", "Exhaust valve", null]);
  kiemTra("05A loai", loaiCuaFile(a.dau, a.dong), "SPARE");

  // Phiên bản mẫu đổi thứ tự cột + bảng không tiêu đề biểu mẫu → loại theo cột mã.
  const doiCot = dongTuLuoiYeuCau([
    ["No.", "Unit", "Qty requested", "Description", "Part No.", "Remark"],
    ["1", "pcs", "4", "Gasket", "G-12", "urgent"],
  ]);
  if ("loi" in doiCot) throw new Error(doiCot.loi);
  kiemTra("doi cot", [gon(doiCot.dong), doiCot.dong[0].ghiChu, loaiCuaFile(doiCot.dau, doiCot.dong)], [[["Gasket", "G-12", "pcs", null, 4]], "urgent", "SPARE"]);
  kiemTra("khong co bang", "loi" in dongTuLuoiYeuCau([["abc", "def"], ["1", "2"]]), true);

  // ── Excel / Word qua bộ đọc file ──
  const x = await docYeuCauKhongAi(await xlsxTuLuoi(LUOI_05B, "4-2026"), "MLS-11-05B 4-2026.xlsx");
  kiemTra("excel ok", x.ok && [x.dong.length, x.dau.tau, x.dau.ngay, x.dau.soYeuCau, x.dau.loai], [6, "M.ODYSSEY", "2026-04-01", "001/2026", "STORE"]);
  // Ô ngày THẬT của Excel, định dạng kiểu Mỹ "mm-dd-yy" (như mẫu MLS-11-05 Paint):
  // 01/10/2026 hiện "10-01-26" — phải ra 2026-10-01, không phải 10/01/2026.
  {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("PAINT");
    for (const r of LUOI_05B) ws.addRow(r);
    const o = ws.getCell("H5");
    o.value = new Date(Date.UTC(2026, 9, 1));
    o.numFmt = "mm-dd-yy";
    const xd = await docYeuCauKhongAi(Buffer.from(await wb.xlsx.writeBuffer()), "MLS-11-05 Paint.xlsx");
    kiemTra("excel o ngay mm-dd-yy", xd.ok && xd.dau.ngay, "2026-10-01");
  }
  const w = await docYeuCauKhongAi(await docxMau(), "yeu-cau.docx");
  kiemTra(
    "word ok",
    w.ok && [w.dong.length, w.dau.tau, w.dau.ngay, w.dau.boPhan, w.dau.soYeuCau, w.dau.loai],
    [6, "M.ODYSSEY", "2026-04-02", "DECK", "015/2026", "STORE"]
  );
  const sai = await docYeuCauKhongAi(Buffer.from("abc"), "a.txt");
  kiemTra("duoi sai", sai.ok, false);

  // ── Lớp chữ PDF (pdfChu nối mẩu xa nhau bằng " | "; ô trống không để lại dấu tách) ──
  const chuPdf = [
    "--- trang 1 ---",
    "MERCURY LINES COMPANY LIMITED | REQUISITION FOR STORES | MLS-11-05",
    "YÊU CẦU VẬT TƯ | Ngày ban hành: 10/01/2024",
    "Vsl./Tàu: | M.ODYSSEY | Date/Ngày: | 1-Apr-26",
    "Dept./ Bộ phận: | ENGINE DEPARTERMENT | Req. No. | 001/2026",
    "S. No. | Description | IMPA Code | Unit | R.O.B | Q'ty. Req. | Q'ty. App.",
    "Stt. | Mô tả | Mã IMPA | Đơn vị | Còn tồn trên tàu | S.lượng yêu cầu | S.lượng duyệt",
    "1 | Welder gloves five finger | 851163 | pair | 0 | 2",
    "2 Wiping rags(giẻ lau) | 23 29 08 | kg | 5 | 300",
    "3 | Hand cleaner paste | NA | botle | 12",
    "ELECTRIC",
    "4 | Insulation tapes | 795422 | pcs | 0 | 10 | 8",
    "Chief Engineer/ Chief Officer | Captain | Tech.&Pur Dept",
  ].join("\n");
  const p = dongTuChuPdfYeuCau(chuPdf);
  kiemTra("pdf dau", [p.dau.tau, p.dau.ngay, p.dau.boPhan, p.dau.soYeuCau, p.dau.loai], ["M.ODYSSEY", "2026-04-01", "ENGINE", "001/2026", "STORE"]);
  kiemTra("pdf dong", gon(p.dong), [
    ["Welder gloves five finger", "851163", "pair", 0, 2],
    ["Wiping rags(giẻ lau)", "232908", "kg", 5, 300],
    ["Hand cleaner paste", null, "botle", null, 12],
    ["Insulation tapes", "795422", "pcs", 0, 10],
  ]);
  kiemTra("pdf phan + canh bao 1 cot so", [p.dong[3].phan, Boolean(p.dong[2].canhBao), Boolean(p.dong[0].canhBao)], ["ELECTRIC", true, false]);

  // Bản in MLS-11-05A của chính app (In → Lưu PDF) tải lại: nhãn kèm giá trị trong
  // cùng mẩu, tiêu đề cột REQ / S.L Yêu cầu, cột Ghi chú sau các cột số.
  const inApp = dongTuChuPdfYeuCau(
    [
      "MERCURY LINES COMPANY LIMITED | REQUISITION FOR SPARE PARTS / YÊU CẦU PHỤ TÙNG | MLS-11-05A",
      "M/V (Tàu): MERCURY STAR | Date (Ngày): 15/06/2026",
      "Dept. (Bộ phận): Máy | Req. No. (Số y/cầu): SR-MLS001-26-0007",
      "Equipment (Thiết bị): Main engine | Maker (Hãng SX): MAN B&W",
      "Serial/Engine No.: SN 12345",
      "S.No | NAME OF PART / Tên phụ tùng | ITEM / Hạng mục | PART NO. / Số phụ tùng | UNIT | ROB | REQ | APP | REM",
      "Stt | Đơn vị | S.L Tồn | S.L Yêu cầu | S.L Duyệt | Ghi chú",
      "1 | O-ring | Cylinder cover | 90512-0045 | PCS | 2 | 10 | khẩn",
      "2 | Exhaust valve spindle | Exhaust valve | 90801-12 | PCS | 0 | 1",
    ].join("\n")
  );
  kiemTra(
    "pdf ban in app dau",
    [inApp.dau.tau, inApp.dau.ngay, inApp.dau.boPhan, inApp.dau.soYeuCau, inApp.dau.loai, inApp.dau.thietBi, inApp.dau.hang, inApp.dau.soSeri],
    ["MERCURY STAR", "2026-06-15", "ENGINE", "SR-MLS001-26-0007", "SPARE", "Main engine", "MAN B&W", "SN 12345"]
  );
  kiemTra("pdf ban in app dong", [gon(inApp.dong), inApp.dong.map((d) => [d.hangMuc, d.ghiChu])], [
    [
      ["O-ring", "90512-0045", "PCS", 2, 10],
      ["Exhaust valve spindle", "90801-12", "PCS", 0, 1],
    ],
    [
      ["Cylinder cover", "khẩn"],
      ["Exhaust valve", null],
    ],
  ]);

  // ── Bộ đọc AI, chế độ "yeuCau" ──
  kiemTra("cong cu co ton", "ton" in CONG_CU_GHI_YEU_CAU.input_schema.properties.dong.items.properties, true);
  const ai = chuanHoaKetQuaAi({
    nhaCungCap: null,
    soPhieu: "001/2026",
    ngayGiao: "01/04/2026",
    tau: "M.ODYSSEY",
    boPhan: "Engine dept.",
    loaiYeuCau: "store",
    mayThietBi: null,
    hangSx: null,
    kieuMay: null,
    soMay: null,
    dong: [
      { stt: 1, ten: "Wiping rags(giẻ lau)", impa: "23 29 08", donVi: "kg", ton: 5, soLuong: 300, thietBi: null, trang: 1, canKiem: false },
      { stt: 2, ten: "Insulation tapes", impa: "NA", donVi: "pcs", ton: "-", soLuong: null, thietBi: "ELECTRIC", trang: 1, canKiem: true, lyDoKiem: "số mờ" },
    ],
  });
  const dongAi = dongTuAiYeuCau(ai.dong);
  kiemTra("ai dong", gon(dongAi), [
    ["Wiping rags(giẻ lau)", "232908", "KG", 5, 300],
    ["Insulation tapes", null, "PCS", 0, null],
  ]);
  kiemTra("ai phan + canh bao", [dongAi[1].phan, Boolean(dongAi[1].canhBao), dongAi[0].canhBao], ["ELECTRIC", true, null]);
  kiemTra("ai dau", dauTuAiYeuCau(ai), {
    tau: "M.ODYSSEY",
    ngay: "2026-04-01",
    boPhan: "ENGINE",
    soYeuCau: "001/2026",
    loai: "STORE",
    thietBi: null,
    hang: null,
    kieu: null,
    soSeri: null,
  });
  kiemTra("ai so phieu la ma bieu mau → null", dauTuAiYeuCau({ ...ai, soPhieu: "MLS-11-05" }).soYeuCau, null);
  const sua = gopLuot(ai.dong, ai.dong.map((d, i) => (i === 0 ? { ...d, ton: 7 } : d)));
  kiemTra("gop luot bao sua ROB", /R\.O\.B/.test(sua[0].canhBao ?? ""), true);
  kiemTra("loi nhac luot 2 co ton", /"ton":5/.test(loiNhac(null, ai.dong, "yeuCau")), true);
  kiemTra("phieu giao khong co ton", "ton" in chuanHoaKetQuaAi({ dong: [{ ten: "Rope", soLuong: 1, loai: "STORE" }] }).dong[0], false);

  // ── Ghép danh mục + dòng form ──
  const vt: VatTuGhep[] = [
    { id: 1, code: "D-IMPA-0001", nameVn: "Giẻ lau", nameEn: "Wiping rags", impa: "232908", partNumber: null, uom: "KG", materialType: "STORE", cuaTau: false },
    { id: 2, code: "E-IMPA-0002", nameVn: "Giẻ lau (máy)", nameEn: null, impa: "232908", partNumber: null, uom: "KG", materialType: "STORE", cuaTau: true },
    { id: 3, code: "E-SPR-0001", nameVn: "Gioăng O", nameEn: "O-ring", impa: null, partNumber: "90512-0045", uom: "PCS", materialType: "SPARE", cuaTau: true },
    { id: 4, code: "D-IMPA-0003", nameVn: "Băng keo cách điện", nameEn: "Insulation tapes", impa: null, partNumber: null, uom: "PCS", materialType: "STORE", cuaTau: false },
    // Ghép theo nửa tiếng Việt của mô tả song ngữ (ô gộp mất dấu ")").
    { id: 5, code: "E-IMPA-0004", nameVn: "Găng tay hàn", nameEn: null, impa: null, partNumber: null, uom: "PAIR", materialType: "STORE", cuaTau: false },
  ];
  kiemTra("ghep 05B", ghepDongYeuCau(b.dong, "STORE", vt).map((m) => m?.id ?? null), [5, 2, null, null, 4, null]);
  kiemTra("ghep 05A", ghepDongYeuCau(a.dong, "SPARE", vt).map((m) => m?.id ?? null), [3, null, null]);
  const form = dongFormTuFile(b.dong, ghepDongYeuCau(b.dong, "STORE", vt), (d) => (d.rob !== null ? `ROB ${d.rob}` : undefined));
  kiemTra("form dong khop", form[1], { mode: "existing", materialId: "2", itemName: "Wiping rags(giẻ lau)", itemCode: "232908", itemUom: "kg", quantity: "300", note: "", rob: "", goiY: "ROB 5" });
  kiemTra("form dong moi", form[2], { mode: "new", materialId: "", itemName: "Hand cleaner paste", itemCode: "", itemUom: "botle", quantity: "12", note: "", rob: "", goiY: undefined });
  kiemTra("form dong moi giu rob", [form[3].mode, form[3].rob, form[0].mode, form[0].rob], ["new", "1", "existing", ""]);
  kiemTra("form thieu so + phan", [form[3].quantity, form[4].note], ["", "ELECTRIC"]);
  kiemTra("doc lai JSON", docDongYeuCauFile(JSON.parse(JSON.stringify(b.dong))), b.dong);

  // ── API: R.O.B của hàng mới ──
  kiemTra(
    "docDongYeuCau rob",
    docDongYeuCau([
      { isNew: true, itemName: "Rope", quantity: 2, rob: 3 },
      { isNew: true, itemName: "Wire", quantity: 1, rob: "" },
      { isNew: true, itemName: "Clip", quantity: 1 },
      { materialId: 5, quantity: 1, rob: 9 },
    ]).map((d) => d.rob),
    [3, null, null, null]
  );

  // ── File mẫu thật (Desktop) — có thì kiểm ──
  const mauThat = "C:/Users/admin/Desktop/MLS-11-05B YEU CAU VAT TU 4-2026.xlsx";
  if (existsSync(mauThat)) {
    const t = await docYeuCauKhongAi(readFileSync(mauThat), "MLS-11-05B YEU CAU VAT TU 4-2026.xlsx");
    kiemTra(
      "mau that",
      t.ok && [t.dong.length, t.dong.filter((d) => d.phan === "ELECTRIC").length, t.dau.tau, t.dau.ngay, t.dau.boPhan, t.dau.soYeuCau, t.dau.loai],
      [169, 6, "M.ODYSSEY", "2026-04-01", "ENGINE", "001/2026", "STORE"]
    );
  } else console.log("  (bo qua mau that: khong co file tren Desktop)");

  // ── Database thật — CHỈ ĐỌC: dựng phần điền sẵn của form ──
  const coImpa = await prisma.material.findFirst({ where: { isActive: true, materialType: "STORE", impa: { not: null } }, select: { id: true, impa: true } });
  const impaSo = chuanImpa(coImpa?.impa);
  if (coImpa && impaSo) {
    const dien = await dienFormTuTep(
      {
        id: 999999,
        fileName: "thu.xlsx",
        vesselId: null,
        dau: { ...b.dau },
        dong: [
          { ...b.dong[0], impa: impaSo },
          { ...b.dong[2], impa: null, moTa: "Mặt hàng không thể có trong danh mục zzqq" },
        ],
      },
      {},
      { robFile: (n) => `ROB ${n}`, soGoc: (so) => `So ${so}` }
    );
    const ghepIds = (await prisma.material.findMany({ where: { isActive: true, materialType: "STORE" }, select: { id: true, impa: true } }))
      .filter((m) => chuanImpa(m.impa) === impaSo)
      .map((m) => String(m.id));
    kiemTra(
      "db dien form",
      [dien.kind, dien.khop, dien.moi, ghepIds.includes(dien.items[0].materialId), dien.items[1].mode, dien.purpose, dien.requiredDate, dien.department, dien.tauFile],
      ["STORE", 1, 1, true, "new", "So 001/2026", "2026-04-01", "ENGINE", "M.ODYSSEY"]
    );
  } else console.log("  (bo qua kiem DB: chua co vat tu co IMPA)");

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  await prisma.$disconnect();
  if (truot) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
