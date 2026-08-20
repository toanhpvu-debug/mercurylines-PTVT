import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { warehouseKindForSheet, type ImportedItem } from "@/lib/materialImport";

// Ghi kết quả đọc file vào database: tạo/ghép vật tư, gán vào danh mục tàu,
// và ghi tồn kho (R.O.B) nếu người dùng chọn kho.
// Tách khỏi server action để chạy kiểm thử được với dữ liệu thật.

export type ApplyImportInput = {
  vesselId: number;
  /** Kho ghi tồn cố định cho mọi dòng; null = không ghi tồn. */
  warehouseId: number | null;
  /**
   * Chế độ "tự động theo sheet": ánh xạ bộ phận kho (ENG/DECK/STORE) sang id kho
   * của tàu. Có giá trị thì được ưu tiên hơn warehouseId.
   */
  warehouseByKind?: Partial<Record<"ENG" | "DECK" | "STORE", number>> | null;
  /** Loại dùng khi không suy được từ tên sheet và dòng không có nhóm thiết bị. */
  fallbackKind: string;
  items: ImportedItem[];
  fileName: string;
  actorName: string;
};

export type ApplyImportResult = {
  createdCount: number;
  linkedCount: number;
  robCount: number;
  /** Lỗi trùng mã do hai phiên nhập chạy song song — người dùng chỉ cần bấm lại. */
  conflict?: boolean;
};

export async function applyMaterialImport(
  input: ApplyImportInput
): Promise<ApplyImportResult> {
  const {
    vesselId,
    warehouseId,
    warehouseByKind,
    fallbackKind: kind,
    items,
    fileName,
    actorName,
  } = input;
  // Kho ghi tồn cho từng dòng: ưu tiên ánh xạ theo sheet, không có thì dùng kho cố định.
  const warehouseFor = (item: ImportedItem): number | null => {
    if (warehouseByKind) {
      return warehouseByKind[warehouseKindForSheet(item.sheet)] ?? null;
    }
    return warehouseId;
  };
  // Ghép với vật tư sẵn có: theo IMPA, hoặc Part No, hoặc tên + thiết bị
  // (cùng tên nhưng khác thiết bị — VD "Bạc trục" Máy chính vs Máy phát — là 2 phụ tùng khác nhau).
  const existing = await prisma.material.findMany();
  const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const nameKey = (name: string, equipment: string | null) =>
    `${norm(name)}|${equipment ? norm(equipment) : ""}`;
  const byImpa = new Map(
    existing.filter((m) => m.impa).map((m) => [norm(m.impa as string), m])
  );
  const byPn = new Map(
    existing
      .filter((m) => m.partNumber)
      .map((m) => [norm(m.partNumber as string), m])
  );
  const byName = new Map(existing.map((m) => [nameKey(m.nameVn, m.equipment), m]));

  // Sinh mã ML-IMP-#### không trùng.
  let importSeq =
    existing.filter((m) => m.code.startsWith("ML-IMP-")).length + 1;
  const usedCodes = new Set(existing.map((m) => m.code));
  const nextCode = () => {
    let code = `ML-IMP-${String(importSeq).padStart(4, "0")}`;
    while (usedCodes.has(code)) {
      importSeq++;
      code = `ML-IMP-${String(importSeq).padStart(4, "0")}`;
    }
    importSeq++;
    usedCodes.add(code);
    return code;
  };

  let createdCount = 0;
  let linkedCount = 0;
  let robCount = 0;
  const categoryCache = new Map<string, number>();

  try {
    await prisma.$transaction(async (tx) => {
    for (const item of items) {
      // 1) Tìm hoặc tạo vật tư
      let material =
        (item.impa && byImpa.get(norm(item.impa))) ||
        (item.partNumber && byPn.get(norm(item.partNumber))) ||
        byName.get(nameKey(item.name, item.equipment)) ||
        null;
      if (!material) {
        // Nhóm (Group) → Category: tìm theo TÊN trước; slug bỏ dấu tiếng Việt,
        // nếu trùng mã với nhóm khác tên thì thêm hậu tố -2, -3...
        let categoryId: number | null = null;
        if (item.group) {
          const key = norm(item.group);
          if (categoryCache.has(key)) {
            categoryId = categoryCache.get(key)!;
          } else {
            let cat = await tx.category.findFirst({
              where: { name: item.group },
            });
            if (!cat) {
              const slugBase = key
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/đ/g, "d")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 40);
              let catCode = `CAT-${slugBase || "nhom"}`;
              let suffix = 2;
              while (await tx.category.findUnique({ where: { code: catCode } })) {
                catCode = `CAT-${slugBase || "nhom"}-${suffix++}`;
              }
              cat = await tx.category.create({
                data: { code: catCode, name: item.group },
              });
            }
            categoryId = cat.id;
            categoryCache.set(key, cat.id);
          }
        }
        material = await tx.material.create({
          data: {
            code: nextCode(),
            nameVn: item.name,
            impa: item.impa,
            partNumber: item.partNumber,
            uom: item.uom || "PCS",
            // Ưu tiên loại suy ra từ sheet ("Phụ tùng (Spare Parts)" / "Vật tư Boong");
            // không suy được thì có thiết bị đi kèm → phụ tùng, còn lại theo loại đã chọn.
            materialType:
              item.materialType ?? (item.equipment ? "SPARE" : kind),
            equipment: item.equipment,
            categoryId,
            minStock: item.minStock,
          },
        });
        byName.set(nameKey(item.name, item.equipment), material);
        if (item.impa) byImpa.set(norm(item.impa), material);
        if (item.partNumber) byPn.set(norm(item.partNumber), material);
        createdCount++;
      } else {
        linkedCount++;
      }
      // 2) Gán vào danh mục tàu
      await tx.vesselMaterial.upsert({
        where: {
          vesselId_materialId: { vesselId, materialId: material.id },
        },
        update: {},
        create: { vesselId, materialId: material.id },
      });
      // 3) Ghi tồn kho (R.O.B) nếu file có số tồn và xác định được kho cho dòng này
      const targetWarehouseId = warehouseFor(item);
      if (targetWarehouseId && item.rob !== null) {
        const inv = await tx.inventory.findUnique({
          where: {
            materialId_warehouseId: {
              materialId: material.id,
              warehouseId: targetWarehouseId,
            },
          },
        });
        const current = inv?.quantity ?? 0;
        const delta = item.rob - current;
        await tx.inventory.upsert({
          where: {
            materialId_warehouseId: {
              materialId: material.id,
              warehouseId: targetWarehouseId,
            },
          },
          update: { quantity: item.rob },
          create: {
            materialId: material.id,
            warehouseId: targetWarehouseId,
            vesselId,
            quantity: item.rob,
          },
        });
        if (delta !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              type: delta > 0 ? "IN" : "OUT",
              materialId: material.id,
              warehouseId: targetWarehouseId,
              vesselId,
              quantity: Math.abs(delta),
              note: `Kiểm kê từ file ${fileName}`,
              performedBy: actorName,
            },
          });
        }
        robCount++;
      }
    }
    }, { timeout: 60000, maxWait: 10000 }); // file lớn (tới 500 dòng × nhiều ghi) cần quá 5s mặc định
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2028", "P2034"].includes(error.code)
    ) {
      return { createdCount: 0, linkedCount: 0, robCount: 0, conflict: true };
    }
    throw error;
  }
  return { createdCount, linkedCount, robCount };
}
