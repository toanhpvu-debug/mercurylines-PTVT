/**
 * Kiểm YÊU CẦU SƠN TỪ TÀU: ghép dòng phiếu MLS-11-05 với danh mục sơn (mã, tên,
 * tên + màu, hãng + tên, mô tả chứa tên + màu, không đoán khi mơ hồ), dựng dòng
 * form, kiểm dòng gửi lên, liên kết sơn qua docDongYeuCau / locSonCoThat, và —
 * trên database thật trong một giao dịch rồi cuộn ngược — lập yêu cầu (đại phó
 * → chờ thuyền trưởng; thuyền trưởng → thẳng lên công ty) và nhận hàng PO cộng
 * vào tồn sơn.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-yeu-cau-son.ts
 */
import { PrismaClient } from "@prisma/client";
import { docDongGuiSon, dongFormSonTuFile, ghepSon, soThieuDinhMuc, tenDongSon, type SonGhep } from "@/lib/yeuCauSon";
import type { DongYeuCauFile } from "@/lib/yeuCauNhap";
import { docDongYeuCau, locSonCoThat } from "@/lib/yeuCauVatTu";
import { nhapSonTuDonMuaTx, taoYeuCauSonTx } from "@/lib/yeuCauSonServer";

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

const dongFile = (moTa: string, them: Partial<DongYeuCauFile> = {}): DongYeuCauFile => ({
  moTa,
  impa: null,
  partNo: null,
  hangMuc: null,
  donVi: "ltr",
  rob: null,
  soLuong: 20,
  ghiChu: null,
  phan: null,
  canhBao: null,
  ...them,
});

const SON: SonGhep[] = [
  { id: 1, code: "SON-0001", name: "Hempadur 45143", maker: "Hempel", colorName: "Grey", colorCode: "12170", uom: "L" },
  { id: 2, code: "SON-0002", name: "Hempadur 45143", maker: "Hempel", colorName: "Red", colorCode: "50630", uom: "L" },
  { id: 3, code: "SON-0003", name: "Hempathane HS 55610", maker: "Hempel", colorName: "White", colorCode: null, uom: "L" },
  { id: 4, code: "SON-0004", name: "Thinner 08450", maker: "Hempel", colorName: null, colorCode: null, uom: "L" },
  { id: 5, code: "SON-0005", name: "Jotamastic 87", maker: "Jotun", colorName: null, colorCode: null, uom: "L" },
];

