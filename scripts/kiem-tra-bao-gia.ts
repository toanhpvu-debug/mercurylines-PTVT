/**
 * Kiểm BÁO GIÁ NHÀ CUNG CẤP → ĐƠN MUA → DUYỆT: phần thuần (lib/baoGia.ts,
 * lib/donMuaQuyTrinh.ts), chế độ "báo giá" của bộ đọc AI, đọc file Excel /
 * Word dựng tại chỗ, file Excel PO xuất ra, và — trên database thật trong một
 * giao dịch rồi cuộn ngược — cấp số PO, chuyển trạng thái có điều kiện, bảng
 * BaoGiaNcc / TepDonMua.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-bao-gia.ts
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import { dauTuHang, docDongBaoGia, dongTuBang, ghepVaoDonMua, ngayTuDdMm, sachDongBaoGiaNhap, tongBaoGia } from "@/lib/baoGia";
import { LAP_DON_MUA, PO_DUOC_TU, daDuyet, duocChuyen, laNhap, thuGuiNcc, tongDonMua } from "@/lib/donMuaQuyTrinh";
import { CONG_CU_GHI_BAO_GIA, chuanHoaKetQuaAi, loiNhac } from "@/lib/docPhieuBangAi";
import { docBaoGiaKhongAi } from "@/lib/baoGiaTep";
import { taoExcelDonMua } from "@/lib/xuatDonMuaExcel";
import { sinhSoDonMua } from "@/lib/soDonMua";

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

// Báo giá mẫu kiểu Anh: đầu thư, bảng có dòng nhóm, dòng thiếu đơn giá, dòng tổng.
const BANG_EN: string[][] = [
  ["GOLDEN MARINE SUPPLY CO., LTD", "", "", "", "", "", ""],
  ["QUOTATION No.: GMS-Q2609/118", "", "", "", "Date: 5/9/26", "", ""],
  ["", "", "", "", "", "", ""],
  ["No.", "Description", "Part No.", "Unit", "Q'ty", "Unit Price (USD)", "Amount"],
  ["", "MAIN ENGINE SPARES", "", "", "", "", ""],
  ["1", "Piston ring set", "21001-1234", "set", "2", "1,250.00", "2,500.00"],
  ["2", "O-ring 120x5", "OR-120", "pcs", "10", "", "35.00"],
  ["3", "Fuel injector nozzle", "FIN-77", "pcs", "4", "300", "1,250.00"],
  ["", "Sub-total", "", "", "", "", "3,785.00"],
  ["4", "Should not be read", "X", "pcs", "1", "1", "1"],
];

async function main() {
  // ─── 1) Đọc bảng báo giá ───────────────────────────────────────────────────
  console.log("\n=== 1) Doc bang bao gia ===");
  const en = dongTuBang(BANG_EN);
  if ("loi" in en) throw new Error(en.loi);
  kiemTra("so dong (dung o Sub-total, bo dong nhom)", en.dong.length, 3);
  kiemTra("dong nhom tinh vao boQua", en.boQua, 1);
  kiemTra(
    "dong 1",
    [en.dong[0].moTa, en.dong[0].partNo, en.dong[0].donVi, en.dong[0].soLuong, en.dong[0].donGia, en.dong[0].canhBao],
    ["Piston ring set", "21001-1234", "SET", 2, 1250, null]
  );
  kiemTra("don gia suy tu thanh tien", [en.dong[1].donGia, en.dong[1].canhBao], [3.5, "Đơn giá suy ra từ thành tiền / số lượng"]);
  kiemTra("thanh tien lech -> canh bao", en.dong[2].canhBao?.startsWith("Thành tiền trên báo giá (1250)"), true);
  kiemTra("dau bao gia", en.dau, { nhaCungCap: "GOLDEN MARINE SUPPLY CO., LTD", soBaoGia: "GMS-Q2609/118", ngayBaoGia: "05/09/2026", tienTe: "USD" });

  const vn = dongTuBang([
    ["CÔNG TY TNHH THƯƠNG MẠI HẢI NAM", "", "", "", ""],
    ["BÁO GIÁ số: BG-0912", "", "", "", "Ngày: 12.09.2026"],
    ["STT", "Tên hàng", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền", "Ghi chú"],
    ["1", "Dây cáp thép 16mm", "m", "200", "45.000", "9.000.000", "Hàng có sẵn"],
    ["2", "Ma ní 3/4\"", "cái", "12", "85.000", "1.020.000", ""],
    ["Cộng", "", "", "", "", "10.020.000", ""],
  ]);
  if ("loi" in vn) throw new Error(vn.loi);
  kiemTra(
    "bang tieng Viet",
    vn.dong.map((d) => [d.moTa, d.donVi, d.soLuong, d.donGia, d.ghiChu]),
    [
      ["Dây cáp thép 16mm", "M", 200, 45000, "Hàng có sẵn"],
      ["Ma ní 3/4\"", "CÁI", 12, 85000, null],
    ]
  );
  kiemTra("dau tieng Viet (VND tu chu 'dong' khong co -> null)", [vn.dau.soBaoGia, vn.dau.ngayBaoGia, vn.dau.nhaCungCap], ["BG-0912", "12/09/2026", "CÔNG TY TNHH THƯƠNG MẠI HẢI NAM"]);
  kiemTra("tien te VND tu chu", dauTuHang([["Đơn giá (VNĐ)"]]).tienTe, "VND");
  kiemTra("khong co bang -> loi", "loi" in dongTuBang([["Dear Sir"], ["Thank you"]]), true);
  kiemTra("co bang nhung khong dong hang -> loi", "loi" in dongTuBang([["Description", "Qty"], ["Total", "5"]]), true);
  kiemTra("IMPA 6 so giu, khac bo", (() => {
    const r = dongTuBang([["Description", "IMPA", "Qty", "Price"], ["Rags", "190405", "5", "2"], ["Gloves", "19-04", "3", "1"]]);
    return "loi" in r ? r.loi : r.dong.map((d) => d.impa);
  })(), ["190405", null]);

  // ─── 2) Tổng, ghép PO, chuẩn hóa dòng nhập ─────────────────────────────────
  console.log("\n=== 2) Cong tien, ghep PO, dong nhap ===");
  kiemTra("tong bao gia", tongBaoGia([{ soLuong: 2, donGia: 1250, boQua: false }, { soLuong: 10, donGia: 3.5, boQua: false }, { soLuong: 99, donGia: 99, boQua: true }], 5, 20, 15), {
    cong: 2535,
    giam: 126.75,
    tong: 2443.25,
  });
  const items = [
    { id: 11, description: "PISTON RING SET FOR M/E", partNo: "21001-1234" },
    { id: 12, description: "Fuel injector nozzle", partNo: null },
    { id: 13, description: "Cotton rags", partNo: "190405" },
    { id: 14, description: "Spare O-ring", partNo: null },
  ];
  kiemTra(
    "ghep: part no, mo ta trung, IMPA, khong khop, moi dong PO mot lan",
    ghepVaoDonMua(
      [
        { moTa: "Piston ring", partNo: "21001 1234", impa: null },
        { moTa: "fuel injector nozzle", partNo: null, impa: null },
        { moTa: "Rags", partNo: null, impa: "190405" },
        { moTa: "Gasket", partNo: null, impa: null },
        { moTa: "Piston ring set 2", partNo: "21001-1234", impa: null },
      ],
      items
    ),
    [11, 12, 13, null, null]
  );
  kiemTra("ghep: mo ta chua nhau khi du dai", ghepVaoDonMua([{ moTa: "Piston ring set", partNo: null, impa: null }], items), [11]);
  kiemTra("ghep: mo ta ngan khong ghep long", ghepVaoDonMua([{ moTa: "O-ring", partNo: null, impa: null }], items), [null]);
  const nhap = sachDongBaoGiaNhap([
    { moTa: "  Piston   ring ", soLuong: "2", donGia: "1,250.5", donVi: "set", impa: "12", boQua: false },
    { moTa: "", soLuong: "5" },
    { moTa: "Rags", soLuong: "", donGia: "", impa: "190405", boQua: true },
  ]);
  kiemTra(
    "dong nhap sach",
    nhap.ok ? nhap.dong.map((d) => [d.moTa, d.soLuong, d.donGia, d.donVi, d.impa, d.boQua]) : nhap,
    [
      ["Piston ring", 2, 1250.5, "SET", null, false],
      ["Rags", null, null, "PCS", "190405", true],
    ]
  );
  kiemTra("dong nhap so sai -> bao dung dong", sachDongBaoGiaNhap([{ moTa: "a", soLuong: "1" }, { moTa: "b", donGia: "-3" }]), { ok: false, n: 2 });
  kiemTra("doc dong JSON bo phan tu hong", docDongBaoGia([{ moTa: "x", soLuong: 1, donGia: "abc" }, null, { soLuong: 3 }]).map((d) => [d.moTa, d.donGia, d.donVi]), [["x", null, "PCS"]]);
  kiemTra("ngay dd/mm/yyyy", [ngayTuDdMm("05/09/2026")?.getDate(), ngayTuDdMm("31/02/2026"), ngayTuDdMm("2026-09-05")], [5, null, null]);

  // ─── 3) Quy trình đơn mua ──────────────────────────────────────────────────
  console.log("\n=== 3) Quy trinh don mua ===");
  kiemTra("nhap -> trinh", duocChuyen("DRAFT", "PENDING_APPROVAL"), true);
  kiemTra("nhap -> gui NCC thang: khong", duocChuyen("DRAFT", "SENT"), false);
  kiemTra("cho duyet -> gui: khong", duocChuyen("PENDING_APPROVAL", "SENT"), false);
  kiemTra("da duyet -> gui", duocChuyen("APPROVED", "SENT"), true);
  kiemTra("gui -> NCC xac nhan", duocChuyen("SENT", "CONFIRMED"), true);
  kiemTra("tra lai / rut lai -> nhap", duocChuyen("PENDING_APPROVAL", "DRAFT"), true);
  kiemTra("da duyet khong ve nhap (phai huy)", duocChuyen("APPROVED", "DRAFT"), false);
  kiemTra("da nhan hang khong huy", duocChuyen("RECEIVED", "CANCELLED"), false);
  kiemTra("chi nhap moi sua", [laNhap("DRAFT"), laNhap("PENDING_APPROVAL"), laNhap("APPROVED")], [true, false, false]);
  kiemTra("da duyet", [daDuyet("DRAFT"), daDuyet("PENDING_APPROVAL"), daDuyet("APPROVED"), daDuyet("CONFIRMED")], [false, false, true, true]);
  // Ai duyệt (lãnh đạo được chỉ định, ủy quyền, tự duyệt): scripts/kiem-tra-duyet-po.ts.
  kiemTra("vai tro lap PO", [LAP_DON_MUA.includes("MASTER"), LAP_DON_MUA.includes("PURCHASER"), LAP_DON_MUA.includes("TECH_MANAGER")], [true, true, false]);
  kiemTra("tong don", tongDonMua([{ quantity: 2, unitPrice: 1250 }, { quantity: 3, unitPrice: 0.335 }], 10, 50, 0), { cong: 2501.01, giam: 250.1, sauGiam: 2250.91, tong: 2300.91 });
  const thu = thuGuiNcc({ poNo: "PO-MLS001-26-0007", congTy: "MERCURY", tau: "ODYSSEY", tong: "2,300.91", tienTe: "USD", lienHe: null });
  kiemTra("thu gui NCC", [thu.tieuDe, thu.noiDung.startsWith("Dear Sirs,"), thu.noiDung.includes("PO-MLS001-26-0007 for MV ODYSSEY (total 2,300.91 USD)")], ["Purchase Order PO-MLS001-26-0007 — MERCURY", true, true]);

  // ─── 4) Bộ đọc AI — chế độ báo giá ─────────────────────────────────────────
  console.log("\n=== 4) Bo doc AI (bao gia) ===");
  const ai = chuanHoaKetQuaAi({
    nhaCungCap: "Golden Marine",
    soPhieu: "Q-118",
    tienTe: "usd",
    dong: [
      { ten: "Piston ring set", partNo: "21001-1234", soLuong: 2, donVi: "set", donGia: "1.250,00" },
      { ten: "O-ring", soLuong: "10", donVi: "pcs", donGia: 3.5 },
      { ten: "Nozzle", soLuong: 4, donVi: "pcs", donGia: "abc" },
    ],
  });
  kiemTra("AI don gia + tien te", [ai.tienTe, ai.dong.map((d) => d.donGia)], ["USD", [1250, 3.5, null]]);
  const thuocTinh = (CONG_CU_GHI_BAO_GIA as { input_schema?: { properties?: Record<string, { items?: { properties?: Record<string, unknown> } }> } }).input_schema?.properties;
  kiemTra("cong cu bao gia co donGia + tienTe", [Boolean(thuocTinh?.dong?.items?.properties?.donGia), Boolean(thuocTinh?.tienTe)], [true, true]);
  kiemTra("loi nhac bao gia nhac don gia", /đơn giá|unit price/i.test(loiNhac(null, null, "baoGia")), true);

  // ─── 5) Đọc file báo giá (Excel / Word dựng tại chỗ) ───────────────────────
  console.log("\n=== 5) Doc file bao gia ===");
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Cover").addRows([["Thank you for your enquiry"], ["Valid 30 days"]]);
  wb.addWorksheet("Quotation").addRows(BANG_EN);
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
  const kx = await docBaoGiaKhongAi(xlsx, "Quote GMS.xlsx");
  kiemTra("Excel: chon sheet co bang", kx.ok ? [kx.dong.length, kx.dau.soBaoGia, kx.ghiChu.includes('sheet "Quotation"')] : kx.loi, [3, "GMS-Q2609/118", true]);

  const o = (s: string) => `<w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">${s.replace(/&/g, "&amp;")}</w:t></w:r></w:p></w:tc>`;
  const hang = (r: string[]) => `<w:tr>${r.map(o).join("")}</w:tr>`;
  const docXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    `<w:p><w:r><w:t>HAI NAM TRADING CO., LTD</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Our ref: HN-2026-55</w:t></w:r><w:r><w:tab/><w:t>Date: 20/09/2026</w:t></w:r></w:p>` +
    `<w:tbl><w:tblPr/>${hang(["Item", "Description", "Unit", "Qty", "Unit price (SGD)", "Total"])}${hang(["1", "Gear oil 20L", "pail", "3", "120", "360"])}${hang(["2", "Grease & lube", "kg", "5", "8.5", "42.5"])}${hang(["", "Grand total", "", "", "", "402.5"])}</w:tbl>` +
    `</w:body></w:document>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
  zip.file("word/document.xml", docXml);
  const docx = await zip.generateAsync({ type: "nodebuffer" });
  const kd = await docBaoGiaKhongAi(docx, "bao-gia.docx");
  kiemTra(
    "Word: bang + dau ngoai bang",
    kd.ok ? [kd.dong.map((d) => [d.moTa, d.soLuong, d.donGia]), kd.dau] : kd.loi,
    [
      [
        ["Gear oil 20L", 3, 120],
        ["Grease & lube", 5, 8.5],
      ],
      { nhaCungCap: "HAI NAM TRADING CO., LTD", soBaoGia: "HN-2026-55", ngayBaoGia: "20/09/2026", tienTe: "SGD" },
    ]
  );
  kiemTra("duoi file la -> loi", (await docBaoGiaKhongAi(xlsx, "a.txt")).ok, false);
  kiemTra("file hong -> loi, khong nem", (await docBaoGiaKhongAi(Buffer.from("not a zip"), "x.docx")).ok, false);

  // ─── 6) File Excel PO ──────────────────────────────────────────────────────
  console.log("\n=== 6) Excel PO ===");
  const du = {
    poNo: "PO-MLS001-26-0007",
    ngay: "01/10/2026",
    tienTe: "USD",
    tieuDe: "Spare parts for M/E",
    yRef: "GMS-Q2609/118",
    ghiChu: "Delivery onboard at Hai Phong",
    chietKhau: 5,
    phiVanChuyen: 20,
    phiGiaoHang: 15,
    dong: [
      { moTa: "Piston ring set", partNo: "21001-1234", donVi: "SET", soLuong: 2, donGia: 1250 },
      { moTa: "O-ring 120x5", partNo: null, donVi: "PCS", soLuong: 10, donGia: 3.5 },
    ],
    ncc: { ten: "Golden Marine Supply", diaChi: null, dienThoai: null, lienHe: "Mr. Lam", email: null },
    tau: { ten: "ODYSSEY", hullNo: null, imo: null },
    congTy: { ten: "TEST SHIPPING CO.", diaChi: "Test address", vpDaiDien: null, lienLac: null },
    logo: null,
    nguoiLap: "Thuyền trưởng",
    ngayLap: "30/09/2026",
    nguoiDuyet: "Trưởng phòng KT-VT",
    ngayDuyet: "01/10/2026",
    nccXacNhan: null,
  };
  const docLai = async (b: Buffer) => {
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(b as unknown as ArrayBuffer);
    const ws = w.worksheets[0];
    const chu: string[] = [];
    ws.eachRow((r) => r.eachCell((c) => chu.push(typeof c.value === "object" && c.value && "formula" in c.value ? `=${c.value.formula}` : String(c.value ?? ""))));
    return chu;
  };
  const chuDuyet = await docLai(await taoExcelDonMua({ ...du, daDuyet: true }));
  kiemTra("PO Excel co so PO, NCC, dong, nguoi duyet", ["PO-MLS001-26-0007", "Piston ring set", "21001-1234", "Trưởng phòng KT-VT"].map((s) => chuDuyet.some((c) => c.includes(s))), [true, true, true, true]);
  kiemTra("PO Excel co cong thuc thanh tien", chuDuyet.some((c) => c.startsWith("=") && /\*/.test(c)), true);
  kiemTra("PO da duyet khong co chu ban nhap", chuDuyet.some((c) => c.includes("BẢN NHÁP")), false);
  const chuNhap = await docLai(await taoExcelDonMua({ ...du, daDuyet: false, nguoiDuyet: null, ngayDuyet: null }));
  kiemTra("PO chua duyet co chu ban nhap", chuNhap.some((c) => c.includes("BẢN NHÁP")), true);

  // ─── 7) Database (giao dịch, cuộn ngược) ───────────────────────────────────
  console.log("\n=== 7) Database (cuon nguoc) ===");
  const tau = await prisma.vessel.findFirst({ orderBy: { id: "asc" }, select: { id: true, code: true } });
  if (!tau) {
    console.log("  (bo qua: chua co tau trong database)");
  } else {
    try {
      await prisma.$transaction(async (tx) => {
        const ncc = await tx.supplier.create({ data: { code: `KT-BG-${Date.now()}`, name: "Kiem thu bao gia" } });
        const so1 = await sinhSoDonMua(tx, tau.id);
        kiemTra("so PO dung quy uoc", /^PO-[A-Z0-9]+-\d{2}-\d{4}$/.test(so1), true);
        const po = await tx.purchaseOrder.create({
          data: { poNo: so1, supplierId: ncc.id, vesselId: tau.id, createdBy: "kiem thu", items: { create: [{ description: "Piston ring set", partNo: "21001-1234", quantity: 2, unitPrice: 1250 }] } },
        });
        kiemTra("so PO ke tiep", (await sinhSoDonMua(tx, tau.id)) > so1, true);
        // Gửi NCC khi còn nháp: điều kiện trạng thái chặn (không cập nhật dòng nào).
        const guiSom = await tx.purchaseOrder.updateMany({ where: { id: po.id, status: { in: [...PO_DUOC_TU.SENT] } }, data: { status: "SENT" } });
        kiemTra("gui NCC khi chua duyet -> 0 dong", guiSom.count, 0);
        const trinh = await tx.purchaseOrder.updateMany({ where: { id: po.id, status: "DRAFT" }, data: { status: "PENDING_APPROVAL", submittedBy: "kiem thu", submittedAt: new Date() } });
        const duyet = await tx.purchaseOrder.updateMany({ where: { id: po.id, status: "PENDING_APPROVAL" }, data: { status: "APPROVED", approvedBy: "TP KT-VT", approvedAt: new Date() } });
        const gui = await tx.purchaseOrder.updateMany({ where: { id: po.id, status: { in: [...PO_DUOC_TU.SENT] } }, data: { status: "SENT", orderDate: new Date() } });
        const xn = await tx.purchaseOrder.updateMany({ where: { id: po.id, status: { in: [...PO_DUOC_TU.CONFIRMED] } }, data: { status: "CONFIRMED", supplierConfirmedAt: new Date(), supplierConfirmRef: "OC-1" } });
        kiemTra("trinh -> duyet -> gui -> xac nhan", [trinh.count, duyet.count, gui.count, xn.count], [1, 1, 1, 1]);
        const sau = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
        kiemTra("cot duyet / xac nhan ghi du", [sau.status, sau.submittedBy, sau.approvedBy, sau.supplierConfirmRef, Boolean(sau.orderDate)], ["CONFIRMED", "kiem thu", "TP KT-VT", "OC-1", true]);
        const bg = await tx.baoGiaNcc.create({
          data: {
            vesselId: tau.id,
            poId: po.id,
            supplierId: ncc.id,
            fileName: "q.xlsx",
            storedName: `bao-gia-kiem-thu-${Date.now()}.xlsx`,
            loaiTep: "EXCEL",
            size: 1,
            sha256: "x",
            dong: en.dong,
            nguoiTaiId: 0,
            nguoiTai: "kiem thu",
          },
        });
        kiemTra("bao gia luu dong JSON doc lai duoc", docDongBaoGia(bg.dong).length, 3);
        kiemTra("bao gia mac dinh cho xu ly", bg.trangThai, "CHO_XU_LY");
        const tep = await tx.tepDonMua.create({ data: { poId: po.id, loai: "XAC_NHAN_NCC", fileName: "oc.pdf", storedName: `don-mua-kiem-thu-${Date.now()}.pdf`, mimeType: "application/pdf", size: 1, sha256: "x", nguoiTai: "kiem thu" } });
        kiemTra("tep don mua", tep.poId, po.id);
        throw new CuonNguoc();
      });
    } catch (e) {
      if (!(e instanceof CuonNguoc)) throw e;
    }
  }

  console.log(`\n${truot ? "TRUOT" : "DAT"}: ${dat}/${dat + truot}`);
  await prisma.$disconnect();
  if (truot) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
