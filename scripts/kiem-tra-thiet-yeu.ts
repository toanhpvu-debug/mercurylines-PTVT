/**
 * Kiểm phần thuần của Phụ tùng thiết yếu MLS-11-04: đọc bảng mẫu Word
 * (lib/thietYeu.ts) và điền tệp Word mẫu (lib/bieuMauThietYeu.ts).
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-thiet-yeu.ts
 *        (thêm MLS1104_DIR=<thư mục> để đọc thử cả tệp tàu gửi ở thư mục đó)
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
import { moTepWord } from "@/lib/docWord";
import {
  COT_IN,
  TOI_DA_DONG_IN,
  canBoSung,
  congThang,
  cungTauTep,
  docBangThietYeu,
  docHangMLS1104,
  doiChieuThietYeu,
  dongInTu,
  ghepHangWord,
  gomNhom,
  laThieu,
  laThieuIn,
  ngayBaoCao,
  sachBanIn,
  soCoDonVi,
  soIn,
  soTuToiThieu,
  tachHang,
  thangHopLe,
  thangTuongLai,
  tongHopNhom,
  VI_TRI_CO_THE,
  type DongThietYeu,
} from "@/lib/thietYeu";
import { TU_DIEN } from "@/lib/i18n/tuDien";

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

// ─── 0) Vị trí có thể (gợi ý ô Vị trí / Location) ────────────────────────────
console.log("\n=== 0) Vi tri co the ===");
{
  const vi = TU_DIEN.thietYeu.vi as Record<string, string>;
  const en = TU_DIEN.thietYeu.en as Record<string, string>;
  kiemTra("khong trung khoa / chu in", [new Set(VI_TRI_CO_THE.map((v) => v.khoa)).size, new Set(VI_TRI_CO_THE.map((v) => v.ma)).size], [VI_TRI_CO_THE.length, VI_TRI_CO_THE.length]);
  kiemTra("moi vi tri co ten VI + EN", VI_TRI_CO_THE.filter((v) => !vi[`viTri_${v.khoa}`] || !en[`viTri_${v.khoa}`]).map((v) => v.khoa), []);
  // "E/R" — chữ tàu đang ghi trong file MLS-11-04 thật — phải là lựa chọn ĐẦU, đúng từng ký tự.
  kiemTra("E/R dung dau, dung chu tau ghi", [VI_TRI_CO_THE[0].ma, vi.viTri_ER, en.viTri_ER], ["E/R", "Buồng máy", "Engine room"]);
  kiemTra("chu in khong qua 120 ky tu (cot viTri)", VI_TRI_CO_THE.every((v) => v.ma.length <= 120), true);
}

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

// ─── 2b) Tệp tàu gửi nhiều khuôn: báo cáo tháng đã điền, bảng tiếng Anh, Excel ─
console.log("\n=== 2b) Doc tep nhieu khuon ===");
kiemTra(
  "so co don vi",
  ["1 SET", "2PCS", "0SET", "12 pcs", "1/2", "-", "abc", "", "1,5", "N/A"].map((s) => soCoDonVi(s)),
  [1, 2, 0, 12, 0.5, 0, null, null, 1.5, null]
);
// Báo cáo tháng tàu đã điền (như tệp "… 2026_1.doc"): số thứ tự chung ô mô tả, 8 cột, số kèm
// đơn vị; tiêu đề cột và ô ký bị xuống dòng trong ô; một ô mô tả cũng xuống dòng.
const bodyThang = [
  "DANH MỤC KIỂM TRA PHỤ TÙNG THIẾT YẾU TRÊN TÀU",
  "CHECK LIST FOR ESSENTIAL SPARE PARTS ONBOARD",
  "",
  "Tên tàu (Vessel): M.TESTSHIP                              Ngày (Date):  30 /09/2026",
  "",
  "Mô tả",
  "Description                    \tSố phụ tùng Spare Part No. \tTối thiểu Minimum\tSố phụ tùng ban đầu Begin stock\tSố phụ tùng nhận trong tháng",
  "Rcvd. in month\tTổng tiêu thụ Total conspt\tHiện có Remain onboard \tVị trí Location   \t",
  "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)\t",
  "1. Main Bearing (Bạc trục):\tP-001\t2 set\t1\t0\t0\t1 SET\tE/R\t",
  "2. Thrust bearing (Bạc đẩy)\tP-002\t1 set\t0\t0\t0\t0 SET\tE/R\t",
  "3. O-ring (Doăng cao su kín nước)\t\t2 set\t1\t2\t1\t2PCS\tE/R\t",
  "B. Phụ tùng cho diesel Máy phát điện (Spare parts for diesel generator Engine)\t",
  "1. Main Bearing (Bạc trục):\t\t6 set\t0\t0\t0\t0SET\tE/R\t",
  "2. Cylinder head",
  "(Quy lát)\tP-009\t3 pcs\t1\t0\t0\t1PC\tE/R\t",
  "",
  "Máy hai",
  "second engineer\tMáy trưởng",
  "Chief Engineer\tThuyền trưởng",
  "Master\t",
  "Người Thử A\tNgười Thử B\tNgười Thử C\t",
].join("\r\n");
const hangThang = ghepHangWord(bodyThang);
kiemTra(
  "ghep hang: tieu de cot xuong dong trong o",
  hangThang.find((h) => h[0].startsWith("Mô tả"))?.map((c) => c.replace(/\s+/g, " ").trim()).slice(0, 5),
  ["Mô tả Description", "Số phụ tùng Spare Part No.", "Tối thiểu Minimum", "Số phụ tùng ban đầu Begin stock", "Số phụ tùng nhận trong tháng Rcvd. in month"]
);
kiemTra("ghep hang: o ky ten ghep lai", hangThang.some((h) => h[0].trim() === "Máy hai second engineer"), true);
const kqThang = docBangThietYeu(hangThang);
kiemTra("bao cao thang: tau, ngay, thang cua so", [kqThang.tenTau, kqThang.ngay, kqThang.thang, kqThang.theoTieuDe], ["M.TESTSHIP", "30/09/2026", "2026-09", true]);
kiemTra(
  "bao cao thang: 5 muc, stt tach khoi mo ta, bo dau ':' cuoi, so kem don vi",
  kqThang.muc.map((m) => [m.nhom.slice(0, 1), m.stt, m.moTa, m.partNo, m.toiThieuSo, m.tonDau, m.nhan, m.tieuThu, m.hienCo, m.viTri]),
  [
    ["A", "1", "Main Bearing (Bạc trục)", "P-001", 2, 1, 0, 0, 1, "E/R"],
    ["A", "2", "Thrust bearing (Bạc đẩy)", "P-002", 1, 0, 0, 0, 0, "E/R"],
    ["A", "3", "O-ring (Doăng cao su kín nước)", null, 2, 1, 2, 1, 2, "E/R"],
    ["B", "1", "Main Bearing (Bạc trục)", null, 6, 0, 0, 0, 0, "E/R"],
    ["B", "2", "Cylinder head (Quy lát)", "P-009", 3, 1, 0, 0, 1, "E/R"],
  ]
);
kiemTra("bao cao thang: dong ky ten / ho ten khong thanh muc", kqThang.muc.some((m) => /Máy hai|Người Thử/.test(m.moTa)), false);
// Bảng tiếng Anh (No. · System Category · Spare Part Name · Min. Qty · Unit): nhóm theo cột.
const kqAnh = docBangThietYeu(
  ghepHangWord(
    [
      "Essential spare parts for a new container vessel",
      "No.\tSystem Category\tEquipment Type\tSpare Part Name (English)\tCCS Standard Code\tMin. Qty\tUnit\tTechnical Remarks\t",
      "1\tMain Engine\tCylinder Head\tCylinder Head (fully assembled)\tCCS-1\t1\tPIECE\tTested\t",
      "2\tMain Engine\tFuel Injector\tFuel Injector Nozzle\tCCS-2\tAll\tPIECE\tPer cylinder\t",
      "3\tAuxiliary Engine\tCylinder Head\tAuxiliary Cylinder Head\tCCS-3\t2\tPIECE\t\t",
    ].join("\n")
  )
);
kiemTra(
  "bang tieng Anh: nhom theo cot, toi thieu + don vi",
  kqAnh.muc.map((m) => [m.nhom, m.stt, m.moTa, m.partNo, m.toiThieu, m.toiThieuSo]),
  [
    ["Main Engine", "1", "Cylinder Head (fully assembled)", null, "1 PIECE", 1],
    ["Main Engine", "2", "Fuel Injector Nozzle", null, "All PIECE", 0],
    ["Auxiliary Engine", "3", "Auxiliary Cylinder Head", null, "2 PIECE", 2],
  ]
);
// Excel: mỗi dòng sheet là một hàng ô (không có tab).
const kqExcel = docBangThietYeu([
  ["Tên tàu (Vessel): M. TESTSHIP", "", "", "Ngày (Date): 31/08/2026"],
  ["STT", "Mô tả", "Số phụ tùng", "Tối thiểu", "Ban đầu", "Nhận", "Tiêu thụ", "Hiện có", "Vị trí"],
  ["A. Máy chính", "", "", "", "", "", "", "", ""],
  ["1", "Piston ring", "PR-1", "2 set", "3", "", "1", "2 set", "Kho máy"],
]);
kiemTra("excel: tau, thang, muc", [kqExcel.tenTau, kqExcel.thang, kqExcel.muc.map((m) => [m.nhom, m.moTa, m.tonDau, m.nhan, m.tieuThu, m.hienCo])], [
  "M. TESTSHIP",
  "2026-08",
  [["A. Máy chính", "Piston ring", 3, null, 1, 2]],
]);
kiemTra(
  "ten tau trong tep vs tau dang chon",
  [
    cungTauTep("M.ODYSSEY", { name: "M. ODYSSEY", code: "ML-001" }),
    cungTauTep("ODYSSEY", { name: "M. ODYSSEY", code: "ML-001" }),
    cungTauTep("MV ODYSSEY", { name: "M. ODYSSEY", code: "ML-001" }),
    cungTauTep("ATLAS", { name: "M. ODYSSEY", code: "ML-001" }),
    cungTauTep(null, { name: "M. ODYSSEY", code: "ML-001" }),
  ],
  [true, true, true, false, null]
);
// Đối chiếu với danh mục đang có: cùng nhóm, mô tả (bỏ dấu câu) → số phụ tùng → stt + đầu mô tả.
const dc = doiChieuThietYeu(
  [
    { nhom: "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)", stt: "1", moTa: "Main Bearing (Bạc trục):", partNo: "P-001" },
    { nhom: "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)", stt: "2", moTa: "Thrust bearing (Bạc đẩy)", partNo: "P-002" },
    { nhom: "B. Phụ tùng cho diesel Máy phát điện", stt: "1", moTa: "Main Bearing (Bạc trục)", partNo: null },
    { nhom: "B. Phụ tùng cho diesel Máy phát điện", stt: "2", moTa: "Cylinder head (Quy lát)", partNo: "P-009" },
    { nhom: "B. Phụ tùng cho diesel Máy phát điện", stt: "3", moTa: "Piston", partNo: null },
  ],
  [
    { id: 11, nhom: "A. Phụ tùng cho Máy chính", stt: "1", moTa: "Main Bearing (Bạc trục)", partNo: null },
    { id: 12, nhom: "A. Phụ tùng cho Máy chính", stt: "2", moTa: "Thrust bearing", partNo: "P-002" },
    { id: 21, nhom: "B. Máy phát", stt: "1", moTa: "Main Bearing (Bạc trục)", partNo: null },
    { id: 22, nhom: "B. Máy phát", stt: "2", moTa: "Cylinder head (Quy lát) — cũ", partNo: null },
    { id: 31, nhom: "C. Cần cẩu", stt: "1", moTa: "Hộp số", partNo: null },
  ]
);
kiemTra("doi chieu: trung theo nhom + mo ta / so phu tung / stt; mo ta trung o nhom khac khong lan", [dc.khop, dc.khongTrongTep], [[11, 12, 21, 22, null], [31]]);
kiemTra(
  "can bo sung theo don vi cot toi thieu",
  [
    canBoSung({ toiThieu: "2 set", toiThieuSo: 2, hienCo: 1 }),
    canBoSung({ toiThieu: "1/2 set", toiThieuSo: 0.5, hienCo: 0 }),
    canBoSung({ toiThieu: "01", toiThieuSo: 1, hienCo: null }),
    canBoSung({ toiThieu: "2 set", toiThieuSo: 2, hienCo: 2 }),
  ],
  [{ so: 1, donVi: "set" }, { so: 0.5, donVi: "set" }, null, null]
);
kiemTra("tong hop nhom", tongHopNhom([{ nhom: "A", toiThieuSo: 2, hienCo: 1 }, { nhom: "A", toiThieuSo: 1, hienCo: null }, { nhom: "B", toiThieuSo: 1, hienCo: 1 }]), [
  { nhom: "A", soMuc: 2, soThieu: 1, soChuaCoSo: 1 },
  { nhom: "B", soMuc: 1, soThieu: 0, soChuaCoSo: 0 },
]);
const vn = new Date("2026-09-30T20:00:00Z"); // 03:00 ngày 01/10 giờ Việt Nam
kiemTra(
  "thang theo gio Viet Nam (may chu UTC)",
  [thangHopLe(null, vn), ngayBaoCao("2026-09", vn), thangTuongLai("2026-10", vn), thangTuongLai("2026-11", vn), congThang("2026-01", -1), congThang("2026-12", 1)],
  ["2026-10", "30/09/2026", false, true, "2025-12", "2027-01"]
);

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
  ].map(dongInTu),
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

// Bản in sửa tay trước khi in → xuất Word đúng bản đó (POST /api/export/thiet-yeu).
console.log("\n=== 3b) Ban in sua tay ===");
const dongIn = dongInTu(dong(9, "A. Máy chính", "1", "Cylinder cover", { tonDau: 2, hienCo: 1.5 }));
kiemTra("dongInTu: so thanh chu, null thanh trong", [dongIn.id, dongIn.tonDau, dongIn.nhan, dongIn.hienCo, dongIn.partNo], ["9", "2", "", "1.5", ""]);
kiemTra("COT_IN dung thu tu 9 cot mau", COT_IN.length, 9);
kiemTra("laThieuIn theo chu tren ban in", [laThieuIn({ toiThieu: "01 set", hienCo: "0" }), laThieuIn({ toiThieu: "½ set", hienCo: "0,5" }), laThieuIn({ toiThieu: "01", hienCo: "" })], [true, false, false]);
const banSua = sachBanIn({
  vessel: 1,
  tenTau: "M. ODYSSEY (sua)",
  ngay: "01/10/2026",
  dong: [
    { ...dongIn, moTa: "Cylinder cover <sua>", hienCo: "3" },
    { id: "moi-1", nhom: "", stt: "2", moTa: "Dong them tay", partNo: 7, toiThieu: "01", tonDau: "", nhan: "", tieuThu: "", hienCo: "", viTri: "x".repeat(500) },
  ],
});
kiemTra("sachBanIn nhan ban hop le", banSua?.dong.length, 2);
kiemTra("sachBanIn: nhom trong → '—', so khong phai chu → trong, cat do dai", [banSua?.dong[1].nhom, banSua?.dong[1].partNo, banSua?.dong[1].viTri.length], ["—", "", 120]);
kiemTra("sachBanIn tu choi sai dang", [sachBanIn(null), sachBanIn({ dong: "x" }), sachBanIn({ dong: [1] }), sachBanIn({ dong: new Array(TOI_DA_DONG_IN + 1).fill({}) })], [null, null, null, null]);
const raSua = dienXmlThietYeu(xmlMau, banSua!);
const hangSua = raSua.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0].match(/<w:tr\b[\s\S]*?<\/w:tr>/g)!;
kiemTra("ban sua: tieu de + 2 nhom + 2 dong + 1 trong", hangSua.length, 6);
kiemTra("ban sua: o da sua vao Word", oCua(hangSua[2]).slice(1, 8).map((c) => c.trim()), ["Cylinder cover &lt;sua&gt;", "", "01 set", "2", "", "", "3"]);
kiemTra("ban sua: ten tau / ngay sua tay", chuCua(raSua).includes("M. ODYSSEY (sua)") && chuCua(raSua).includes("01/10/2026"), true);

// ─── 4) Tệp MLS-11-04 thật trên Desktop (nếu có) ───────────────────────────
// Đọc đúng đường app đọc (lib/docWord.ts + ghepHangWord). Thư mục thêm: biến môi trường
// MLS1104_DIR (vd. thư mục báo cáo tháng tàu gửi) — tệp ở đó không vào git.
const desktop = path.join(os.homedir(), "Desktop");
const thuMucThat = [desktop, ...(process.env.MLS1104_DIR ? [process.env.MLS1104_DIR] : [])];
const tepThat = thuMucThat.flatMap((d) => (existsSync(d) ? readdirSync(d).filter((f) => /^MLS-11-04.*\.docx?$/i.test(f)).map((f) => path.join(d, f)) : []));
let mucThat: DongThietYeu[] = [];
async function docThat() {
  if (!tepThat.length) {
    console.log("\n=== 4) Bo qua: khong co tep MLS-11-04 tren Desktop ===");
    return;
  }
  console.log(`\n=== 4) Doc ${tepThat.length} tep MLS-11-04 that ===`);
  for (const tep of tepThat) {
    const f = path.basename(tep);
    const kq = docBangThietYeu(ghepHangWord((await moTepWord(readFileSync(tep))).than()));
    const nhom = gomNhom(kq.muc).map((g) => `${g.nhom.slice(0, 1)}:${g.dong.length}`);
    console.log(`  ${f}: ${kq.muc.length} muc, nhom ${nhom.join(" ")}, tau ${kq.tenTau}, ngay ${kq.ngay ?? "-"}`);
    kiemTra(`${f}: co muc`, kq.muc.length > 40, true);
    const chu = gomNhom(kq.muc).map((g) => g.nhom.slice(0, 1));
    kiemTra(`${f}: nhom A, B, C… dung thu tu`, chu, "ABCDEFGH".slice(0, chu.length).split(""));
    kiemTra(`${f}: moi muc co toi thieu quy doi duoc`, kq.muc.filter((m) => m.toiThieuSo <= 0).map((m) => m.toiThieu), []);
    kiemTra(`${f}: stt nhom A bat dau tu 1`, kq.muc[0].stt, "1");
    kiemTra(`${f}: co ten tau`, Boolean(kq.tenTau), true);
    kiemTra(`${f}: khong con chu "undefined" cua word-extractor`, kq.muc.filter((m) => /undefined/.test(JSON.stringify(m))).length, 0);
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
  const ra = await dienBieuMauThietYeu(mau, { tenTau: "M. ODYSSEY", ngay: "30/09/2026", dong: dongThu.map(dongInTu) });
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
