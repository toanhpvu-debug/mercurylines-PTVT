/**
 * Kiểm KIỂM KÊ THEO FILE (MLS-11-06): phần thuần (lib/kiemKe.ts), chế độ "bảng
 * kiểm kê" của bộ đọc AI, đọc file Excel thật (Desktop, nếu có) và — trên
 * database thật trong một giao dịch rồi cuộn ngược — ghép dòng, cộng dồn dòng
 * trùng, đặt tồn đúng số đếm và ghi giao dịch điều chỉnh.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-kiem-ke.ts
 */
import os from "node:os";
import path from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { apSuaDong, docDongJson, dongTuAi, dongTuExcel, ngayKiemKeTu, soTonNhap, tauTuTenTep, type DongKiemKe } from "@/lib/kiemKe";
import { CONG_CU_GHI_KIEM_KE, chuanHoaKetQuaAi, loiNhac } from "@/lib/docPhieuBangAi";
import { parseMaterialExcel } from "@/lib/materialImport";
import { apDungKeHoachKiemKe, lapKeHoachKiemKe } from "@/lib/kiemKeServer";

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

// ─── 1) Phần thuần ──────────────────────────────────────────────────────────
console.log("\n=== 1) Phan thuan ===");
const tauMau = [
  { id: 1, code: "ML-001", name: "M. ODYSSEY" },
  { id: 2, code: "ML-002", name: "M. ATLAS" },
  { id: 7, code: "ML-007", name: "TC MESSENGER" },
];
kiemTra("ten file co ma tau", tauTuTenTep("MLS-11-06_ML-001_2026-08-15.xlsx", tauMau)?.id, 1);
kiemTra("ma viet lien ML002", tauTuTenTep("kiem ke ML002 thang 9.pdf", tauMau)?.id, 2);
kiemTra("ten tau khong dau", tauTuTenTep("Kiem ke ODYSSEY T9.pdf", tauMau)?.id, 1);
kiemTra("ten tau nhieu tu", tauTuTenTep("TC Messenger stock 2026.xlsx", tauMau)?.id, 7);
kiemTra("khong chi tau -> null", tauTuTenTep("MLS-11-06 Store & Spare Part Inventory.xlsx", tauMau), null);
kiemTra("hai tau -> null", tauTuTenTep("ML-001 va ML-002.xlsx", tauMau), null);
kiemTra("so ton nhap", [soTonNhap("12"), soTonNhap("2,5"), soTonNhap(""), soTonNhap(null), Number.isNaN(soTonNhap("abc")), Number.isNaN(soTonNhap(-1))], [12, 2.5, null, null, true, true]);
const dongMau = (ten: string, ton: number | null, x: Partial<DongKiemKe> = {}): DongKiemKe => ({
  ten,
  tenEn: null,
  impa: null,
  partNo: null,
  donVi: "PCS",
  thietBi: null,
  nhom: null,
  loai: "STORE",
  sheet: null,
  ton,
  trang: null,
  canhBao: null,
  boQua: false,
  themMoi: false,
  ...x,
});
const ds = [dongMau("A", 1), dongMau("B", 2)];
const s1 = apSuaDong(ds, [{ i: 1, ton: "7", boQua: true, themMoi: true, ten: "HACK" }, { i: 9, ton: "1" }]);
kiemTra("apSuaDong: chi doi ton / boQua / themMoi, bo chi so ngoai", s1.ok ? [s1.dong[1].ton, s1.dong[1].boQua, s1.dong[1].themMoi, s1.dong[1].ten, s1.dong.length] : null, [7, true, true, "B", 2]);
kiemTra("apSuaDong: o trong -> null (chua dem)", (() => { const r = apSuaDong(ds, [{ i: 0, ton: "" }]); return r.ok ? r.dong[0].ton : "loi"; })(), null);
kiemTra("apSuaDong: so sai -> bao dong", apSuaDong(ds, [{ i: 0, ton: "x" }]), { ok: false, n: 1 });
kiemTra("docDongJson bo phan tu hong", docDongJson([dongMau("A", 1), { ten: 5 }, null]).length, 1);
const bayGio = new Date(2026, 9, 1, 10);
kiemTra("ngay kiem ke hop le", ngayKiemKeTu("2026-09-28", bayGio).getDate(), 28);
kiemTra("ngay tuong lai -> hom nay", ngayKiemKeTu("2026-12-01", bayGio).getTime(), bayGio.getTime());
kiemTra("ngay sai -> hom nay", ngayKiemKeTu("2026-02-31", bayGio).getTime(), bayGio.getTime());
const tuExcel = dongTuExcel([
  { name: "Wire rope", impa: "232052", partNumber: null, uom: "M", equipment: null, group: "Deck", minStock: 0, rob: 0, sheet: "Vật tư Boong (Deck Stores)", materialType: "STORE" },
  { name: "Piston ring", impa: null, partNumber: "PR-1", uom: "SET", equipment: "Main Engine", group: null, minStock: 1, rob: null, sheet: "Phụ tùng (Spare Parts)", materialType: "SPARE" },
]);
kiemTra("dongTuExcel: 0 la 0, trong la null", [tuExcel[0].ton, tuExcel[1].ton, tuExcel[1].thietBi, tuExcel[0].sheet], [0, null, "Main Engine", "Vật tư Boong (Deck Stores)"]);

