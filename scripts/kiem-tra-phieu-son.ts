/**
 * Kiểm NHẬP SƠN TỪ PHIẾU GIAO: đọc phiếu theo mẫu MLS-11-05 (số nhận lấy cột
 * S.lượng duyệt, thiếu thì S.lượng yêu cầu + cảnh báo), bảng sơn Excel của nhà
 * cung cấp (hãng / màu / ĐVT / dung tích), lớp chữ PDF (MLS-11-05 và phiếu giao
 * nhà cung cấp), bộ đọc AI chế độ phiếu giao, ghép danh mục sơn, kiểm dòng sửa,
 * gộp dòng, và — trên database thật trong một giao dịch rồi cuộn ngược — nhập
 * vào tồn sơn (loại có sẵn, loại mới cấp mã SON-####, dùng lại loại trùng tên).
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-phieu-son.ts
 */
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import {
  demPhieuSon,
  docDongNhanSon,
  dongLoiKhiNhap,
  dongTuAiSon,
  dongTuChuPhieuGiao,
  dongTuYeuCauFile,
  ghepDongSon,
  gopDongNhap,
  sachDongNhanSon,
  type DongNhanSon,
} from "@/lib/phieuSon";
import { dongTuChuPdfYeuCau } from "@/lib/yeuCauNhap";
import { docPhieuGiaoTuChu } from "@/lib/phieuGiaoParse";
import { chuanHoaKetQuaAi } from "@/lib/docPhieuBangAi";
import { docPhieuSonKhongAi } from "@/lib/phieuSonTep";
import { nhapPhieuSonTx } from "@/lib/phieuSonServer";
import type { SonGhep } from "@/lib/yeuCauSon";

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
const gon = (d: DongNhanSon[]) => d.map((x) => [x.ten, x.hang, x.mau, x.dvt, x.soLuong]);

async function xlsx(luoi: (string | number)[][], ten = "Sheet1"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ten);
  for (const r of luoi) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const SON: SonGhep[] = [
  { id: 1, code: "SON-0001", name: "Hempadur 45143", maker: "Hempel", colorName: "Grey", colorCode: null, uom: "L" },
  { id: 2, code: "SON-0002", name: "Hempadur 45143", maker: "Hempel", colorName: "Red", colorCode: null, uom: "L" },
  { id: 3, code: "SON-0003", name: "Thinner 08450", maker: "Hempel", colorName: null, colorCode: null, uom: "L" },
];

