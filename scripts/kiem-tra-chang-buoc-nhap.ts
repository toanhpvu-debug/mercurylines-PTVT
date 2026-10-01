/**
 * Kiểm NHẬP DỤNG CỤ CHẰNG BUỘC TỪ FILE MLS-11-13: đọc dòng "Ship's Name / Port /
 * Date", đọc bảng 10 cột (hàng đánh số 1..7 của mẫu, tiêu đề chữ, khuôn cố định),
 * lớp chữ PDF, chế độ "changBuoc" của bộ đọc AI, đọc file Word / Excel dựng tại
 * chỗ (và mẫu Word thật nếu có trong templates/), ghép với danh mục, và — trên
 * database thật trong một giao dịch rồi cuộn ngược — áp dụng vào danh mục kèm
 * lưu báo cáo.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-chang-buoc-nhap.ts
 */
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import {
  chuanNgay,
  dauChangBuoc,
  docDongChangBuoc,
  dongTuAiChangBuoc,
  dongTuChuPdfChangBuoc,
  dongTuLuoiChangBuoc,
  ghepChangBuoc,
  ngayTuDdMm,
  sachDongChangBuocNhap,
  soO,
  type DongChangBuocNhap,
} from "@/lib/changBuocNhap";
import { CONG_CU_GHI_CHANG_BUOC, chuanHoaKetQuaAi, gopLuot, loiNhac, soatDong } from "@/lib/docPhieuBangAi";
import { docChangBuocKhongAi } from "@/lib/changBuocTep";
import { dienBieuMauChangBuoc } from "@/lib/bieuMauChangBuoc";
import { apDungChangBuocTx } from "@/lib/changBuocServer";

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
class CuonNguoc extends Error {}
const gon = (d: DongChangBuocNhap[]) => d.map((x) => [x.ten, x.kyHieu, x.toiThieu, x.chuan, x.conDung, x.hong, x.yeuCau]);

// Lưới giống bảng Word của mẫu: 4 hàng tiêu đề + hàng đánh số + dữ liệu + chữ ký.
const LUOI_MAU: string[][] = [
  ["No. Stt", "TYPE OF FITTING GEAR Dụng cụ chằng buộc", "PART NO. / MARK Ký hiệu", "Minimum", "Standard", "In Order", "Out of", "Total", "Short of", ""],
  ["", "", "", "Quantity", "Out-fitting", "", "Order", "Stock", "Minium Qtty.", "ORDER"],
  ["", "", "", "for Full Load", "Trang bị", "Còn sử", "", "Toàn bộ", "SL. thiếu", ""],
  ["", "", "", "SL.tối thiểu", "Chuẩn", "dụng được", "Bị hỏng", "có trên tàu", "tối thiểu", "yêu cầu"],
  ["", "", "", "1", "2", "3", "4", "5=(3+4)", "6=(1-3)", "7"],
  ["1", "Twistlock (semi-auto)", "SAT-1", "200", "220", "180", "20", "200", "20", "40"],
  ["2", "Lashing bar 4.5m", "LB-45", "120", "150", "150", "-", "150", "", ""],
  ["3", "Turnbuckle", "", "120", "150", "140", "5", "150", "", "5"],
  ["4", "", "", "", "", "", "", "", "", ""],
  ["5", "", "", "", "", "", "", "", "", ""],
  ["Người kiểm kê", "", "", "Đại Phó", "", "", "", "Thuyền Trưởng", "", ""],
];