// ─── 1b) Bộ đọc AI ở chế độ bảng kiểm kê ─────────────────────────────────────
console.log("\n=== 1b) Bo doc AI - bang kiem ke ===");
const chuan = chuanHoaKetQuaAi({
  dong: [
    { ten: "Rope", soLuong: null, loai: "STORE" },
    { ten: "Gasket", soLuong: 0, loai: "SPARE", thietBi: "A/E No.2" },
    { ten: "Filter", soLuong: "5", loai: "SPARE" },
    { ten: "Paint", soLuong: "", loai: "STORE", thietBi: "PAINT" },
  ],
});
kiemTra("o trong -> soLuongTrong", chuan.dong.map((d) => d.soLuongTrong), [true, false, false, true]);
const tuAi = dongTuAi(chuan.dong);
kiemTra("dongTuAi: trong = null, 0 = 0, nhom/thiet bi theo loai", tuAi.map((d) => [d.ton, d.thietBi, d.nhom]), [[null, null, null], [0, "A/E No.2", null], [5, null, null], [null, null, "PAINT"]]);
kiemTra("loi nhac kiem ke", loiNhac(null, null, "kiemKe").includes("bảng kiểm kê"), true);
kiemTra("loi nhac phieu giao giu nguyen", loiNhac(null, null).includes("phiếu giao hàng"), true);
kiemTra("cong cu kiem ke: so luong = R.O.B, cho null", [
  CONG_CU_GHI_KIEM_KE.input_schema.properties.dong.items.properties.soLuong.description.includes("R.O.B"),
  CONG_CU_GHI_KIEM_KE.input_schema.properties.dong.items.properties.soLuong.type,
], [true, ["number", "null"]]);

// ─── 2) File Excel MLS-11-06 thật trên Desktop (nếu có) ──────────────────────
function excelThat() {
  const desktop = path.join(os.homedir(), "Desktop");
  const tep = existsSync(desktop) ? readdirSync(desktop).filter((f) => /^MLS-11-06.*\.xlsx$/i.test(f)) : [];
  if (!tep.length) {
    console.log("\n=== 2) Bo qua: khong co file MLS-11-06 tren Desktop ===");
    return;
  }
  console.log(`\n=== 2) Doc ${tep.length} file MLS-11-06 that ===`);
  for (const f of tep) {
    const kq = parseMaterialExcel(readFileSync(path.join(desktop, f)));
    const dong = dongTuExcel(kq.items);
    const coSo = dong.filter((d) => d.ton !== null).length;
    console.log(`  ${f}: ${dong.length} dong, ${coSo} co so ton, tau theo ten: ${tauTuTenTep(f, tauMau)?.code ?? "-"}${kq.error ? ` LOI: ${kq.error}` : ""}`);
    if (/ML-\d{3}/.test(f)) {
      kiemTra(`${f}: doc duoc dong`, dong.length > 0, true);
      kiemTra(`${f}: co so ton (cot Ton tren tau)`, coSo > 0, true);
      kiemTra(`${f}: nhan tau theo ten`, tauTuTenTep(f, tauMau)?.code, f.match(/ML-\d{3}/)![0]);
    }
  }
}

