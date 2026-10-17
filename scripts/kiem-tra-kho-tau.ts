/**
 * Kiểm KHO / VỊ TRÍ TRÊN TÀU (lib/khoTau.ts, lib/khoTauServer.ts), KHÔNG để lại dữ liệu.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-kho-tau.ts
 *
 * 1) Quy ước mã: khối đọc từ mã (kho thêm ML-001-ENG-ECR vẫn là Máy, mã vị trí chứa chữ STORE
 *    không đổi khối), kho chính của khối, chuẩn hóa mã vị trí, tên kèm tên tàu, vị trí gợi ý.
 * 2) Database, trong MỘT giao dịch cuộn ngược: thêm kho vào tàu đầu tiên có hàng, chuyển hai mặt
 *    hàng sang (một mặt hàng cộng vào dòng có sẵn), kiểm dòng tồn + lịch sử nhập xuất đi theo, tổng
 *    tồn của tàu và của khối Máy không đổi, kho còn hàng thì chưa xóa được, chuyển ngược về thì kho
 *    trống thật; tạo ba kho chuẩn cho một tàu tạm.
 */
import { PrismaClient } from "@prisma/client";
import { DO_DAI_HAU_TO, VI_TRI_GOI_Y, chuanHoaHauTo, hauToKho, khoChinhTheoLoai, khoThuocBoPhan, laKhoCuoiCuaKhoi, loaiKhoTuMa, maKho, tenKhoDayDu, tenKhoNgan } from "@/lib/khoTau";
import { chuyenHangTx, conTrongKho, hangTrongKho, taoKhoChuan } from "@/lib/khoTauServer";
import { TU_DIEN } from "@/lib/i18n/tuDien";

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

function kiemQuyUoc() {
  console.log("\n=== 1) Quy uoc ma kho ===");
  kiemTra(
    "khoi doc tu ma",
    ["ML-001-ENG", "ML-001-ENG-ECR", "ML-001-DECK-STORE", "ML-001-ENG-ER-STORE", "ML-001-STORE", "ml-002-deck", "WH-OFFICE", "ML-001-ENGINE"].map(loaiKhoTuMa),
    ["ENG", "ENG", "DECK", "ENG", "STORE", "DECK", null, null]
  );
  kiemTra("ma vi tri sau khoi", ["ML-001-ENG", "ML-001-ENG-ECR", "ML-001-ENG-ER-STORE", "WH-OFFICE"].map(hauToKho), ["", "ECR", "ER-STORE", ""]);
  kiemTra(
    "loc bo phan",
    [khoThuocBoPhan("ML-001-ENG-ECR", "ENG"), khoThuocBoPhan("ML-001-ENG-ECR", "DECK"), khoThuocBoPhan("ML-001-DECK-STORE", "STORE"), khoThuocBoPhan("WH-OFFICE", "ALL"), khoThuocBoPhan("WH-OFFICE", null)],
    [true, false, false, true, true]
  );
  kiemTra(
    "kho chinh: ma dung <tau>-<KHOI> truoc kho them (ke ca khi kho them dung truoc theo ma)",
    khoChinhTheoLoai([
      { id: 1, code: "ML-001-DECK-BOSUN" },
      { id: 2, code: "ML-001-DECK" },
      { id: 3, code: "ML-001-ENG-ECR" },
      { id: 4, code: "ML-001-ENG" },
      { id: 5, code: "ML-001-STORE" },
    ]),
    { DECK: 2, ENG: 4, STORE: 5 }
  );
  const ba = [
    { id: 1, code: "ML-001-ENG" },
    { id: 2, code: "ML-001-DECK" },
    { id: 3, code: "ML-001-STORE" },
  ];
  kiemTra(
    "kho cuoi cung cua khoi: khong xoa / doi khoi duoc; co kho cung khoi thi duoc",
    [laKhoCuoiCuaKhoi(ba[0], ba), laKhoCuoiCuaKhoi(ba[0], [...ba, { id: 4, code: "ML-001-ENG-ECR" }]), laKhoCuoiCuaKhoi({ id: 4, code: "ML-001-ENG-ECR" }, [...ba, { id: 4, code: "ML-001-ENG-ECR" }]), laKhoCuoiCuaKhoi({ id: 9, code: "WH-OFFICE" }, ba)],
    ["ENG", null, null, null]
  );
  kiemTra("kho chinh: khoi mat kho chuan thi lay kho dau tien cua khoi theo ma", khoChinhTheoLoai([{ id: 7, code: "ML-001-ENG-WORKSHOP" }, { id: 6, code: "ML-001-ENG-ECR" }, { id: 8, code: "WH-OFFICE" }]), { ENG: 6 });
  kiemTra(
    "chuan hoa ma vi tri",
    ["E/R store", "Kho sơn", "EM'CY gen. room", "  ecr ", "đường ống", "a---b", "Kho phụ tùng buồng máy số 2", "-x-"].map(chuanHoaHauTo),
    ["ER-STORE", "KHO-SON", "EMCY-GEN-ROOM", "ECR", "DUONG-ONG", "A-B", "KHO-PHU-TUNG-BUO", "X"]
  );
  kiemTra("ma vi tri khong qua do dai, khong duoi '-'", chuanHoaHauTo("abc def ghi jkl mno pqr").length <= DO_DAI_HAU_TO && !chuanHoaHauTo("abcdefghijklmno pqr").endsWith("-"), true);
  kiemTra("ghep ma kho", [maKho("ML-001", "ENG", "ecr"), maKho("ML-001", "DECK", ""), maKho("ML-001", "STORE", "Kho bếp")], ["ML-001-ENG-ECR", "ML-001-DECK", "ML-001-STORE-KHO-BEP"]);
  kiemTra(
    "ten kho kem ten tau, khong lap duoi",
    [tenKhoDayDu("Kho sơn", "M. ODYSSEY"), tenKhoDayDu("Kho sơn - M. ODYSSEY", "M. ODYSSEY"), tenKhoNgan("Kho máy - M. ODYSSEY", "M. ODYSSEY"), tenKhoNgan("Kho riêng", "M. ODYSSEY")],
    ["Kho sơn - M. ODYSSEY", "Kho sơn - M. ODYSSEY", "Kho máy", "Kho riêng"]
  );
  const vi = TU_DIEN.thietYeu.vi as Record<string, string>;
  const en = TU_DIEN.thietYeu.en as Record<string, string>;
  kiemTra("vi tri goi y: du ten VI + EN", VI_TRI_GOI_Y.filter((v) => !vi[`viTri_${v.khoa}`] || !en[`viTri_${v.khoa}`]).map((v) => v.khoa), []);
  kiemTra(
    "vi tri goi y: ma kho ghep ra doc lai dung khoi",
    VI_TRI_GOI_Y.filter((v) => loaiKhoTuMa(maKho("ML-001", v.loai, v.hauTo)) !== v.loai || hauToKho(maKho("ML-001", v.loai, v.hauTo)) !== v.hauTo).map((v) => v.khoa),
    []
  );
  kiemTra(
    "vi tri goi y: khoi + ma mau",
    ["ER_STORE", "ECR", "PAINT", "DECK_STORE", "BOSUN"].map((k) => {
      const v = VI_TRI_GOI_Y.find((x) => x.khoa === k)!;
      return maKho("ML-001", v.loai, v.hauTo);
    }),
    ["ML-001-ENG-ER-STORE", "ML-001-ENG-ECR", "ML-001-DECK-PAINT", "ML-001-DECK-STORE", "ML-001-DECK-BOSUN"]
  );
}

