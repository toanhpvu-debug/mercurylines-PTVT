import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { departmentOfMaterial } from "@/lib/departments";
import {
  doanLoai,
  sinhMaNgan,
  sttTheoNhom,
  type BoPhan,
} from "@/lib/maVatTu";
import { warehouseKindForSheet, type ImportedItem } from "@/lib/materialImport";

// Ghi kết quả đọc file vào database: tạo/ghép vật tư, gán vào danh mục tàu,
// và ghi tồn kho (R.O.B) nếu người dùng chọn kho.
// Tách khỏi server action để chạy kiểm thử được với dữ liệu thật.

/**
 * Nhóm hiển thị (6 nhóm của giao diện) → bộ phận trong mã (4 chữ cái).
 *
 * Bảo hộ lao động thuộc bộ phận boong; "Khác" chỉ còn lại với vật tư (phụ tùng
 * không đoán được bộ phận đã bị đẩy sang Máy) mà vật tư không rõ nhóm thì gần
 * như luôn là hàng boong.
 */
const BO_PHAN_THEO_NHOM: Record<string, string> = {
  DECK: "D",
  ENGINE: "E",
  ELEC: "L",
  SERVICE: "C",
  SAFETY: "D",
  OTHER: "D",
};

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
  /**
   * Những khuôn (`D-IMPA`, `E-SPR`...) đã có nhóm kín khối nên mã mới phải xếp
   * tạm vào đuôi dãy. Không phải lỗi — nhưng im lặng thì bố cục khối cứ xấu dần
   * mà không ai biết để chạy `doi-ma-vat-tu.cmd --theo-nhom`.
   */
  khoiDay?: string[];
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

  // Sinh mã không trùng, theo KHUÔN ĐANG DÙNG của lib/maVatTu.ts:
  //
  //   D-IMPA-####  vật tư boong        D-SPR-####  phụ tùng boong
  //   E-IMPA-####  vật tư máy          E-SPR-####  phụ tùng máy
  //   L-IMPA-####  vật tư điện         L-SPR-####  phụ tùng điện
  //   C-IMPA-####  vật tư phục vụ      C-SPR-####  phụ tùng phục vụ
  //
  // Khuôn, bố cục khối và bộ đếm đều gọi sang `lib/maVatTu.ts` chứ không tự
  // ghép chuỗi ở đây: một quy ước mã mà có hai nơi cùng sinh thì sớm muộn hai
  // nơi nói khác nhau, và nơi sai là nơi không ai đọc lại.
  //
  // Số mới rơi vào ĐÚNG KHỐI của nhóm vật tư, không phải cứ nối vào cuối dãy —
  // xem `sttTheoNhom`. Nhờ vậy hàng cùng nhóm có mã liền nhau, và người đi kiểm
  // kê đọc danh sách theo đúng thứ tự họ đi qua kệ hàng.
  const daCap: { ma: string; nhom: string | number | null }[] = existing.map(
    (m) => ({ ma: m.code, nhom: m.categoryId })
  );
  const usedCodes = new Set(existing.map((m) => m.code));
  /** Nhóm nào đã kín khối — gom lại để báo một lần, không kêu từng dòng. */
  const khoiDayCuaNhom = new Set<string>();

  const nextCode = (
    boPhan: string,
    materialType: string,
    categoryId: number | null
  ) => {
    const loai = doanLoai(materialType);
    const cho = sttTheoNhom(boPhan as BoPhan, loai, daCap, categoryId);
    if (!cho.trongKhoi) khoiDayCuaNhom.add(`${boPhan}-${loai}`);
    let seq = cho.stt;
    let kq = sinhMaNgan({ boPhan: boPhan as BoPhan, loai, stt: seq });
    while ("ma" in kq && usedCodes.has(kq.ma)) {
      seq++;
      kq = sinhMaNgan({ boPhan: boPhan as BoPhan, loai, stt: seq });
    }
    if ("loi" in kq) throw new Error(`Không sinh được mã cho ${boPhan}-${loai}: ${kq.loi}`);
    usedCodes.add(kq.ma);
    daCap.push({ ma: kq.ma, nhom: categoryId });
    return kq.ma;
  };

  // Cấp mã theo thứ tự NHÓM rồi TÊN HÀNG, không theo thứ tự dòng trong file
  // Excel. Thứ tự dòng trong file là ngẫu nhiên với người nhập — cùng một danh
  // sách gõ lại lần nữa là ra bộ mã khác. Sắp trước khi cấp thì nhập bao nhiêu
  // lần cũng ra cùng một kết quả, và trong mỗi nhóm mã chạy đúng thứ tự A→Z.
  //
  // Chỉ đổi THỨ TỰ CẤP MÃ: dòng nào ghép vào hàng có sẵn, dòng nào ghi tồn kho
  // đều không phụ thuộc thứ tự nên kết quả nhập không đổi.
  const soSanh = new Intl.Collator("vi").compare;
  const itemsTheoThuTu = [...items].sort(
    (a, b) =>
      soSanh(a.group ?? "", b.group ?? "") ||
      soSanh(a.equipment ?? "", b.equipment ?? "") ||
      soSanh(a.name ?? "", b.name ?? "")
  );

  let createdCount = 0;
  let linkedCount = 0;
  let robCount = 0;
  const categoryCache = new Map<string, number>();

  try {
    await prisma.$transaction(async (tx) => {
    for (const item of itemsTheoThuTu) {
      // 1) Tìm hoặc tạo vật tư
      let material =
        (item.impa && byImpa.get(norm(item.impa))) ||
        (item.partNumber && byPn.get(norm(item.partNumber))) ||
        byName.get(nameKey(item.name, item.equipment)) ||
        null;
      // Nhận nuôi bản ghi cũ: trước đây cột "Nhóm" không được đổ vào ô thiết bị
      // nên phụ tùng đã nhập đang mang equipment = null. Không có nhánh này thì
      // lần nhập đầu tiên sau khi sửa sẽ nhân đôi toàn bộ phụ tùng cũ.
      if (!material && item.equipment) {
        const cu = byName.get(nameKey(item.name, null));
        if (cu && !cu.equipment) {
          material = await tx.material.update({
            where: { id: cu.id },
            data: { equipment: item.equipment },
          });
          byName.delete(nameKey(item.name, null));
          byName.set(nameKey(item.name, item.equipment), material);
        }
      }
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
        // Ưu tiên loại suy ra từ sheet ("Phụ tùng (Spare Parts)" / "Vật tư Boong");
        // không suy được thì có thiết bị đi kèm → phụ tùng, còn lại theo loại
        // đã chọn. Phải chốt loại TRƯỚC khi sinh mã, vì mã đi theo loại.
        const loaiHang = item.materialType ?? (item.equipment ? "SPARE" : kind);
        // Bộ phận suy từ nhóm / thiết bị / tên — cùng một hàm mà giao diện dùng
        // để gom nhóm, nên mã và chỗ hiển thị không bao giờ nói hai điều khác
        // nhau về cùng một món hàng.
        const boPhan =
          BO_PHAN_THEO_NHOM[
            departmentOfMaterial(
              [item.group, item.equipment, item.name],
              loaiHang
            )
          ] ?? "D";
        material = await tx.material.create({
          data: {
            code: nextCode(boPhan, loaiHang, categoryId),
            department: boPhan,
            nameVn: item.name,
            impa: item.impa,
            partNumber: item.partNumber,
            uom: item.uom || "PCS",
            materialType: loaiHang,
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
  return {
    createdCount,
    linkedCount,
    robCount,
    khoiDay: [...khoiDayCuaNhom].sort(),
  };
}
