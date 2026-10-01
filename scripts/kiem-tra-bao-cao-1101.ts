/**
 * Kiểm phần tính của báo cáo MLS-11-01 (lib/baoCao1101.ts): xếp loại giao dịch
 * (nhận / dùng / điều chỉnh kiểm kê), tồn đầu – cuối, đủ các ngày, ghi chú tự
 * động; và trên DỮ LIỆU THẬT (chỉ đọc): mọi dòng của mọi tàu, tháng có giao
 * dịch gần nhất, đều khớp tồn trước + nhận − dùng ± điều chỉnh = tồn cuối.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-bao-cao-1101.ts
 */
import { PrismaClient } from "@prisma/client";
import { chuoiNgay1101, coSo1101, ghiChu1101, laKiemKe, loaiGiaoDich, nhanNguonPO, tongHop1101, type GiaoDich1101 } from "@/lib/baoCao1101";

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

console.log("\n=== 1) Phan tinh thuan ===");
kiemTra("nhan dien kiem ke", [laKiemKe("Kiểm kê từ file Kiem_Ke.xlsx"), laKiemKe("Kiểm kê theo file a.pdf (#3)"), laKiemKe("kiem ke dau ky"), laKiemKe("Stock-take Oct"), laKiemKe("Nhận hàng PO-1"), laKiemKe(null)], [true, true, true, true, false, false]);
kiemTra("loai giao dich", [loaiGiaoDich({ type: "IN", note: "Phiếu giao GM-1" }), loaiGiaoDich({ type: "OUT", note: "Thay bơm" }), loaiGiaoDich({ type: "OUT", note: "Kiểm kê theo file x (#1)" })], ["NHAN", "DUNG", "KIEM_KE"]);
const d = (s: string) => new Date(`${s}T10:00:00`);
const gd = (type: string, materialId: number, quantity: number, ngay: string, note: string | null = null): GiaoDich1101 => ({ type, materialId, quantity, occurredAt: d(ngay), note, performedBy: "X" });
const dau = new Date(2026, 9, 1);
const cuoi = new Date(2026, 10, 1);
const nccTheoPo = new Map([["PO-2026-012", "ABC Marine"]]);
const th = tongHop1101({
  tonHienTai: new Map([
    [1, 16],
    [2, 20],
    [3, 0],
    [4, 5],
  ]),
  giaoDich: [
    gd("IN", 1, 5, "2026-10-05", "Nhận hàng PO-2026-012"),
    gd("IN", 1, 3, "2026-10-20", "Phiếu giao GM-77 — ABC Marine"),
    gd("OUT", 1, 2, "2026-10-22", "Thay ron nắp máy"),
    gd("IN", 1, 2, "2026-10-28", "Kiểm kê theo file kk.xlsx (#4)"),
    gd("OUT", 1, 1, "2026-11-03", "Sau tháng"), // sau tháng: lùi tồn về cuối tháng
    gd("IN", 2, 20, "2026-10-02", "Kiểm kê từ file Kiem_Ke.xlsx"), // nạp tồn ban đầu
    gd("IN", 4, 5, "2026-10-10", "Nhập tay"),
  ],
  dau,
  cuoi,
  nhanDauTien: new Map([[4, d("2026-10-10")]]),
  nguonCua: (g) => nhanNguonPO(g.note, nccTheoPo) ?? g.note,
});
const a = th.get(1)!;
kiemTra("mat hang 1: nhan khong tinh kiem ke", [a.nhan, a.dung, a.dieuChinh], [8, 2, 2]);
kiemTra("mat hang 1: ton cuoi lui giao dich sau thang", a.tonCuoi, 17);
kiemTra("mat hang 1: ton dau = cuoi - nhan + dung - dieu chinh", a.tonDau, 9);
kiemTra("mat hang 1: can bang", a.tonDau + a.nhan - a.dung + a.dieuChinh, a.tonCuoi);
kiemTra("mat hang 1: du cac ngay nhan", chuoiNgay1101(a.ngayNhan), "05/10, 20/10");
kiemTra("mat hang 1: nguon PO kem NCC", a.nguonNhan[0], "PO-2026-012 (ABC Marine)");
kiemTra("mat hang 1: ghi chu", ghiChu1101(a, 20), "Nhận: PO-2026-012 (ABC Marine); Phiếu giao GM-77 — ABC Marine. Dùng: Thay ron nắp máy. Điều chỉnh kiểm kê +2 28/10. Dưới tối thiểu (min 20)");
const b = th.get(2)!;
kiemTra("mat hang 2: nap ton ban dau khong phai nhan", [b.tonDau, b.nhan, b.dieuChinh, b.tonCuoi], [0, 0, 20, 20]);
kiemTra("mat hang 2: ghi chu ton ban dau", ghiChu1101(b, 0), "Tồn ban đầu (kiểm kê 02/10): 20");
kiemTra("mat hang 3: khong co gi -> bo", coSo1101(th.get(3)!), false);
const c = th.get(4)!;
kiemTra("mat hang 4: moi nhan lan dau", [c.moiNhan, ghiChu1101(c, 0)], [true, "Mới nhận lần đầu. Nhận: Nhập tay"]);
kiemTra("nhieu ngay -> gon", chuoiNgay1101(["01", "03", "05", "07", "07"].map((x) => d(`2026-10-${x}`))), "01/10 – 07/10 (5 lần)");
kiemTra("nguon PO khong co NCC", nhanNguonPO("Nhận hàng PO-9", new Map()), "PO-9");
const am = tongHop1101({ tonHienTai: new Map([[9, 0]]), giaoDich: [gd("IN", 9, 8, "2026-10-15", "Nhập tay"), gd("OUT", 9, 7, "2026-10-15")], dau, cuoi, nhanDauTien: new Map() }).get(9)!;
kiemTra("ton dau am -> canh bao doi chieu", [am.tonDau, ghiChu1101(am, 0).endsWith("Tồn đầu âm — đối chiếu thẻ kho")], [-1, true]);