async function main() {
  // ── Ghép danh mục sơn ──
  const dong = [
    dongFile("Sơn lót", { partNo: "SON-0003" }), // 0: theo mã
    dongFile("Hempadur 45143 Red"), // 1: tên + màu trùng khít
    dongFile("Hempel Thinner 08450"), // 2: hãng + tên
    dongFile("HEMPADUR 45143 grey 20L/can (sơn epoxy)"), // 3: chứa tên + màu
    dongFile("Hempadur 45143"), // 4: hai màu, file không ghi màu → không đoán
    dongFile("Jotamastic 87 (sơn chống gỉ)"), // 5: nửa trước ngoặc
    dongFile("Interzone 954 black"), // 6: không có trong danh mục
    dongFile("Thinner"), // 7: quá chung chung
  ];
  kiemTra("ghep son", ghepSon(dong, SON).map((p) => p?.id ?? null), [3, 2, 4, 1, null, 5, null, null]);
  kiemTra("ten dong son", [tenDongSon(SON[0]), tenDongSon(SON[3])], ["Hempadur 45143 (Hempel) · Grey", "Thinner 08450 (Hempel)"]);

  // ── Dòng form từ file ──
  const form = dongFormSonTuFile(
    [dongFile("Hempadur 45143 Red", { rob: 4, phan: "DECK", ghiChu: "gấp" }), dongFile("Interzone 954 black", { partNo: "IZ954", rob: 2, soLuong: null, canhBao: "x" })],
    [SON[1], null],
    (d) => d.canhBao ?? undefined
  );
  kiemTra("form son", form, [
    { paintProductId: "2", ten: "Hempadur 45143 Red", ma: "", dvt: "ltr", soLuong: "20", ghiChu: "DECK; gấp", robFile: "4", goiY: undefined },
    { paintProductId: "", ten: "Interzone 954 black", ma: "IZ954", dvt: "ltr", soLuong: "", ghiChu: "", robFile: "2", goiY: "x" },
  ]);
  kiemTra("thieu dinh muc", [soThieuDinhMuc(3, 10), soThieuDinhMuc(10, 10), soThieuDinhMuc(0, 0), soThieuDinhMuc(1.333, 2)], [7, 0, 0, 0.67]);

  // ── Kiểm dòng gửi lên ──
  kiemTra("gui son ok", docDongGuiSon([{ paintProductId: "2", soLuong: "20", ghiChu: " gấp " }, { paintProductId: "", ten: "", soLuong: "" }, { ten: "Interzone 954", ma: "IZ954", dvt: "L", soLuong: "5,5", robFile: "2" }]), {
    ok: true,
    dong: [
      { paintProductId: 2, ten: "", ma: null, dvt: null, soLuong: 20, ghiChu: "gấp", robFile: null },
      { paintProductId: null, ten: "Interzone 954", ma: "IZ954", dvt: "L", soLuong: 5.5, ghiChu: null, robFile: 2 },
    ],
  });
  kiemTra("gui son thieu so", docDongGuiSon([{ paintProductId: "1", soLuong: "3" }, { ten: "Sơn X", soLuong: "" }]), { ok: false, dongLoi: 2 });
  kiemTra("gui son so am", docDongGuiSon([{ paintProductId: "1", soLuong: "-1" }]), { ok: false, dongLoi: 1 });
  kiemTra("gui son rong", docDongGuiSon("x"), { ok: true, dong: [] });

  // ── Liên kết sơn qua đường API chung ──
  const dongApi = docDongYeuCau([
    { isNew: true, itemName: "Hempadur", quantity: 2, paintProductId: 7 },
    { isNew: true, itemName: "Rope", quantity: 1 },
    { materialId: 3, quantity: 1, paintProductId: 7 },
  ]);
  kiemTra("api son", dongApi.map((d) => d.paintProductId), [7, null, null]);

  // ── Database thật, cuộn ngược ──
  const tau = await prisma.vessel.findFirst({ orderBy: { id: "asc" }, select: { id: true, code: true } });
  const sp = await prisma.paintProduct.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, code: true, name: true, maker: true, colorName: true, uom: true } });
  if (!tau || !sp) {
    console.log("  (bo qua kiem DB: chua co tau / danh muc son)");
  } else {
    kiemTra("loc son co that", (await locSonCoThat(docDongYeuCau([{ isNew: true, itemName: "a", quantity: 1, paintProductId: sp.id }, { isNew: true, itemName: "b", quantity: 1, paintProductId: 999999999 }]))).map((d) => d.paintProductId), [sp.id, null]);
    const tonTruoc = (await prisma.paintStock.findUnique({ where: { vesselId_productId: { vesselId: tau.id, productId: sp.id } } }))?.quantity ?? 0;
    const soYeuCauTruoc = await prisma.materialRequest.count();
    try {
      await prisma.$transaction(async (tx) => {
        const co = await taoYeuCauSonTx(tx, {
          vesselId: tau.id,
          nguoi: { id: 987654, name: "Đại Phó Thử", role: "CHIEF_OFFICER" },
          dong: [
            { paintProductId: sp.id, ten: "", ma: null, dvt: null, soLuong: 40, ghiChu: "boong chính", robFile: 99 },
            { paintProductId: null, ten: "Interzone 954 black", ma: "IZ954", dvt: "L", soLuong: 10, ghiChu: null, robFile: 2 },
          ],
          purpose: null,
          priority: "HIGH",
          requiredDate: new Date("2026-11-01T00:00:00Z"),
        });
        const yc = await tx.materialRequest.findUniqueOrThrow({
          where: { id: co.id },
          include: { items: { orderBy: { id: "asc" } }, events: { orderBy: { id: "asc" } } },
        });
        kiemTra("co lap: trang thai", [yc.status, yc.department, yc.kind, yc.priority, yc.shipApprovedBy, yc.requestNo.startsWith(`MR-${tau.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}-`)], [
          "PENDING_MASTER",
          "DECK",
          "STORE",
          "HIGH",
          null,
          true,
        ]);
        kiemTra(
          "co lap: dong",
          yc.items.map((i) => [i.paintProductId, i.materialId, i.itemName, i.itemCode, i.itemUom, i.quantity, i.robSnapshot, i.approvedQuantity, i.note]),
          [
            [sp.id, null, tenDongSon(sp), sp.code, sp.uom, 40, tonTruoc, 0, "boong chính"],
            [null, null, "Interzone 954 black", "IZ954", "L", 10, 2, 0, null],
          ]
        );
        kiemTra("co lap: nhat ky", yc.events.map((e) => [e.fromStatus, e.toStatus]), [
          [null, "DRAFT"],
          ["DRAFT", "PENDING_MASTER"],
        ]);
        const tt = await taoYeuCauSonTx(tx, {
          vesselId: tau.id,
          nguoi: { id: 987655, name: "Thuyền Trưởng Thử", role: "MASTER" },
          dong: [{ paintProductId: sp.id, ten: "", ma: null, dvt: null, soLuong: 5, ghiChu: null, robFile: null }],
          purpose: "Sơn mạn",
          priority: "x",
          requiredDate: null,
        });
        const yc2 = await tx.materialRequest.findUniqueOrThrow({ where: { id: tt.id }, include: { items: true } });
        kiemTra("thuyen truong lap: thang len cong ty", [yc2.status, yc2.shipApprovedBy, yc2.priority, yc2.purpose, yc2.items[0].approvedQuantity, yc2.requestNo > yc.requestNo], [
          "PENDING_OFFICE",
          "Thuyền Trưởng Thử",
          "NORMAL",
          "Sơn mạn",
          5,
          true,
        ]);
        // Nhận hàng PO cho dòng sơn → tồn sơn của tàu tăng, có phiếu nhập.
        await nhapSonTuDonMuaTx(tx, { vesselId: tau.id, productId: sp.id, soLuong: 12.5, poNo: "PO-THU-SON", nguoi: "Kiểm thử" });
        await nhapSonTuDonMuaTx(tx, { vesselId: tau.id, productId: sp.id, soLuong: 0, poNo: "PO-THU-SON", nguoi: "Kiểm thử" });
        const tonSau = (await tx.paintStock.findUniqueOrThrow({ where: { vesselId_productId: { vesselId: tau.id, productId: sp.id } } })).quantity;
        const phieu = await tx.paintTransaction.findMany({ where: { vesselId: tau.id, productId: sp.id, note: "Nhận hàng PO-THU-SON" } });
        kiemTra("nhan PO cong ton son", [Math.round((tonSau - tonTruoc) * 100) / 100, phieu.length, phieu[0]?.type, phieu[0]?.quantity], [12.5, 1, "IN", 12.5]);
        throw new CuonNguoc();
      });
    } catch (e) {
      if (!(e instanceof CuonNguoc)) throw e;
    }
    const tonCuoi = (await prisma.paintStock.findUnique({ where: { vesselId_productId: { vesselId: tau.id, productId: sp.id } } }))?.quantity ?? 0;
    kiemTra("da cuon nguoc", [tonCuoi, await prisma.materialRequest.count()], [tonTruoc, soYeuCauTruoc]);
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
