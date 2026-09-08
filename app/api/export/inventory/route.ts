import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { LAP_YEU_CAU } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Xuất kiểm kê vật tư & phụ tùng của một tàu theo đúng form công ty MLS-11-06:
// điền dữ liệu thật (danh mục tàu + tồn kho + nhận/tiêu thụ trong tháng) vào template gốc.
export async function GET(request: Request) {
  // Danh sách vai trò cứng ["ADMIN","MASTER","CREW"] là di sản từ thời hệ
  // thống chỉ có 3 vai trò. Nay có 11 chức danh: máy trưởng, đại phó, phó 2/3,
  // máy 2/3/4 đều TẢI LÊN / xem được ở giao diện, và quản lý kỹ thuật là người
  // soát chứng từ toàn đội. Chống xem chéo tàu vẫn do trongPhamVi() lo.
  const user = await requireActiveRole([...LAP_YEU_CAU, "TECH_MANAGER"]);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const scope = vesselScopeDayDu(user);
  const url = new URL(request.url);
  const vesselId = Number(url.searchParams.get("vessel"));
  const typeRaw = String(url.searchParams.get("type") || "ALL");
  const type = ["ALL", "STORE", "SPARE"].includes(typeRaw) ? typeRaw : "ALL";
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return NextResponse.json({ error: "Thiếu tàu." }, { status: 400 });
  }
  if (!trongPhamVi(scope, vesselId)) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [links, inventoryGroup, monthTx] = await Promise.all([
    prisma.vesselMaterial.findMany({
      where: {
        vesselId,
        material: {
          isActive: true,
          ...(type === "ALL" ? {} : { materialType: type }),
        },
      },
      include: { material: { include: { category: true } } },
    }),
    prisma.inventory.groupBy({
      by: ["materialId"],
      where: { vesselId },
      _sum: { quantity: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: { vesselId, occurredAt: { gte: monthStart } },
      select: { materialId: true, type: true, quantity: true },
    }),
  ]);

  const stockByMat = new Map(
    inventoryGroup.map((r) => [r.materialId, Number(r._sum.quantity ?? 0)])
  );
  const inByMat = new Map<number, number>();
  const outByMat = new Map<number, number>();
  for (const tx of monthTx) {
    const target = tx.type === "IN" ? inByMat : outByMat;
    target.set(tx.materialId, (target.get(tx.materialId) ?? 0) + tx.quantity);
  }

  // Bổ sung vật tư CÒN TỒN/CÓ GIAO DỊCH nhưng đã gỡ khỏi danh mục tàu —
  // bản kiểm kê phải phản ánh đủ hàng thực trên tàu.
  const linkedIds = new Set(links.map((l) => l.material.id));
  const extraIds = [
    ...new Set([
      ...inventoryGroup
        .filter((r) => Number(r._sum.quantity ?? 0) !== 0)
        .map((r) => r.materialId),
      ...monthTx.map((t) => t.materialId),
    ]),
  ].filter((id) => !linkedIds.has(id));
  const extraMaterials = extraIds.length
    ? await prisma.material.findMany({
        where: {
          id: { in: extraIds },
          ...(type === "ALL" ? {} : { materialType: type }),
        },
        include: { category: true },
      })
    : [];

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rows = [...links.map((l) => l.material), ...extraMaterials]
    .map((m) => {
      const rob = stockByMat.get(m.id) ?? 0;
      const received = inByMat.get(m.id) ?? 0;
      const consumed = outByMat.get(m.id) ?? 0;
      return {
        group: m.category?.name ?? m.equipment ?? (m.materialType === "SPARE" ? "Spare" : "Store"),
        name: m.nameVn,
        impa: m.impa ?? m.partNumber ?? "",
        uom: m.uom,
        lastRob: round2(rob - received + consumed),
        received: round2(received),
        consumed: round2(consumed),
        rob: round2(rob),
      };
    })
    .sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
    );

  // Điền vào template gốc MLS-11-06 (giữ nguyên định dạng form công ty).
  // Template là tài liệu riêng của công ty nên KHÔNG nằm trong repo — xem templates/README.md.
  const templatePath = path.join(process.cwd(), "templates", "MLS-11-06.xlsx");
  let templateBuffer: Buffer;
  try {
    templateBuffer = await readFile(templatePath);
  } catch {
    return NextResponse.json(
      {
        error:
          "Chưa có file biểu mẫu templates/MLS-11-06.xlsx. Hãy chép biểu mẫu Excel của công ty vào thư mục templates/ (xem templates/README.md).",
      },
      { status: 500 }
    );
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as unknown as ArrayBuffer);
  const ws = workbook.worksheets[0];

  const typeLabels: Record<string, string> = {
    ALL: "Tất cả (Store & Spare)",
    STORE: "Vật tư (Store)",
    SPARE: "Phụ tùng (Spare)",
  };
  // A7:B7 là nhãn "Vsl./Tàu:" (merge) — tên tàu điền vào vùng C7:D7.
  ws.getCell("C7").value = vessel.name;
  // exceljs quy đổi Date theo UTC — dùng UTC midnight để Excel hiện đúng ngày.
  ws.getCell("H7").value = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  ws.getCell("C8").value = typeLabels[type];
  ws.getCell("H8").value = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

  // Template có sẵn 25 dòng dữ liệu (13..37), chữ ký ở 38-39 — thiếu thì chèn thêm dòng.
  const FIRST_DATA_ROW = 13;
  const TEMPLATE_SLOTS = 25;
  if (rows.length > TEMPLATE_SLOTS) {
    ws.insertRows(
      FIRST_DATA_ROW + TEMPLATE_SLOTS - 1,
      Array.from({ length: rows.length - TEMPLATE_SLOTS }, () => []),
      "i"
    );
  }
  rows.forEach((row, index) => {
    const r = ws.getRow(FIRST_DATA_ROW + index);
    r.getCell(1).value = index + 1; // S.No
    r.getCell(2).value = row.group; // Group
    r.getCell(3).value = row.name; // Description
    r.getCell(5).value = row.impa; // IMPA Code
    r.getCell(6).value = row.uom; // Unit
    r.getCell(7).value = row.lastRob; // Last R.O.B
    r.getCell(8).value = row.received; // Receive
    r.getCell(9).value = row.consumed; // Cons.
    r.getCell(10).value = row.rob; // R.O.B
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = now.toISOString().slice(0, 10);
  // Mã tàu là chữ tự do (có thể chứa ký tự Việt) — phải làm sạch cho header ASCII,
  // kèm filename* RFC 5987 giữ tên đầy đủ (như route tải tài liệu).
  const safeCode =
    vessel.code.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") ||
    String(vessel.id);
  const asciiName = `MLS-11-06_${safeCode}_${dateStr}.xlsx`;
  const utf8Name = encodeURIComponent(
    `MLS-11-06_${vessel.code}_${dateStr}.xlsx`
  );
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