async function main() {
  // ── 1. Excel theo mẫu MLS-11-05 (có cột S.lượng duyệt) ──
  const mls = await xlsx([
    ["MERCURY LINES COMPANY LIMITED", "", "REQUISITION FOR STORES", "", "", "MLS-11-05", ""],
    ["", "", "YÊU CẦU VẬT TƯ", "", "", "Ngày ban hành: 10/01/2024", ""],
    ["Vsl./Tàu:", "M.ODYSSEY", "", "", "Date/Ngày:", "5-Oct-26", ""],
    ["Dept./ Bộ phận:", "DECK", "", "", "Req. No.", "PG-012/2026", ""],
    ["S. No.", "Description", "IMPA Code", "Unit", "R.O.B", "Q'ty. Req.", "Q'ty. App."],
    ["Stt.", "Mô tả", "Mã IMPA", "Đơn vị", "Còn tồn trên tàu", "S.lượng yêu cầu", "S.lượng duyệt"],
    ["1", "Hempadur 45143 Grey", "", "ltr", "20", "120", "100"],
    ["2", "Hempel Thinner 08450", "", "ltr", "5", "40", ""],
    ["3", "Interzone 954 black", "", "ltr", "0", "60", "60"],
    ["", "", "", "", "", "", ""],
    ["Chief Officer", "", "Captain", "", "Tech.&Pur Dept", "", ""],
  ]);
  const k1 = await docPhieuSonKhongAi(mls, "MLS-11-05 phieu giao son.xlsx");
  kiemTra("mls ok", k1.ok && [k1.nguon, k1.soPhieu, k1.ngay, k1.dong.length], ["MLS-11-05", "PG-012/2026", "2026-10-05", 3]);
  if (k1.ok) {
    kiemTra("mls so nhan = duyet, thieu duyet thi yeu cau", k1.dong.map((d) => d.soLuong), [100, 40, 60]);
    kiemTra("mls canh bao dong thieu duyet", k1.dong.map((d) => Boolean(d.canhBao)), [false, true, false]);
  }

  // ── 2. Bảng sơn Excel của nhà cung cấp ──
  const bang = await xlsx([
    ["DELIVERY NOTE DN-5521", "", "", "", "", ""],
    ["Product", "Maker", "Colour", "Unit", "Pack size", "Qty"],
    ["Hempadur 45143", "Hempel", "Grey", "L", "20", "100"],
    ["Hempadur 45143", "Hempel", "Red", "L", "20", "40"],
    ["Thinner 08450", "Hempel", "", "L", "20", "20"],
  ]);
  const k2 = await docPhieuSonKhongAi(bang, "DN-5521.xlsx");
  kiemTra("bang ok", k2.ok && [k2.nguon, k2.dong.length], ["BANG", 3]);
  if (k2.ok) {
    kiemTra("bang dong", gon(k2.dong), [
      ["Hempadur 45143", "Hempel", "Grey", "L", 100],
      ["Hempadur 45143", "Hempel", "Red", "L", 40],
      ["Thinner 08450", "Hempel", null, "L", 20],
    ]);
    kiemTra("bang dung tich", k2.dong.map((d) => d.dungTich), [20, 20, 20]);
    kiemTra("bang ghep (hang + ten + mau)", ghepDongSon(k2.dong, SON).map((d) => d.paintProductId), [1, 2, 3]);
  }
  // Bảng nhà cung cấp CÓ cột số thứ tự: khuôn MLS-11-05 cũng đọc ra đủ dòng (hòa) —
  // không có tiêu đề biểu mẫu nên phải nhường bảng sơn (giữ hãng / màu).
  const bangStt = await xlsx([
    ["No.", "Description", "Maker", "Colour", "Unit", "Qty"],
    ["1", "Hempadur 45143", "Hempel", "Grey", "L", "100"],
    ["2", "Thinner 08450", "Hempel", "", "L", "20"],
  ]);
  const k2b = await docPhieuSonKhongAi(bangStt, "DN-5522.xlsx");
  kiemTra("bang co stt: hoa thi uu tien bang son", k2b.ok && [k2b.nguon, k2b.dong.map((d) => [d.hang, d.mau, d.soLuong])], [
    "BANG",
    [
      ["Hempel", "Grey", 100],
      ["Hempel", null, 20],
    ],
  ]);
  kiemTra("sai duoi", (await docPhieuSonKhongAi(Buffer.from("x"), "a.txt")).ok, false);
  const rong = await docPhieuSonKhongAi(await xlsx([["abc"], ["def"]]), "rong.xlsx");
  kiemTra("excel khong co bang", [rong.ok, !rong.ok && rong.canAi], [false, false]);

  // ── 3. Lớp chữ PDF ──
  const mlsPdf = dongTuChuPdfYeuCau(
    [
      "MERCURY LINES COMPANY LIMITED | REQUISITION FOR STORES | MLS-11-05",
      "S. No. | Description | IMPA Code | Unit | R.O.B | Q'ty. Req. | Q'ty. App.",
      "1 | Hempadur 45143 Grey | ltr | 20 | 120 | 100",
      "2 | Thinner 08450 | ltr | 5 | 40",
    ].join("\n")
  );
  kiemTra("pdf mls: so nhan theo cot duyet", dongTuYeuCauFile(mlsPdf.dong).map((d) => [d.ten, d.soLuong]), [
    ["Hempadur 45143 Grey", 100],
    ["Thinner 08450", 40],
  ]);
  const pg = docPhieuGiaoTuChu(["DELIVERY NOTE No. DN-7788", "1 | Jotamastic 87 Aluminium | 20 | LTR", "2 | Jotun Thinner No.17 | 5 | LTR"].join("\n"));
  const dPg = dongTuChuPhieuGiao(pg.dong);
  kiemTra("pdf phieu giao ncc", dPg.map((d) => [d.soLuong, d.dvt]), [
    [20, "LTR"],
    [5, "LTR"],
  ]);

  // ── 4. Bộ đọc AI (chế độ phiếu giao) ──
  const ai = chuanHoaKetQuaAi({
    nhaCungCap: "Hempel",
    soPhieu: "DN-1",
    ngayGiao: "05/10/2026",
    tau: null,
    dong: [
      { stt: 1, ten: "HEMPADUR 45143 GREY 20L", soLuong: 5, donVi: "can", loai: "STORE", canKiem: false },
      { stt: 2, ten: "Interzone 954", soLuong: null, donVi: "L", loai: "STORE", canKiem: true, lyDoKiem: "mờ" },
    ],
  });
  const dAi = ghepDongSon(dongTuAiSon(ai.dong), SON);
  kiemTra("ai dong", dAi.map((d) => [d.soLuong, d.paintProductId, Boolean(d.canhBao)]), [
    [5, 1, false],
    [null, null, true],
  ]);

  // ── 5. Dòng sửa gửi lên, gộp, kiểm trước khi nhập ──
  const sua = sachDongNhanSon([
    { ten: "Hempadur 45143", paintProductId: "1", soLuong: "60", boQua: false },
    { ten: "Hempadur 45143 Grey (lô 2)", paintProductId: "1", soLuong: "40,5" },
    { ten: "Interzone 954", hang: "International", mau: "Black", dvt: "L", soLuong: "30", paintProductId: "" },
    { ten: "interzone  954", hang: "international", mau: "black", soLuong: "10" },
    { ten: "Rác", soLuong: "", boQua: true },
    { ten: "", paintProductId: "" },
  ]);
  kiemTra("sach ok", sua.ok && sua.dong.length, 5);
  if (sua.ok) {
    kiemTra("dem", demPhieuSon(sua.dong), { tong: 5, nhap: 4, khop: 2, moi: 2, thieuSo: 0, canhBao: 0 });
    kiemTra("gop", gopDongNhap(sua.dong).map((g) => [g.khoa, g.soLuong, g.soDong]), [
      ["id:1", 100.5, 2],
      ["moi:interzone 954|international|black", 40, 2],
    ]);
    kiemTra("kiem truoc khi nhap ok", dongLoiKhiNhap(sua.dong), null);
    kiemTra("doc lai JSON", docDongNhanSon(JSON.parse(JSON.stringify(sua.dong))), sua.dong);
  }
  kiemTra("so sai", sachDongNhanSon([{ ten: "a", soLuong: "abc" }]), { ok: false, n: 1 });
  kiemTra("so am", sachDongNhanSon([{ ten: "a", soLuong: "-2" }]), { ok: false, n: 1 });
  const thieu = sachDongNhanSon([{ ten: "a", soLuong: "3" }, { ten: "b", soLuong: "" }]);
  kiemTra("thieu so khi nhap", thieu.ok && dongLoiKhiNhap(thieu.dong), { n: 2, lyDo: "thieuSo" });

  // ── 6. File mẫu MLS-11-05B thật (Desktop) đọc như phiếu giao ──
  const mauThat = "C:/Users/admin/Desktop/MLS-11-05B YEU CAU VAT TU 4-2026.xlsx";
  if (existsSync(mauThat)) {
    const t = await docPhieuSonKhongAi(readFileSync(mauThat), "MLS-11-05B YEU CAU VAT TU 4-2026.xlsx");
    kiemTra("mau that doc theo MLS-11-05", t.ok && [t.nguon, t.dong.length], ["MLS-11-05", 169]);
  } else console.log("  (bo qua mau that: khong co file tren Desktop)");

  // ── 7. Database thật, cuộn ngược: nhập vào tồn sơn ──
  const tau = await prisma.vessel.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  const sp = await prisma.paintProduct.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, name: true, maker: true, colorName: true } });
  if (!tau || !sp) {
    console.log("  (bo qua kiem DB: chua co tau / danh muc son)");
  } else {
    const tonTruoc = (await prisma.paintStock.findUnique({ where: { vesselId_productId: { vesselId: tau.id, productId: sp.id } } }))?.quantity ?? 0;
    const soLoaiTruoc = await prisma.paintProduct.count();
    const ngay = new Date("2026-10-01T12:00:00");
    try {
      await prisma.$transaction(async (tx) => {
        const dong: DongNhanSon[] = [
          { ten: "x", hang: null, mau: null, maMau: null, ma: null, dvt: null, soLuong: 12.5, dungTich: null, loaiSon: null, paintProductId: sp.id, boQua: false, canhBao: null, ghiChu: null },
          { ten: "Son Thu Kiem Tra ZZQ", hang: "Hang Thu", mau: "Xanh", maMau: null, ma: "ZZQ-1", dvt: "L", soLuong: 20, dungTich: 20, loaiSon: "TOPCOAT", paintProductId: null, boQua: false, canhBao: null, ghiChu: null },
          { ten: "son thu kiem tra zzq", hang: "hang thu", mau: "xanh", maMau: null, ma: null, dvt: "L", soLuong: 5, dungTich: null, loaiSon: null, paintProductId: null, boQua: false, canhBao: null, ghiChu: null },
          { ten: "bo qua", hang: null, mau: null, maMau: null, ma: null, dvt: null, soLuong: 99, dungTich: null, loaiSon: null, paintProductId: sp.id, boQua: true, canhBao: null, ghiChu: null },
        ];
        const kq = await nhapPhieuSonTx(tx, { vesselId: tau.id, dong, ghiChu: "Phiếu giao THU-01", ngayNhan: ngay, nguoi: "Kiểm thử" });
        kiemTra("nhap: tong", [kq.soLoai, kq.soDong, kq.taoMoi, kq.tongSoLuong], [2, 3, 1, 37.5]);
        const moi = kq.sanPham.find((x) => x.taoMoi)!;
        kiemTra("nhap: ma moi SON-####", /^SON-\d{4}$/.test(moi.code), true);
        const spMoi = await tx.paintProduct.findUniqueOrThrow({ where: { id: moi.productId } });
        kiemTra("nhap: loai moi", [spMoi.name, spMoi.maker, spMoi.colorName, spMoi.paintType, spMoi.packSize, spMoi.notes], ["Son Thu Kiem Tra ZZQ", "Hang Thu", "Xanh", "TOPCOAT", 20, "Mã trên phiếu giao: ZZQ-1"]);
        const tonSau = (await tx.paintStock.findUniqueOrThrow({ where: { vesselId_productId: { vesselId: tau.id, productId: sp.id } } })).quantity;
        const tonMoi = (await tx.paintStock.findUniqueOrThrow({ where: { vesselId_productId: { vesselId: tau.id, productId: moi.productId } } })).quantity;
        kiemTra("nhap: ton", [Math.round((tonSau - tonTruoc) * 1000) / 1000, tonMoi], [12.5, 25]);
        const gd = await tx.paintTransaction.findMany({ where: { vesselId: tau.id, note: "Phiếu giao THU-01" }, orderBy: { id: "asc" } });
        kiemTra("nhap: phieu nhap", gd.map((g) => [g.type, g.quantity, g.occurredAt.toISOString().slice(0, 10), g.performedBy]), [
          ["IN", 12.5, "2026-10-01", "Kiểm thử"],
          ["IN", 25, "2026-10-01", "Kiểm thử"],
        ]);
        // Lần nhập sau cùng tên + hãng + màu (khác hoa thường) dùng lại loại vừa tạo.
        const kq2 = await nhapPhieuSonTx(tx, {
          vesselId: tau.id,
          dong: [{ ...dong[1], ten: "SON THU KIEM TRA ZZQ", hang: "HANG THU", mau: "XANH", soLuong: 1 }],
          ghiChu: "Phiếu giao THU-02",
          ngayNhan: ngay,
          nguoi: "Kiểm thử",
        });
        kiemTra("nhap lan 2 dung lai loai", [kq2.taoMoi, kq2.sanPham[0].productId === moi.productId], [0, true]);
        throw new CuonNguoc();
      });
    } catch (e) {
      if (!(e instanceof CuonNguoc)) throw e;
    }
    const tonCuoi = (await prisma.paintStock.findUnique({ where: { vesselId_productId: { vesselId: tau.id, productId: sp.id } } }))?.quantity ?? 0;
    kiemTra("da cuon nguoc", [tonCuoi, await prisma.paintProduct.count()], [tonTruoc, soLoaiTruoc]);
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
