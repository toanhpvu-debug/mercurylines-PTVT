/**
 * Kiểm KIỂM SOÁT TỒN KHO THEO CHỨC DANH (lib/tonTheoChucDanh.ts — khung "Kiểm soát tồn kho theo
 * chức danh" và ô lọc ?rank= ở trang Tồn kho): gom dòng tồn theo chức danh giữ, đếm thiếu / hết,
 * thứ tự bộ phận / chức danh; rồi đối chiếu trên database (CHỈ ĐỌC): tổng các chức danh = tổng
 * dòng tồn của tàu, lọc một chỉ huy = cộng đúng phần các chức danh nó bao trùm.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-ton-chuc-danh.ts
 */
import { PrismaClient } from "@prisma/client";
import { chucDanhGiuCua, tonTheoChucDanh, type DongTonCoChucDanh } from "@/lib/tonTheoChucDanh";
import { chucDanhBaoTrum, chucDanhChiuTrachNhiem, phamViChucDanh } from "@/lib/chucDanhChiuTrachNhiem";

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

function kiemGom() {
  console.log("\n=== 1) Gom dong ton theo chuc danh ===");
  kiemTra("rong -> khong nhom nao", tonTheoChucDanh([]), []);
  const d = (s: string) => new Date(s);
  const ds: DongTonCoChucDanh[] = [
    { chucDanh: "2E", khaDung: 5, minStock: 2, capNhat: d("2026-08-01T00:00:00Z") },
    { chucDanh: "CE", khaDung: 0, minStock: 0, capNhat: null },
    { chucDanh: " 2E ", khaDung: 1, minStock: 2, capNhat: d("2026-09-15T00:00:00Z") },
    { chucDanh: "BSN", khaDung: 3, minStock: 0, capNhat: null },
    { chucDanh: null, khaDung: 0, minStock: 1, capNhat: null },
    { chucDanh: "XYZ", khaDung: 2, minStock: 1, capNhat: null },
    { chucDanh: "CCK", khaDung: -1, minStock: 0, capNhat: d("2026-07-01T00:00:00Z") },
  ];
  const g = tonTheoChucDanh(ds);
  kiemTra(
    "thu tu bo phan: Boong -> May -> Phuc vu -> khac (Dien khong co dong thi bo)",
    g.map((x) => x.boPhan),
    ["D", "E", "C", null]
  );
  kiemTra(
    "trong bo phan theo thu tu CHUC_DANH (CE truoc 2E du nhap sau); khoang trang quanh ma bi bo",
    g.find((x) => x.boPhan === "E")?.dong.map((x) => x.chucDanh),
    ["CE", "2E"]
  );
  kiemTra(
    "dem: 2E 2 dong, 1 thieu (1 <= 2), 0 het; CE 0 <= 0 la thieu va het",
    g.find((x) => x.boPhan === "E")?.dong.map((x) => [x.chucDanh, x.soDong, x.thieu, x.het]),
    [["CE", 1, 1, 1], ["2E", 2, 1, 0]]
  );
  kiemTra("tong nhom May: 3 dong, 2 thieu, 1 het", [g[1].soDong, g[1].thieu, g[1].het], [3, 2, 1]);
  kiemTra(
    "nhap / xuat gan nhat = ngay moi nhat cua cac dong; khong co -> null",
    [g[1].dong.find((x) => x.chucDanh === "2E")?.capNhat?.toISOString(), g[1].dong.find((x) => x.chucDanh === "CE")?.capNhat],
    ["2026-09-15T00:00:00.000Z", null]
  );
  kiemTra(
    "chuc danh la va chua xac dinh vao nhom khac, null truoc",
    g[3].dong.map((x) => [x.chucDanh, x.thieu, x.het]),
    [[null, 1, 1], ["XYZ", 0, 0]]
  );
  kiemTra("ton am van la het hang (CCK -1)", g[2].dong.map((x) => [x.chucDanh, x.thieu, x.het]), [["CCK", 1, 1]]);
}

function kiemChucDanhGiu() {
  console.log("\n=== 2) Chuc danh giu cua mot dong ton ===");
  const goc = {
    code: "E-SPR-0001",
    nameVn: "1st stage combined air valve",
    nameEn: null,
    impa: null,
    materialType: "SPARE",
    equipment: null,
    department: "ENGINE",
    nhomQuanLy: null,
    responsibleRank: null,
    category: { code: "CAT-main-engine", name: "Main Engine" },
  };
  kiemTra("phu tung may chinh -> May hai", chucDanhGiuCua(goc), "2E");
  kiemTra("da gan tay thi theo gan tay", chucDanhGiuCua({ ...goc, responsibleRank: "4E" }), "4E");
  kiemTra(
    "dung y het chucDanhChiuTrachNhiem (cung bo cot bao cao quy / MLS-11-06)",
    chucDanhGiuCua({ ...goc, category: null }),
    chucDanhChiuTrachNhiem({ ...goc, categoryCode: null, categoryName: null })?.chucDanh ?? null
  );
}

async function kiemDatabase() {
  console.log("\n=== 3) Doi chieu tren database (chi doc) ===");
  const ton = await prisma.inventory.findMany({
    select: {
      vesselId: true,
      quantity: true,
      reservedQuantity: true,
      material: {
        select: {
          code: true,
          nameVn: true,
          nameEn: true,
          impa: true,
          materialType: true,
          equipment: true,
          department: true,
          nhomQuanLy: true,
          responsibleRank: true,
          minStock: true,
          category: { select: { code: true, name: true } },
        },
      },
    },
  });
  const tauIds = [...new Set(ton.map((x) => x.vesselId))];
  if (!tauIds.length) {
    console.log("  (database khong co dong ton nao — bo qua phan doi chieu)");
    return;
  }
  let lechTong = 0;
  let lechChiHuy = 0;
  let chuaRo = 0;
  for (const tauId of tauIds) {
    const dong = ton.filter((x) => x.vesselId === tauId).map((x) => ({ x, cd: chucDanhGiuCua(x.material) }));
    const nhom = tonTheoChucDanh(
      dong.map(({ x, cd }) => ({ chucDanh: cd, khaDung: x.quantity - x.reservedQuantity, minStock: x.material.minStock, capNhat: null }))
    );
    const tong = nhom.reduce((s, g) => s + g.soDong, 0);
    if (tong !== dong.length) lechTong++;
    chuaRo += dong.filter(({ cd }) => cd === null).length;
    const soCua = new Map(nhom.flatMap((g) => g.dong.map((d) => [d.chucDanh, d.soDong] as const)));
    for (const chiHuy of ["MST", "CO", "CE", "ETO", "CCK"]) {
      const loc = dong.filter(({ cd }) => chucDanhBaoTrum(chiHuy, cd)).length;
      const cong = phamViChucDanh(chiHuy).reduce((s, c) => s + (soCua.get(c) ?? 0), 0);
      if (loc !== cong) lechChiHuy++;
    }
  }
  kiemTra(`${tauIds.length} tau: tong so dong cac chuc danh = so dong ton cua tau`, lechTong, 0);
  kiemTra("loc chi huy (MST, CO, CE, ETO, CCK) = cong dung phan cac chuc danh no bao trum", lechChiHuy, 0);
  console.log(`  (thong tin) ${ton.length} dong ton, ${chuaRo} dong chua xac dinh chuc danh`);
}

kiemGom();
kiemChucDanhGiu();
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
