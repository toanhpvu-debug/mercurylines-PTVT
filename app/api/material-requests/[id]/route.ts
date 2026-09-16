import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canEditRequest, requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU } from "@/lib/roles";
import {
  chupROB,
  docDongYeuCau,
  duVatTuTrongDanhMuc,
  maVatTuCoSan,
} from "@/lib/yeuCauVatTu";

export const dynamic = "force-dynamic";

/**
 * Sửa nội dung một yêu cầu vật tư / phụ tùng đã lập.
 *
 * KHÔNG cho đổi `vesselId` và `kind`: số yêu cầu (MR-MLS001-26-0007) mã hóa cả
 * hai thứ đó, đổi một cái là số chứng từ nói sai về chính nó — mà số ấy đã in ra
 * giấy và đã được nhắc tới trong đơn mua. Cần tàu khác hoặc loại khác thì xóa và
 * lập lại, lúc đó số mới được cấp đúng dãy.
 *
 * Ai sửa được và ở trạng thái nào: xem canEditRequest (lib/roles.ts). Tóm tắt:
 * chỉ trước khi duyệt xong, vì từ APPROVED trở đi đơn mua đã bám vào từng dòng.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { t } = await layT();
  try {
    const user = await requireActiveRole([...LAP_YEU_CAU]);
    if (!user) {
      return NextResponse.json(
        { error: t("chung.khongCoQuyen") },
        { status: 403 }
      );
    }
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: t("chung.duLieuKhongHopLe") },
        { status: 400 }
      );
    }
    const hienCo = await prisma.materialRequest.findUnique({
      where: { id },
      select: {
        id: true,
        requestNo: true,
        vesselId: true,
        status: true,
        requestedById: true,
        items: {
          select: {
            id: true,
            suppliedQuantity: true,
            _count: { select: { poItems: true } },
          },
        },
      },
    });
    if (!hienCo) {
      return NextResponse.json(
        { error: t("actions.yeuCau_daXoaHoacKhongTonTai") },
        { status: 404 }
      );
    }
    if (!canEditRequest(user, hienCo)) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_khongSuaDuocOTrangThaiNay") },
        { status: 403 }
      );
    }
    // Chốt chặn thứ hai, hỏi thẳng dữ liệu thay vì tin vào trạng thái.
    //
    // Luật trạng thái ở trên đã đủ cho mọi đường đi bình thường, nhưng trạng thái
    // là thứ người ta chỉnh được (đổi trạng thái tay, dữ liệu nhập từ bản cũ),
    // còn "đã có dòng đơn mua trỏ vào" thì không. Bên dưới ta XÓA hết dòng cũ rồi
    // ghi lại — nếu có dòng đơn mua đang trỏ vào, Prisma sẽ gỡ liên kết đó thành
    // null và đơn mua mất luôn đường về yêu cầu gốc, âm thầm.
    const vuong = hienCo.items.filter(
      (i) => i._count.poItems > 0 || i.suppliedQuantity > 0
    );
    if (vuong.length) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_daVaoDonMuaKhongSua") },
        { status: 409 }
      );
    }

    const body = await request.json();
    const items = docDongYeuCau(body.items);
    if (!items.length) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_itNhatMotDong") },
        { status: 400 }
      );
    }
    const materialIds = maVatTuCoSan(items);
    if (!(await duVatTuTrongDanhMuc(materialIds))) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_vatTuKhongTonTai") },
        { status: 400 }
      );
    }
    // Chụp lại ROB theo hiện tại: bản yêu cầu vừa sửa là bản sẽ được ký, nên ô
    // "còn tồn" phải nói về lúc sửa chứ không phải lúc lập lần đầu.
    const robTheoVatTu = await chupROB(hienCo.vesselId, materialIds);

    const department = String(body.department || "GENERAL").trim();
    const priority = String(body.priority || "NORMAL").trim();
    const purpose = body.purpose ? String(body.purpose).trim() || null : null;
    const equipment = body.equipment
      ? String(body.equipment).trim() || null
      : null;
    const maker = body.maker ? String(body.maker).trim() || null : null;
    const serialNo = body.serialNo ? String(body.serialNo).trim() || null : null;
    let requiredDate: Date | null = null;
    if (body.requiredDate) {
      const d = new Date(body.requiredDate);
      if (!isNaN(d.getTime())) requiredDate = d;
    }

    const daSua = await prisma.$transaction(async (tx) => {
      // Xóa sạch rồi ghi lại thay vì so từng dòng: dòng yêu cầu chưa duyệt không
      // mang gì đáng giữ (số duyệt và số đã nhận đều bằng 0, và ta vừa xác nhận
      // không có đơn mua nào trỏ vào), nên so khớp từng dòng chỉ thêm đường cho
      // lỗi mà không giữ lại được gì.
      await tx.materialRequestItem.deleteMany({ where: { requestId: id } });
      const row = await tx.materialRequest.update({
        where: { id },
        data: {
          department,
          priority,
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
                  ? (robTheoVatTu.get(item.materialId) ?? 0)
                  : 0,
              approvedQuantity: 0,
              note: item.note,
            })),
          },
        },
        select: { id: true, requestNo: true, status: true },
      });
      // Sửa nội dung cũng là một mốc của chứng từ: không ghi thì người duyệt mở
      // ra thấy một tờ khác tờ mình đã xem hôm qua mà không biết ai đổi, lúc nào.
      // Trạng thái không đổi nên from = to.
      await tx.materialRequestEvent.create({
        data: {
          requestId: id,
          fromStatus: hienCo.status,
          toStatus: hienCo.status,
          actorName: user.name,
          actorRole: user.role,
          note: `Sửa nội dung yêu cầu — còn ${items.length} dòng`,
        },
      });
      return row;
    });

    await ghiNhatKyNguoiDung(user, {
      action: "sua-yeu-cau",
      path: `/requests/${id}`,
      vesselId: hienCo.vesselId,
      detail:
        `Sửa yêu cầu #${id} (${hienCo.requestNo}) — ${hienCo.items.length} dòng ` +
        `thành ${items.length} dòng, bộ phận ${department}, ưu tiên ${priority}`,
    });
    revalidatePath("/requests");
    revalidatePath(`/requests/${id}`);
    return NextResponse.json(daSua);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("actionsModule.yeuCau_khongSuaDuoc") },
      { status: 500 }
    );
  }
}
