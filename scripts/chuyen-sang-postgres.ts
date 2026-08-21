/**
 * Chuyển toàn bộ dữ liệu từ SQLite (prisma/dev.db) sang PostgreSQL.
 *
 * Chạy:
 *   1. Đặt DATABASE_URL trong .env thành chuỗi kết nối PostgreSQL
 *   2. npx prisma migrate deploy        (tạo bảng trống bên Postgres)
 *   3. chuyen-sang-postgres.cmd         (chạy file này)
 *
 * Dùng Prisma ở CẢ HAI ĐẦU nên không phải tự chuyển kiểu dữ liệu: SQLite lưu
 * DateTime thành số epoch và Boolean thành 0/1, Prisma đọc ra Date/boolean rồi
 * ghi sang Postgres đúng kiểu.
 *
 * An toàn: chỉ ĐỌC file SQLite, không sửa. Chạy lại được — mặc định dừng nếu
 * Postgres đã có dữ liệu, thêm --ghi-de để xoá sạch bên Postgres rồi chép lại.
 */
import { PrismaClient as PgClient } from "@prisma/client";
import { PrismaClient as SqliteClient } from ".prisma/client-sqlite";

const GHI_DE = process.argv.includes("--ghi-de");

const pg = new PgClient();
const lite = new SqliteClient({
  datasources: { db: { url: "file:./prisma/dev.db" } },
});

/**
 * Thứ tự chép PHẢI tôn trọng khóa ngoại: bảng cha trước, bảng con sau.
 * Xoá thì đi ngược lại danh sách này.
 */
const BANG = [
  // Vessel trước User: User.vesselId trỏ tới Vessel.
  "vessel",
  "user",
  "warehouse",
  "category",
  "material",
  "supplier",
  "formStandard",
  "paintProduct",
  "vesselMaterial",
  "inventory",
  "inventoryTransaction",
  "reportDocument",
  "lashingGear",
  "lashingReport",
  "lashingReportLine",
  "materialRequest",
  "materialRequestItem",
  "materialRequestEvent",
  "purchaseOrder",
  "purchaseOrderItem",
  "paintArea",
  "paintSchemeLayer",
  "paintStock",
  "paintJob",
  "paintJobLine",
  "paintTransaction",
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const bang = (client: any, ten: string) => client[ten];

async function dem(client: unknown, ten: string): Promise<number> {
  return bang(client, ten).count();
}

async function main() {
  console.log("=== CHUYỂN DỮ LIỆU SQLite → PostgreSQL ===\n");

  // 1. Kiểm tra kết nối Postgres trước khi làm gì
  try {
    await pg.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error(
      "Không kết nối được PostgreSQL. Kiểm tra DATABASE_URL trong .env.\n" +
        (e as Error).message
    );
    process.exit(1);
  }

  // 2. Postgres đã có dữ liệu thì dừng, tránh chép chồng
  let daCo = 0;
  for (const t of BANG) daCo += await dem(pg, t);
  if (daCo > 0 && !GHI_DE) {
    console.error(
      `PostgreSQL đã có ${daCo} bản ghi. Dừng lại để không chép chồng.\n` +
        "Muốn xoá sạch bên Postgres rồi chép lại: thêm tham số --ghi-de"
    );
    process.exit(1);
  }
  if (daCo > 0 && GHI_DE) {
    console.log(`Xoá ${daCo} bản ghi đang có bên PostgreSQL...`);
    for (const t of [...BANG].reverse()) {
      await bang(pg, t).deleteMany({});
    }
    console.log("Đã xoá sạch.\n");
  }

  // 3. Chép từng bảng theo đúng thứ tự khóa ngoại
  let tong = 0;
  const loi: string[] = [];
  for (const t of BANG) {
    const rows = await bang(lite, t).findMany();
    if (!rows.length) {
      console.log(`  ${t.padEnd(24)} —`);
      continue;
    }
    try {
      // createMany giữ nguyên id nên quan hệ giữa các bảng không đứt.
      await bang(pg, t).createMany({ data: rows });
      const sau = await dem(pg, t);
      const dau = "✓";
      console.log(
        `  ${dau} ${t.padEnd(22)} ${String(rows.length).padStart(5)} → ${sau}`
      );
      if (sau !== rows.length) {
        loi.push(`${t}: chép ${rows.length} nhưng đếm được ${sau}`);
      }
      tong += rows.length;
    } catch (e) {
      loi.push(`${t}: ${(e as Error).message.split("\n")[0]}`);
      console.log(`  ✗ ${t.padEnd(22)} LỖI`);
    }
  }

  // 4. Đặt lại bộ đếm id của Postgres.
  //    Bắt buộc: chép id sẵn có không làm bộ đếm nhảy theo, không đặt lại thì
  //    bản ghi mới tạo sau này sẽ trùng id và báo lỗi khóa chính.
  console.log("\nĐặt lại bộ đếm id (sequence)...");
  const bangDb = [
    "Vessel", "User", "Warehouse", "Category", "Material", "Supplier",
    "FormStandard", "PaintProduct", "VesselMaterial", "Inventory",
    "InventoryTransaction", "ReportDocument", "LashingGear", "LashingReport",
    "LashingReportLine", "MaterialRequest", "MaterialRequestItem",
    "MaterialRequestEvent", "PurchaseOrder", "PurchaseOrderItem", "PaintArea",
    "PaintSchemeLayer", "PaintStock", "PaintJob", "PaintJobLine",
    "PaintTransaction",
  ];
  for (const b of bangDb) {
    await pg.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${b}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${b}"), 0) + 1, false)`
    );
  }
  console.log(`Đã đặt lại ${bangDb.length} bộ đếm.`);

  // 5. Đối chiếu số lượng từng bảng giữa hai bên
  console.log("\n=== ĐỐI CHIẾU ===");
  let lech = 0;
  for (const t of BANG) {
    const a = await dem(lite, t);
    const b = await dem(pg, t);
    if (a !== b) {
      console.log(`  LỆCH ${t}: SQLite ${a} ≠ PostgreSQL ${b}`);
      lech++;
    }
  }
  console.log(
    lech === 0
      ? `Khớp toàn bộ ${BANG.length} bảng · ${tong} bản ghi.`
      : `${lech} bảng bị lệch — xem ở trên.`
  );
  if (loi.length) {
    console.log("\nLỗi gặp phải:");
    for (const l of loi) console.log("  - " + l);
  }

  await pg.$disconnect();
  await lite.$disconnect();
  process.exit(lech === 0 && loi.length === 0 ? 0 : 1);
}

main();
