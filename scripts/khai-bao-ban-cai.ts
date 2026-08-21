/**
 * Khai báo bản cài này là của TÀU nào, hay là bản VĂN PHÒNG.
 *
 * Chạy:
 *   khai-bao-ban-cai.cmd ML-001     → bản cài trên tàu M. ODYSSEY
 *   khai-bao-ban-cai.cmd VANPHONG   → bản cài ở văn phòng
 *
 * Với bản cài trên tàu, script còn ĐẶT DẢI ID RIÊNG cho tàu đó. Đây là điểm
 * mấu chốt để gộp dữ liệu: hai tàu cùng tạo bản ghi mới mà dùng chung dải id
 * thì khi gửi về văn phòng sẽ đụng nhau. Mỗi tàu một triệu id riêng:
 *   ML-001 → từ 1.000.000    ML-002 → từ 2.000.000    ...
 * Văn phòng giữ dải 1 → 999.999.
 */
import { prisma } from "@/lib/prisma";
import { daiIdChoTau, sqlDatLaiBoDem } from "@/lib/sync";

// Bảng nào tàu có thể tạo bản ghi mới → cần đặt dải id riêng.
const BANG_TAU_GHI = [
  "Warehouse", "VesselMaterial", "Inventory", "InventoryTransaction",
  "MaterialRequest", "MaterialRequestItem", "MaterialRequestEvent",
  "PurchaseOrder", "PurchaseOrderItem", "LashingGear", "LashingReport",
  "LashingReportLine", "PaintArea", "PaintSchemeLayer", "PaintStock",
  "PaintJob", "PaintJobLine", "PaintTransaction", "ReportDocument",
];

async function main() {
  const arg = (process.argv[2] ?? "").trim().toUpperCase();
  if (!arg) {
    console.error(
      "Thiếu tham số.\n" +
        "  khai-bao-ban-cai.cmd ML-001     (bản cài trên tàu)\n" +
        "  khai-bao-ban-cai.cmd VANPHONG   (bản cài văn phòng)"
    );
    process.exit(1);
  }

  const laVanPhong = arg === "VANPHONG" || arg === "VAN-PHONG";
  let vesselCode: string | null = null;
  let dai = 0;

  if (!laVanPhong) {
    const vessel = await prisma.vessel.findUnique({ where: { code: arg } });
    if (!vessel) {
      const ds = await prisma.vessel.findMany({
        select: { code: true, name: true },
        orderBy: { code: "asc" },
      });
      console.error(
        `Không thấy tàu có mã "${arg}". Các mã đang có:\n` +
          ds.map((v) => `  ${v.code} — ${v.name}`).join("\n")
      );
      process.exit(1);
    }
    vesselCode = vessel.code;
    dai = daiIdChoTau(vessel.code);
  }

  await prisma.siteConfig.upsert({
    where: { id: 1 },
    update: { vesselCode, idRangeStart: BigInt(dai) },
    create: { id: 1, vesselCode, idRangeStart: BigInt(dai) },
  });

  console.log("=== KHAI BÁO BẢN CÀI ===");
  console.log(
    laVanPhong ? "Bản cài: VĂN PHÒNG" : `Bản cài: TÀU ${vesselCode}`
  );

  if (!laVanPhong) {
    console.log(`Dải id riêng: từ ${dai.toLocaleString("vi-VN")}\n`);
    console.log("Đặt bộ đếm id cho các bảng tàu có thể ghi:");
    for (const db of BANG_TAU_GHI) {
      await prisma.$executeRawUnsafe(sqlDatLaiBoDem(db, dai));
    }
    console.log(`  đã đặt ${BANG_TAU_GHI.length} bảng.`);
    console.log(
      "\nTừ giờ bản ghi tạo trên tàu này mang id riêng, gộp về văn phòng không đụng tàu khác."
    );
  } else {
    console.log("Văn phòng giữ dải id 1 → 999.999, không đổi bộ đếm.");
  }

  await prisma.$disconnect();
}

main();
