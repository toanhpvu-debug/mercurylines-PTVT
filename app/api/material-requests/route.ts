import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireActiveRole(["ADMIN", "MASTER", "CREW"]);
    if (!user) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }
    const body = await request.json();
    const kind = body.kind === "SPARE" ? "SPARE" : "STORE";
    const vesselId = Number(body.vesselId);
    const requestedBy = String(body.requestedBy || "").trim();
    const department = String(body.department || "GENERAL").trim();
    const priority = String(body.priority || "NORMAL").trim();
    const purpose = body.purpose ? String(body.purpose).trim() : null;
    const equipment = body.equipment ? String(body.equipment).trim() : null;
    const maker = body.maker ? String(body.maker).trim() : null;
    const serialNo = body.serialNo ? String(body.serialNo).trim() : null;
    let requiredDate;
    if (body.requiredDate) {
      const d = new Date(body.requiredDate);
      if (!isNaN(d.getTime())) {
        requiredDate = d;
      }
    }
    if (!vesselId || !requestedBy) {
      return NextResponse.json(
        { error: "Tàu và người yêu cầu là bắt buộc." },
        { status: 400 }
      );
    }
    const scope = vesselScope(user);
    if (!scope.all && vesselId !== scope.vesselId) {
      return NextResponse.json(
        {
          error: scope.unassigned
            ? "Bạn chưa được gán tàu nên không thể tạo yêu cầu."
            : "Bạn chỉ có thể tạo yêu cầu cho tàu mình phụ trách.",
        },
        { status: 403 }
      );
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Yêu cầu phải có ít nhất một dòng." },
        { status: 400 }
      );
    }
    type ParsedItem = {
      materialId: number | null;
      itemName: string | null;
      itemCode: string | null;
      itemUom: string | null;
      quantity: number;
      note: string | null;
    };
    const items: ParsedItem[] = body.items
      .map((item: Record<string, unknown>): ParsedItem | null => {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        const note = item.note ? String(item.note).trim() : null;
        const isNew = item.isNew === true || !item.materialId;
        if (isNew) {
          const itemName = String(item.itemName || "").trim();
          if (!itemName) return null; // vật tư mới bắt buộc có tên
          return {
            materialId: null,
            itemName,
            itemCode: item.itemCode ? String(item.itemCode).trim() : null,
            itemUom: item.itemUom ? String(item.itemUom).trim() || "PCS" : "PCS",
            quantity,
            note,
          };
        }
        const materialId = Number(item.materialId);
        if (!Number.isFinite(materialId) || materialId <= 0) return null;
        return {
          materialId,
          itemName: null,
          itemCode: null,
          itemUom: null,
          quantity,
          note,
        };
      })
      .filter((x: ParsedItem | null): x is ParsedItem => x !== null);
    if (!items.length) {
      return NextResponse.json(
        { error: "Danh sách vật tư không hợp lệ." },
        { status: 400 }
      );
    }
    // Chụp ROB (còn tồn trên tàu) cho từng vật tư có sẵn tại thời điểm yêu cầu
    const materialIds = [
      ...new Set(
        items
          .map((i) => i.materialId)
          .filter((x): x is number => x !== null)
      ),
    ];
    // Xác nhận mọi vật tư "có sẵn" thực sự tồn tại (tránh lỗi khóa ngoại 500).
    if (materialIds.length) {
      const existing = await prisma.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true },
      });
      if (existing.length !== materialIds.length) {
        return NextResponse.json(
          { error: "Có vật tư không tồn tại trong danh mục." },
          { status: 400 }
        );
      }
    }
    const robGroups = materialIds.length
      ? await prisma.inventory.groupBy({
          by: ["materialId"],
          where: { vesselId, materialId: { in: materialIds } },
          _sum: { quantity: true },
        })
      : [];
    const robByMaterial = new Map(
      robGroups.map((g) => [g.materialId, Number(g._sum.quantity ?? 0)])
    );
    const prefix = kind === "SPARE" ? "SR" : "MR";
    const requestNo = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const created = await prisma.materialRequest.create({
      data: {
        requestNo,
        kind,
        vesselId,
        requestedBy,
        department,
        priority,
        status: "DRAFT",
        requiredDate,
        purpose,
        equipment,
        maker,
        serialNo,
        items: {
          create: items.map((item) => ({
            materialId: item.materialId,
            itemName: item.itemName,
            itemCode: item.itemCode,
            itemUom: item.itemUom,
            quantity: item.quantity,
            robSnapshot:
              item.materialId !== null
                ? (robByMaterial.get(item.materialId) ?? 0)
                : 0,
            approvedQuantity: 0,
            note: item.note,
          })),
        },
      },
      include: {
        vessel: true,
        items: { include: { material: true } },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể tạo yêu cầu." },
      { status: 500 }
    );
  }
}
