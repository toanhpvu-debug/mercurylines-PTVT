/**
 * Kiểm LÕI GHI NHẬP / XUẤT (lib/nhapXuatServer.ts — dùng chung cho phiếu từng dòng và nhập / xuất
 * hàng loạt) và đổi giờ ô datetime-local (lib/gioMay.ts), KHÔNG để lại dữ liệu.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-nhap-xuat.ts
 */
import { PrismaClient } from "@prisma/client";
import { docThoiDiemThucHien, ghiNhapXuatTx, khoaDongTonTx } from "@/lib/nhapXuatServer";
import { gioMayTuIso, isoTuGioMay } from "@/lib/gioMay";

const prisma = new PrismaClient();
let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) {
    dat++;
    console.log(`  OK    ${ten}`);
  } else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
class CuonNguoc extends Error {}

function kiemThoiDiem() {
  console.log("\n=== 1) Thoi diem thuc hien + gio may ===");
  const bayGio = Date.parse("2026-10-18T03:00:00.000Z");
  const doc = (s: string) => {
    const r = docThoiDiemThucHien(s, bayGio);
    return "loi" in r ? r.loi : r.ngay.toISOString();
  };
  kiemTra(
    "trong = bay gio; ISO giu nguyen; sai / truoc 2000 / tuong lai bi chan; lech 4 phut van nhan",
    [doc(""), doc("2026-10-17T20:00:00.000Z"), doc("abc"), doc("1999-12-31T00:00:00.000Z"), doc("2026-10-18T04:00:00.000Z"), doc("2026-10-18T03:04:00.000Z")],
    ["2026-10-18T03:00:00.000Z", "2026-10-17T20:00:00.000Z", "khongHopLe", "khongHopLe", "tuongLai", "2026-10-18T03:04:00.000Z"]
  );
  kiemTra("gio may: trong / sai -> rong", [isoTuGioMay(""), isoTuGioMay("x"), gioMayTuIso(""), gioMayTuIso("x")], ["", "", "", ""]);
  kiemTra("gio may: di ve tron vong (theo mui gio may chay kiem thu)", gioMayTuIso(isoTuGioMay("2026-10-18T08:00")), "2026-10-18T08:00");
  kiemTra("gio may: ISO co mui gio la dung thoi diem do", isoTuGioMay("2026-10-18T08:00") === new Date(2026, 9, 18, 8, 0).toISOString(), true);
}

async function kiemDatabase() {
  console.log("\n=== 2) Ghi nhap / xuat (cuon nguoc) ===");
  const dong = await prisma.inventory.findMany({
    where: { quantity: { gte: 2 }, warehouse: { vesselId: { not: null } } },
    orderBy: { id: "asc" },
    take: 2,
    select: { id: true, materialId: true, warehouseId: true, vesselId: true, quantity: true },
  });
  if (dong.length < 2) {
    console.log("  Chua co 2 dong ton >= 2 — bo qua phan database (khong phai loi).");
    return;
  }
  const [a, b] = dong;
  // Một mặt hàng chưa có dòng ở kho của a (nhập lần đầu tạo dòng mới).
  const coO = await prisma.inventory.findMany({ where: { warehouseId: a.warehouseId }, select: { materialId: true } });
  const moi = await prisma.material.findFirst({ where: { id: { notIn: coO.map((x) => x.materialId) } }, select: { id: true } });
  const gdTruoc = await prisma.inventoryTransaction.count();
  const luc = new Date("2026-10-18T01:00:00.000Z");
  try {
    await prisma.$transaction(
      async (tx) => {
        const ds = [a, b, ...(moi ? [{ materialId: moi.id, warehouseId: a.warehouseId }] : [])];
        await khoaDongTonTx(tx, ds);
        const chung = { occurredAt: luc, performedBy: "Kiem thu", note: "Nhap xuat hang loat thu" };
        kiemTra("nhap 3 vao a", await ghiNhapXuatTx(tx, { ...chung, type: "IN", materialId: a.materialId, warehouseId: a.warehouseId, vesselId: a.vesselId, quantity: 3 }), true);
        kiemTra("xuat 1 tu b", await ghiNhapXuatTx(tx, { ...chung, type: "OUT", materialId: b.materialId, warehouseId: b.warehouseId, vesselId: b.vesselId, quantity: 1 }), true);
        kiemTra("xuat qua ton b -> false", await ghiNhapXuatTx(tx, { ...chung, type: "OUT", materialId: b.materialId, warehouseId: b.warehouseId, vesselId: b.vesselId, quantity: b.quantity + 100 }), false);
        const aSau = await tx.inventory.findUnique({ where: { id: a.id }, select: { quantity: true } });
        const bSau = await tx.inventory.findUnique({ where: { id: b.id }, select: { quantity: true } });
        kiemTra("ton a +3, b -1 (lan xuat qua ton khong tru gi)", [aSau?.quantity, bSau?.quantity], [a.quantity + 3, b.quantity - 1]);
        if (moi) {
          kiemTra("nhap mat hang chua co dong ton -> tao dong", await ghiNhapXuatTx(tx, { ...chung, type: "IN", materialId: moi.id, warehouseId: a.warehouseId, vesselId: a.vesselId, quantity: 2 }), true);
          kiemTra(
            "dong ton moi: so 2, dung tau",
            await tx.inventory.findUnique({ where: { materialId_warehouseId: { materialId: moi.id, warehouseId: a.warehouseId } }, select: { quantity: true, vesselId: true } }),
            { quantity: 2, vesselId: a.vesselId }
          );
        }
        const gd = await tx.inventoryTransaction.findMany({ where: { note: "Nhap xuat hang loat thu" }, orderBy: { id: "asc" }, select: { type: true, quantity: true, occurredAt: true, performedBy: true } });
        kiemTra(
          "the kho: moi lan ghi thanh cong mot dong (lan qua ton khong ghi)",
          gd.map((g) => [g.type, g.quantity, g.occurredAt.toISOString(), g.performedBy]),
          [["IN", 3, luc.toISOString(), "Kiem thu"], ["OUT", 1, luc.toISOString(), "Kiem thu"], ...(moi ? [["IN", 2, luc.toISOString(), "Kiem thu"]] : [])]
        );
        throw new CuonNguoc();
      },
      { timeout: 60_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  const aCuoi = await prisma.inventory.findUnique({ where: { id: a.id }, select: { quantity: true } });
  kiemTra("da cuon nguoc: ton a va so dong the kho nhu cu", [aCuoi?.quantity, await prisma.inventoryTransaction.count()], [a.quantity, gdTruoc]);
}

kiemThoiDiem();
kiemDatabase()
  .catch((e) => {
    truot++;
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
    process.exit(truot ? 1 : 0);
  });
