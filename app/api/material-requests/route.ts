import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScope } from "@/lib/auth";
import { LAP_YEU_CAU } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireActiveRole([...LAP_YEU_CAU]);
    if (!user) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }
    const body = await request.json();
    const kind = body.kind === "SPARE" ? "SPARE" : "STORE";
    const vesselId = Number(body.vesselId);
    // Tên người yêu cầu lấy từ TÀI KHOẢN ĐANG ĐĂNG NHẬP, không nhận từ body.
    // Trước đây đây là ô nhập tay nên chứng từ ghi được bất kỳ tên nào, không
    // đối chiếu được với ai thật sự bấm nút.
    const requestedBy = user.name;
    const requestedByRole = user.role;
    const requestedById = user.id;
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
    if (!vesselId) {
      return NextResponse.json({ error: "Tàu là bắt buộc." }, { status: 400 });
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
    // Số yêu cầu theo quy ước chứng từ: <MR|SR>-<mã tàu>-<năm 2 số>-<số thứ tự>.
    // VD MR-ML001-26-0007. Số cũ dạng timestamp không tra cứu hay đối chiếu được.
    const prefix = kind === "SPARE" ? "SR" : "MR";
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { code: true },
    });
    if (!vessel) {
      return NextResponse.json({ error: "Tàu không tồn tại." }, { status: 400 });
    }
    const vesselTag = vessel.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const yearTag = String(new Date().getFullYear()).slice(-2);
    const base = `${prefix}-${vesselTag}-${yearTag}-`;
    // Lấy số lớn nhất đã dùng trong năm của tàu này rồi +1 (không dựa vào count
    // để xóa yêu cầu không làm trùng số).
    const latest = await prisma.materialRequest.findFirst({
      where: { requestNo: { startsWith: base } },
      orderBy: { requestNo: "desc" },
      select: { requestNo: true },
    });
    let seq = latest ? Number(latest.requestNo.slice(base.length)) + 1 : 1;
    if (!Number.isFinite(seq) || seq < 1) seq = 1;
    let requestNo = `${base}${String(seq).padStart(4, "0")}`;
    while (
      await prisma.materialRequest.findUnique({ where: { requestNo } })
    ) {
      seq += 1;
      requestNo = `${base}${String(seq).padStart(4, "0")}`;
    }
    const created = await prisma.materialRequest.create({
      data: {
        requestNo,
        kind,
        vesselId,
        requestedBy,
        requestedByRole,
        requestedById,
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
    // Mốc đầu tiên trong nhật ký phê duyệt.
    await prisma.materialRequestEvent.create({
      data: {
        requestId: created.id,
        fromStatus: null,
        toStatus: "DRAFT",
        actorName: user.name,
        actorRole: user.role,
        note: `Lập yêu cầu ${items.length} dòng`,
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