async function main() {
  // ─── 1) Phần thuần ─────────────────────────────────────────────────────────
  console.log("\n=== 1) Dau bieu mau, so ===");
  kiemTra(
    "dau mau trong (dau cham cho)",
    dauChangBuoc("Ship's Name (Tên tàu): . . . . . . . . . . . . . . \tPort (Cảng): . . . . . . . . .    \tDate (Ngày): . . / . . / . . . "),
    { tenTau: null, cang: null, ngay: null }
  );
  kiemTra("dau da dien", dauChangBuoc("Ship's Name (Tên tàu): MERCURY STAR \tPort (Cảng): HAI PHONG \tDate (Ngày): 5/9/26"), { tenTau: "MERCURY STAR", cang: "HAI PHONG", ngay: "05/09/2026" });
  kiemTra("dau dau nhay cong", dauChangBuoc("Ship’s Name: M.V ATLAS  Port: Singapore  Date: 12.10.2026"), { tenTau: "M.V ATLAS", cang: "Singapore", ngay: "12/10/2026" });
  kiemTra("chuan ngay", [chuanNgay("1/2/2026"), chuanNgay("31/13/2026"), ngayTuDdMm("05/09/2026")?.getDate(), ngayTuDdMm("31/02/2026")], ["01/02/2026", null, 5, null]);
  kiemTra("o so", [soO("12"), soO("1.250"), soO("2,5"), soO("-"), soO(""), soO("abc")], [12, 1250, 2.5, 0, null, null]);

  console.log("\n=== 2) Doc bang ===");
  const a = dongTuLuoiChangBuoc(LUOI_MAU);
  kiemTra(
    "bang theo hang danh so: 3 dong, bo dong mau trong, dung o chu ky",
    "loi" in a ? a.loi : [gon(a.dong), a.boQua],
    [
      [
        ["Twistlock (semi-auto)", "SAT-1", 200, 220, 180, 20, 40],
        ["Lashing bar 4.5m", "LB-45", 120, 150, 150, 0, null],
        ["Turnbuckle", null, 120, 150, 140, 5, 5],
      ],
      0,
    ]
  );
  kiemTra("canh bao tong lech (150 != 140+5)", "loi" in a ? a.loi : [a.dong[0].canhBao, a.dong[2].canhBao?.startsWith("Cột toàn bộ (150)")], [null, true]);
  // Excel gộp ô: tiêu đề chỉ ở ô đầu, cột lệch sang phải một ô (cột A trống).
  const lech = LUOI_MAU.map((r) => ["", ...r]);
  const b = dongTuLuoiChangBuoc(lech);
  kiemTra("lech mot cot van dung", "loi" in b ? b.loi : gon(b.dong)[0], ["Twistlock (semi-auto)", "SAT-1", 200, 220, 180, 20, 40]);
  // Không có hàng đánh số: nhận theo chữ tiêu đề.
  const c = dongTuLuoiChangBuoc([
    ["No.", "Description", "Mark", "Min. Qty", "Standard", "In order", "Out of order", "Total", "Order"],
    ["1", "Stacking cone", "SC-2", "80", "100", "90", "2", "92", "8"],
  ]);
  kiemTra("theo chu tieu de", "loi" in c ? c.loi : gon(c.dong), [["Stacking cone", "SC-2", 80, 100, 90, 2, 8]]);
  // Không tiêu đề (lớp chữ tách ô đủ 10 cột).
  const d = dongTuLuoiChangBuoc([["7", "Bridge fitting", "BF-1", "40", "48", "46", "2", "48", "0", "2"]]);
  kiemTra("khuon 10 cot co dinh", "loi" in d ? d.loi : gon(d.dong), [["Bridge fitting", "BF-1", 40, 48, 46, 2, 2]]);
  kiemTra("mau trong -> loi", "loi" in dongTuLuoiChangBuoc(LUOI_MAU.slice(0, 5).concat([["1", "", "", "", "", "", "", "", "", ""]])), true);
  kiemTra("khong phai MLS-11-13 -> loi", "loi" in dongTuLuoiChangBuoc([["Item", "Qty"], ["Rags", "5"]]), true);
  const pdf = dongTuChuPdfChangBuoc("Ship's Name: X\n1 Twistlock semi-auto 200 220 180 20 200 20 40\n2 Lashing bar 120 150 150 - 150\nCaptain");
  kiemTra(
    "lop chu PDF: so theo thu tu, co canh bao",
    pdf.map((x) => [x.ten, x.toiThieu, x.chuan, x.conDung, x.hong, x.yeuCau, Boolean(x.canhBao)]),
    [
      ["Twistlock semi-auto", 200, 220, 180, 20, 40, true],
      ["Lashing bar", 120, 150, 150, 0, null, true],
    ]
  );

  console.log("\n=== 3) Ghep danh muc, dong nhap ===");
  const gears = [
    { id: 1, name: "Twistlock (Semi-Auto)", partNo: null, minQty: 200, standardQty: 220 },
    { id: 2, name: "Lashing rod", partNo: "LB-45", minQty: 100, standardQty: 150 },
    { id: 3, name: "Turnbuckle", partNo: "TB", minQty: 120, standardQty: 150 },
  ];
  const dongMau = "loi" in a ? [] : a.dong;
  const them = [...dongMau, { ...dongMau[0], ten: "TWISTLOCK semi auto" }, { ...dongMau[2], ten: "Penguin hook", boQua: true }];
  kiemTra(
    "ghep: ten (bo dau cau, hoa thuong), ky hieu, trung, bo qua",
    ghepChangBuoc(them, gears, true).map((g) => [g.trangThai, g.gearId, g.thayDoi]),
    [
      ["CAP_NHAT", 1, ["ký hiệu — → SAT-1"]],
      ["CAP_NHAT", 2, ["tối thiểu 100 → 120"]],
      ["GIONG", 3, []],
      ["TRUNG", null, []],
      ["BO_QUA", null, []],
    ]
  );
  kiemTra("ghep khong cap nhat so", ghepChangBuoc(dongMau, gears, false).map((g) => g.trangThai), ["CAP_NHAT", "GIONG", "GIONG"]);
  kiemTra("dong moi", ghepChangBuoc([{ ...dongMau[0], ten: "Lashing D-ring", kyHieu: null }], gears, true)[0].trangThai, "MOI");
  const nhap = sachDongChangBuocNhap([
    { ten: "  Twistlock  ", kyHieu: "SAT-1", toiThieu: "200", chuan: "", conDung: "1.5", hong: "-", yeuCau: "" },
    { ten: "", toiThieu: "5" },
  ]);
  kiemTra("dong nhap sach", nhap.ok ? nhap.dong.map((x) => [x.ten, x.toiThieu, x.chuan, x.conDung, x.hong]) : nhap, [["Twistlock", 200, null, 1.5, 0]]);
  kiemTra("dong nhap so sai -> bao dong", sachDongChangBuocNhap([{ ten: "a", toiThieu: "1" }, { ten: "b", hong: "abc" }]), { ok: false, n: 2 });
  kiemTra("doc JSON bo phan tu hong", docDongChangBuoc([{ ten: "x", toiThieu: "1" }, null, { toiThieu: 3 }]).map((x) => [x.ten, x.toiThieu]), [["x", null]]);

  console.log("\n=== 4) Bo doc AI (che do changBuoc) ===");
  const ai = chuanHoaKetQuaAi({
    tau: "MERCURY STAR",
    cang: "Hai Phong",
    ngayGiao: "05/09/2026",
    dong: [
      { stt: 1, ten: "Twistlock (semi-auto)", partNo: "SAT-1", toiThieu: 200, chuan: "220", conDung: 180, hong: "-", tong: 180, thieu: 20, yeuCau: 40 },
      { stt: 2, ten: "Lashing bar", toiThieu: null, chuan: 150, conDung: 150, hong: 0 },
    ],
  });
  kiemTra("AI: cang + cot so", [ai.cang, ai.dong.map((x) => x.cb)], [
    "Hai Phong",
    [
      { toiThieu: 200, chuan: 220, conDung: 180, hong: 0, tong: 180, thieu: 20, yeuCau: 40 },
      { toiThieu: null, chuan: 150, conDung: 150, hong: 0, tong: null, thieu: null, yeuCau: null },
    ],
  ]);
  kiemTra("AI: soat khong doi so luong / don vi cho dong chang buoc", soatDong(ai.dong).map((x) => x.canhBao), [null, null]);
  const doiSo = gopLuot(ai.dong, [{ ...ai.dong[0], cb: { ...ai.dong[0].cb!, conDung: 170 } }, ai.dong[1]]);
  kiemTra("AI: luot kiem lai sua cot so -> canh bao", doiSo[0].canhBao?.startsWith("Lượt kiểm lại sửa cột số"), true);
  kiemTra(
    "AI -> dong nhap",
    dongTuAiChangBuoc(ai.dong).map((x) => [x.ten, x.kyHieu, x.toiThieu, x.chuan, x.conDung, x.hong, x.yeuCau]),
    [
      ["Twistlock (semi-auto)", "SAT-1", 200, 220, 180, 0, 40],
      ["Lashing bar", null, null, 150, 150, 0, null],
    ]
  );
  const tt = CONG_CU_GHI_CHANG_BUOC.input_schema.properties;
  kiemTra("cong cu co du cot", ["cang", "tau", "ngayGiao"].every((k) => k in tt) && ["toiThieu", "chuan", "conDung", "hong", "tong", "thieu", "yeuCau"].every((k) => k in tt.dong.items.properties), true);
  kiemTra("loi nhac + luot 2 gui cot so", [/chằng buộc/.test(loiNhac(null, null, "changBuoc")), loiNhac(null, ai.dong, "changBuoc").includes('"conDung":180')], [true, true]);
  kiemTra("phieu giao khong co cb", "cb" in chuanHoaKetQuaAi({ dong: [{ ten: "Rags", soLuong: 5 }] }).dong[0], false);

  console.log("\n=== 5) Doc file ===");
  // Word dựng tại chỗ: một đoạn Ship's Name + bảng giống mẫu.
  const o = (s: string) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${s.replace(/&/g, "&amp;")}</w:t></w:r></w:p></w:tc>`;
  const docXml =
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    `<w:p><w:r><w:t xml:space="preserve">Ship's Name (Tên tàu): MERCURY OCEAN </w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Port (Cảng): VUNG TAU </w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Date (Ngày): 20/09/2026</w:t></w:r></w:p>` +
    `<w:tbl>${LUOI_MAU.map((r) => `<w:tr>${r.map(o).join("")}</w:tr>`).join("")}</w:tbl></w:body></w:document>`;
  const zip = new JSZip();
  zip.file("word/document.xml", docXml);
  const kw = await docChangBuocKhongAi(await zip.generateAsync({ type: "nodebuffer" }), "mls-11-13.docx");
  kiemTra("Word: dau + 3 dong", kw.ok ? [kw.dau, kw.dong.length, kw.dong[0].kyHieu] : kw.loi, [{ tenTau: "MERCURY OCEAN", cang: "VUNG TAU", ngay: "20/09/2026" }, 3, "SAT-1"]);
  // Excel: dòng Ship's Name trên cùng, bảng bắt đầu từ cột B.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("MLS-11-13");
  ws.addRow(["", "Ship's Name (Tên tàu): MERCURY GLORY", "", "", "Port (Cảng): CAI MEP", "", "", "Date (Ngày): 01/10/2026"]);
  ws.addRow([]);
  for (const r of LUOI_MAU) ws.addRow(["", ...r]);
  const ke = await docChangBuocKhongAi(Buffer.from(await wb.xlsx.writeBuffer()), "mls-11-13.xlsx");
  kiemTra("Excel: dau + dong", ke.ok ? [ke.dau, gon(ke.dong)[1]] : ke.loi, [{ tenTau: "MERCURY GLORY", cang: "CAI MEP", ngay: "01/10/2026" }, ["Lashing bar 4.5m", "LB-45", 120, 150, 150, 0, null]]);
  kiemTra("duoi la -> loi", (await docChangBuocKhongAi(Buffer.from("x"), "a.txt")).ok, false);
  kiemTra("file hong -> loi, khong nem", (await docChangBuocKhongAi(Buffer.from("not a zip"), "a.docx")).ok, false);
  // Mẫu Word THẬT của công ty (gitignore, có thì kiểm): xuất bằng chức năng sẵn có rồi đọc ngược.
  if (existsSync("templates/MLS-11-13.docx")) {
    const ra = await dienBieuMauChangBuoc(readFileSync("templates/MLS-11-13.docx"), {
      tenTau: "MERCURY STAR",
      cang: "HAI PHONG",
      ngay: "05/09/2026",
      dong: [
        { stt: 1, ten: "Twistlock (semi-auto)", kyHieu: "SAT-1", toiThieu: 200, chuan: 220, conDung: 180, hong: 20, tong: 200, thieu: 20, yeuCau: 40 },
        { stt: 2, ten: "Lashing bar 4.5m", kyHieu: "LB-45", toiThieu: 120, chuan: 150, conDung: 150, hong: 0, tong: 150, thieu: 0, yeuCau: 0 },
      ],
    });
    const kt = await docChangBuocKhongAi(ra, "that.docx");
    kiemTra("mau Word that: xuat roi doc nguoc", kt.ok ? [kt.dau, gon(kt.dong)] : kt.loi, [
      { tenTau: "MERCURY STAR", cang: "HAI PHONG", ngay: "05/09/2026" },
      [
        ["Twistlock (semi-auto)", "SAT-1", 200, 220, 180, 20, 40],
        ["Lashing bar 4.5m", "LB-45", 120, 150, 150, 0, 0],
      ],
    ]);
  } else console.log("  (bo qua mau Word that: chua co templates/MLS-11-13.docx)");

  console.log("\n=== 6) Database (cuon nguoc) ===");
  const tau = await prisma.vessel.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (!tau) console.log("  (bo qua: chua co tau)");
  else {
    try {
      await prisma.$transaction(async (tx) => {
        const tem = `KT-${Date.now()}`;
        const g1 = await tx.lashingGear.create({ data: { vesselId: tau.id, name: `${tem} Twistlock`, partNo: null, minQty: 10, standardQty: 12, sortOrder: 900000 } });
        await tx.lashingGear.create({ data: { vesselId: tau.id, name: `${tem} Lashing rod`, partNo: `${tem}-LR`, minQty: 5, standardQty: 6, sortOrder: 900001 } });
        const dong: DongChangBuocNhap[] = [
          { ten: `${tem} twistlock`, kyHieu: `${tem}-TL`, toiThieu: 11, chuan: 12, conDung: 9, hong: 1, yeuCau: 2, canhBao: null, trang: null, boQua: false },
          { ten: `${tem} Lashing rod 2`, kyHieu: `${tem}-LR`, toiThieu: 5, chuan: 6, conDung: null, hong: null, yeuCau: null, canhBao: null, trang: null, boQua: false },
          { ten: `${tem} D-ring`, kyHieu: null, toiThieu: 4, chuan: 4, conDung: 4, hong: 0, yeuCau: null, canhBao: null, trang: null, boQua: false },
          { ten: `${tem} D-ring`, kyHieu: null, toiThieu: 9, chuan: 9, conDung: 9, hong: 0, yeuCau: null, canhBao: null, trang: null, boQua: false },
          { ten: `${tem} Bo qua`, kyHieu: null, toiThieu: 1, chuan: 1, conDung: 1, hong: 0, yeuCau: null, canhBao: null, trang: null, boQua: true },
        ];
        const kq = await apDungChangBuocTx(tx, { vesselId: tau.id, dong, capNhatSo: true, taoBaoCao: true, ngay: new Date("2026-09-05T12:00:00"), cang: "HAI PHONG", nguoi: "kiem thu" });
        kiemTra("ket qua dem", [kq.them, kq.capNhat, kq.giong, kq.trung, kq.boQua, kq.soDongBaoCao, kq.reportId !== null], [1, 1, 1, 1, 1, 2, true]);
        const g1Sau = await tx.lashingGear.findUniqueOrThrow({ where: { id: g1.id } });
        kiemTra("cap nhat ky hieu + toi thieu", [g1Sau.partNo, g1Sau.minQty, g1Sau.standardQty], [`${tem}-TL`, 11, 12]);
        const moi = await tx.lashingGear.findFirst({ where: { vesselId: tau.id, name: `${tem} D-ring` } });
        kiemTra("them moi (thu tu sau cung)", [moi?.minQty, moi?.standardQty, (moi?.sortOrder ?? 0) > 900001], [4, 4, true]);
        const bc = await tx.lashingReport.findUniqueOrThrow({ where: { id: kq.reportId! }, include: { lines: { orderBy: { id: "asc" } } } });
        kiemTra(
          "bao cao: chi dong co so, chup ten / chuan luc do",
          [bc.position, bc.lines.map((l) => [l.gearName, l.inOrder, l.outOfOrder, l.minQty])],
          ["HAI PHONG", [[`${tem} Twistlock`, 9, 1, 11], [`${tem} D-ring`, 4, 0, 4]]]
        );
        const kq2 = await apDungChangBuocTx(tx, { vesselId: tau.id, dong, capNhatSo: true, taoBaoCao: false, ngay: new Date(), cang: null, nguoi: "kiem thu" });
        kiemTra("ap lan hai: khong them trung", [kq2.them, kq2.reportId], [0, null]);
        throw new CuonNguoc();
      });
    } catch (e) {
      if (!(e instanceof CuonNguoc)) throw e;
    }
  }

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  await prisma.$disconnect();
  if (truot) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