// ─── 3) Database thật: lập kế hoạch + áp dụng, cuộn ngược ────────────────────
async function dbThat() {
  console.log("\n=== 3) Database: lap ke hoach + ap dung (cuon nguoc) ===");
  const ton = await prisma.inventory.findMany({
    where: { quantity: { gt: 0 }, warehouse: { vesselId: { not: null } } },
    select: { materialId: true, warehouseId: true, quantity: true, warehouse: { select: { vesselId: true } }, material: { select: { nameVn: true, impa: true, partNumber: true, equipment: true, code: true } } },
    take: 400,
  });
  // Hai mặt hàng cùng tàu, mỗi mặt hàng chỉ nằm ở MỘT kho của tàu đó (kho tự động phải trúng kho đó).
  const theoTau = new Map<number, typeof ton>();
  for (const r of ton) theoTau.set(r.warehouse.vesselId!, [...(theoTau.get(r.warehouse.vesselId!) ?? []), r]);
  let chon: { vesselId: number; a: (typeof ton)[number]; b: (typeof ton)[number] } | null = null;
  for (const [vesselId, ds] of theoTau) {
    const dem = new Map<number, number>();
    for (const r of ds) dem.set(r.materialId, (dem.get(r.materialId) ?? 0) + 1);
    const motKho = ds.filter((r) => dem.get(r.materialId) === 1 && r.material.nameVn.length > 3);
    const lienKet = await prisma.vesselMaterial.findMany({ where: { vesselId, materialId: { in: motKho.map((r) => r.materialId) } }, select: { materialId: true } });
    const coLien = motKho.filter((r) => lienKet.some((l) => l.materialId === r.materialId));
    if (coLien.length >= 2) {
      chon = { vesselId, a: coLien[0], b: coLien[1] };
      break;
    }
  }
  if (!chon) {
    console.log("  Bo qua: khong co du ton kho mau trong database.");
    return;
  }
  const { vesselId, a, b } = chon;
  const khoaA = a.material.impa ? { impa: a.material.impa } : a.material.partNumber ? { partNo: a.material.partNumber } : { thietBi: a.material.equipment };
  const dong: DongKiemKe[] = [
    dongMau(a.material.nameVn, a.quantity + 5, { ...khoaA, thietBi: a.material.equipment }), // đổi tồn (+5)
    dongMau(b.material.nameVn, b.quantity, { thietBi: b.material.equipment }), // không đổi
    dongMau("MAT HANG KIEM THU KHONG CO 9X7Q", 3), // chưa có
    dongMau(b.material.nameVn, null, { thietBi: b.material.equipment }), // ô trống
    dongMau(a.material.nameVn, 2, { ...khoaA, thietBi: a.material.equipment }), // trùng A → cộng dồn
    dongMau(a.material.nameVn, 999, { ...khoaA, thietBi: a.material.equipment, boQua: true }), // bỏ qua
  ];
  try {
    await prisma.$transaction(
      async (tx) => {
        const ke = await lapKeHoachKiemKe(vesselId, dong, "AUTO", tx);
        kiemTra("trang thai tung dong", ke.dong.map((k) => k.trangThai), ["THAY_DOI", "KHONG_DOI", "MOI", "KHONG_SO", "GOP", "BO_QUA"]);
        kiemTra("A ghep dung mat hang + kho dang nam", [ke.dong[0].materialId, ke.dong[0].warehouseId], [a.materialId, a.warehouseId]);
        kiemTra("A cong don dong trung: ton moi = dem + 5 + 2", ke.dong[0].tonMoi, Math.round((a.quantity + 7) * 1000) / 1000);
        kiemTra("A chenh lech +7", ke.dong[0].chenhLech, 7);
        kiemTra("dong trung tro ve dong 1", ke.dong[4].gopVao, 0);
        kiemTra("tong: 1 doi, 1 tang", [ke.tong.THAY_DOI, ke.tong.tang, ke.tong.giam, ke.tong.MOI], [1, 1, 0, 1]);
        const truoc = await tx.inventoryTransaction.count({ where: { materialId: a.materialId, warehouseId: a.warehouseId } });
        const kq = await apDungKeHoachKiemKe(tx, { vesselId, keHoach: ke, ghiChu: "Kiểm kê theo file KIEM-THU (#0)", occurredAt: new Date(), nguoi: "Kiem thu" });
        kiemTra("ap dung: 1 dong doi, tang", kq, { soDong: 1, tang: 1, giam: 0 });
        const sauA = await tx.inventory.findUnique({ where: { materialId_warehouseId: { materialId: a.materialId, warehouseId: a.warehouseId } } });
        kiemTra("A: ton = dung so dem", sauA?.quantity, Math.round((a.quantity + 7) * 1000) / 1000);
        const gd = await tx.inventoryTransaction.findFirst({ where: { materialId: a.materialId, warehouseId: a.warehouseId }, orderBy: { id: "desc" } });
        kiemTra("A: giao dich dieu chinh NHAP 7, ghi chu kiem ke", [gd?.type, gd?.quantity, gd?.note], ["IN", 7, "Kiểm kê theo file KIEM-THU (#0)"]);
        kiemTra("A: dung mot giao dich moi", (await tx.inventoryTransaction.count({ where: { materialId: a.materialId, warehouseId: a.warehouseId } })) - truoc, 1);
        const sauB = await tx.inventory.findUnique({ where: { materialId_warehouseId: { materialId: b.materialId, warehouseId: b.warehouseId } } });
        kiemTra("B: khong doi", sauB?.quantity, b.quantity);
        kiemTra("khong tao mat hang moi", await tx.material.count({ where: { nameVn: "MAT HANG KIEM THU KHONG CO 9X7Q" } }), 0);
        // Giảm: đếm ít hơn → XUẤT đúng phần chênh.
        const ke2 = await lapKeHoachKiemKe(vesselId, [dongMau(b.material.nameVn, 0, { thietBi: b.material.equipment })], "AUTO", tx);
        const kq2 = await apDungKeHoachKiemKe(tx, { vesselId, keHoach: ke2, ghiChu: "Kiểm kê theo file KIEM-THU (#0)", occurredAt: new Date(), nguoi: "Kiem thu" });
        const gd2 = await tx.inventoryTransaction.findFirst({ where: { materialId: b.materialId, warehouseId: b.warehouseId }, orderBy: { id: "desc" } });
        kiemTra("giam ve 0: XUAT dung ton cu", [kq2.giam, gd2?.type, gd2?.quantity], [1, "OUT", b.quantity]);
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  const conLai = await prisma.inventory.findUnique({ where: { materialId_warehouseId: { materialId: a.materialId, warehouseId: a.warehouseId } } });
  kiemTra("da cuon nguoc (ton A nhu cu)", conLai?.quantity, a.quantity);
}

(async () => {
  try {
    excelThat();
    await dbThat();
  } catch (e) {
    truot++;
    console.error(e);
  } finally {
    await prisma.$disconnect();
    console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
    process.exit(truot ? 1 : 0);
  }
})();