async function duLieuThat() {
  console.log("\n=== 2) Du lieu that (chi doc): can bang moi dong ===");
  const tauCoGd = await prisma.inventoryTransaction.groupBy({ by: ["vesselId"], _max: { occurredAt: true } });
  if (!tauCoGd.length) {
    console.log("  Bo qua: chua co giao dich.");
    return;
  }
  let soDong = 0;
  let lech = 0;
  let kiemKeLaNhan = 0;
  for (const tau of tauCoGd) {
    const moc = tau._max.occurredAt!;
    const dauT = new Date(moc.getFullYear(), moc.getMonth(), 1);
    const cuoiT = new Date(moc.getFullYear(), moc.getMonth() + 1, 1);
    const kho = await prisma.warehouse.findMany({ where: { vesselId: tau.vesselId }, select: { id: true } });
    const khoIds = kho.map((k) => k.id);
    const [ton, giaoDich] = await Promise.all([
      prisma.inventory.findMany({ where: { warehouseId: { in: khoIds } }, select: { materialId: true, quantity: true } }),
      prisma.inventoryTransaction.findMany({
        where: { warehouseId: { in: khoIds }, occurredAt: { gte: dauT } },
        select: { type: true, materialId: true, quantity: true, occurredAt: true, note: true, performedBy: true },
      }),
    ]);
    const tonHienTai = new Map<number, number>();
    for (const r of ton) tonHienTai.set(r.materialId, (tonHienTai.get(r.materialId) ?? 0) + r.quantity);
    const ds = [...tongHop1101({ tonHienTai, giaoDich, dau: dauT, cuoi: cuoiT, nhanDauTien: new Map() }).values()].filter(coSo1101);
    for (const r of ds) {
      soDong++;
      if (Math.abs(r.tonDau + r.nhan - r.dung + r.dieuChinh - r.tonCuoi) > 1e-6) lech++;
    }
    kiemKeLaNhan += giaoDich.filter((g) => g.occurredAt < cuoiT && laKiemKe(g.note)).length;
    console.log(`  tau #${tau.vesselId} thang ${dauT.getMonth() + 1}/${dauT.getFullYear()}: ${ds.length} dong`);
  }
  kiemTra(`can bang tren ${soDong} dong that`, lech, 0);
  console.log(`  (${kiemKeLaNhan} giao dich kiem ke duoc tach khoi cot Nhan / Su dung)`);
}

duLieuThat()
  .catch((e) => {
    truot++;
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
    process.exit(truot ? 1 : 0);
  });