async function kiemDatabase() {
  console.log("\n=== 2) Database (cuon nguoc) ===");
  const khoMay = await prisma.warehouse.findFirst({
    where: { code: { endsWith: "-ENG" }, vesselId: { not: null }, inventories: { some: { quantity: { gt: 0 } } } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, vesselId: true, vessel: { select: { code: true, name: true } } },
  });
  if (!khoMay?.vesselId || !khoMay.vessel) {
    console.log("  Chua co kho may nao co hang — bo qua phan database (khong phai loi).");
    return;
  }
  const vesselId = khoMay.vesselId;
  // Hai mặt hàng của kho máy CÓ lịch sử nhập / xuất ở đó.
  const coLichSu = await prisma.inventoryTransaction.groupBy({ by: ["materialId"], where: { warehouseId: khoMay.id }, _count: { _all: true }, orderBy: { materialId: "asc" }, take: 50 });
  const dongMay = await prisma.inventory.findMany({ where: { warehouseId: khoMay.id, materialId: { in: coLichSu.map((g) => g.materialId) }, quantity: { gt: 0 } }, orderBy: { materialId: "asc" }, take: 2 });
  if (dongMay.length < 2) {
    console.log("  Kho may chua co 2 mat hang co lich su — bo qua phan database.");
    return;
  }
  const [a, b] = dongMay;
  const gdTruoc = new Map(coLichSu.map((g) => [g.materialId, g._count._all]));
  const MA_THU = `${khoMay.vessel.code}-ENG-KTTHU`;
  try {
    await prisma.$transaction(
      async (tx) => {
        const tongTau = async () => (await tx.inventory.aggregate({ where: { vesselId }, _sum: { quantity: true } }))._sum.quantity ?? 0;
        const tongMay = async () => {
          const kho = await tx.warehouse.findMany({ where: { vesselId }, select: { id: true, code: true } });
          const ids = kho.filter((k) => loaiKhoTuMa(k.code) === "ENG").map((k) => k.id);
          return (await tx.inventory.aggregate({ where: { warehouseId: { in: ids } }, _sum: { quantity: true } }))._sum.quantity ?? 0;
        };
        const tauTruoc = await tongTau();
        const mayTruoc = await tongMay();

        const moi = await tx.warehouse.create({ data: { code: MA_THU, name: tenKhoDayDu("Kho thử", khoMay.vessel!.name), warehouseType: "VESSEL", vesselId } });
        // Mặt hàng b đã có 5 ở kho mới (dòng không lịch sử) → chuyển sang thì cộng dồn.
        await tx.inventory.create({ data: { materialId: b.materialId, warehouseId: moi.id, vesselId, quantity: 5 } });
        kiemTra("kho them thuoc khoi May, kho chinh van la kho cu", [loaiKhoTuMa(moi.code), khoChinhTheoLoai(await tx.warehouse.findMany({ where: { vesselId }, select: { id: true, code: true } })).ENG], ["ENG", khoMay.id]);

        const hang = await hangTrongKho(tx, { id: khoMay.id, vesselId });
        kiemTra("hop chuyen hang: b biet da co 5 o kho moi", hang.find((h) => h.id === b.id)?.khoKhac.find((k) => k.khoId === moi.id)?.so, 5);

        const kq = await chuyenHangTx(tx, khoMay.id, moi.id, [a.id, b.id, -1]);
        kiemTra("chuyen 2 mat hang, 1 cong don", [kq.soMatHang, kq.soGop], [2, 1]);
        kiemTra("lich su nhap xuat di theo", kq.soGiaoDich, (gdTruoc.get(a.materialId) ?? 0) + (gdTruoc.get(b.materialId) ?? 0));
        const sauA = await tx.inventory.findUnique({ where: { id: a.id }, select: { warehouseId: true, quantity: true } });
        const sauB = await tx.inventory.findUnique({ where: { materialId_warehouseId: { materialId: b.materialId, warehouseId: moi.id } }, select: { quantity: true } });
        kiemTra("a: dong ton doi kho, giu nguyen so", [sauA?.warehouseId === moi.id, sauA?.quantity], [true, a.quantity]);
        kiemTra("b: cong vao dong co san, dong cu da bo", [sauB?.quantity, await tx.inventory.count({ where: { id: b.id } })], [b.quantity + 5, 0]);
        kiemTra(
          "kho cu khong con dong nhap xuat cua a, b",
          await tx.inventoryTransaction.count({ where: { warehouseId: khoMay.id, materialId: { in: [a.materialId, b.materialId] } } }),
          0
        );
        kiemTra("tong ton cua tau: chi them 5 cua dong thu", (await tongTau()) - tauTruoc, 5);
        kiemTra("tong ton khoi May: chi them 5 cua dong thu", (await tongMay()) - mayTruoc, 5);
        const con = await conTrongKho(tx, moi.id);
        kiemTra("kho moi con hang + lich su -> chua xoa duoc", [con.dongTon, con.giaoDich > 0], [2, true]);

        const kq2 = await chuyenHangTx(tx, moi.id, khoMay.id, (await tx.inventory.findMany({ where: { warehouseId: moi.id }, select: { id: true } })).map((r) => r.id));
        kiemTra("chuyen nguoc ve: 2 mat hang, khong cong don", [kq2.soMatHang, kq2.soGop], [2, 0]);
        kiemTra("kho moi trong that -> xoa duoc", await conTrongKho(tx, moi.id), { dongTon: 0, giaoDich: 0, kiemKeCho: 0 });
        kiemTra("chuyen dong khong thuoc kho nguon: khong lam gi", (await chuyenHangTx(tx, moi.id, khoMay.id, [a.id])).soMatHang, 0);

        const tau = await tx.vessel.create({ data: { code: "KT-KHO-9", name: "TAU THU KHO" } });
        await taoKhoChuan(tx, tau);
        const khoTam = await tx.warehouse.findMany({ where: { vesselId: tau.id }, orderBy: { code: "asc" }, select: { code: true, name: true, warehouseType: true } });
        kiemTra("tau moi co 3 kho chuan", khoTam, [
          { code: "KT-KHO-9-DECK", name: "Kho boong - TAU THU KHO", warehouseType: "VESSEL" },
          { code: "KT-KHO-9-ENG", name: "Kho máy - TAU THU KHO", warehouseType: "VESSEL" },
          { code: "KT-KHO-9-STORE", name: "Kho vật tư tiêu hao - TAU THU KHO", warehouseType: "VESSEL" },
        ]);
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  kiemTra("da cuon nguoc (khong con kho thu, tau thu)", [await prisma.warehouse.count({ where: { code: MA_THU } }), await prisma.vessel.count({ where: { code: "KT-KHO-9" } })], [0, 0]);
  const aSau = await prisma.inventory.findUnique({ where: { id: a.id }, select: { warehouseId: true, quantity: true } });
  kiemTra("du lieu that nguyen ven", [aSau?.warehouseId, aSau?.quantity], [khoMay.id, a.quantity]);
}

kiemQuyUoc();
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
