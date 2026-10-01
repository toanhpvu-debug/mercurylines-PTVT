import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU } from "@/lib/roles";
import {
  capSoYeuCauTx,
  chupROB,
  locSonCoThat,
  docDongYeuCau,
  duVatTuTrongDanhMuc,
  maVatTuCoSan,
} from "@/lib/yeuCauVatTu";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Lấy trước khối try để câu báo lỗi ở khối catch cũng dùng được.
  const { t } = await layT();
  try {
    const user = await requireActiveRole([...LAP_YEU_CAU]);
    if (!user) {
      return NextResponse.json(
        { error: t("chung.khongCoQuyen") },
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
    let requiredDate: Date | undefined;
    if (body.requiredDate) {
      const d = new Date(body.requiredDate);
      if (!isNaN(d.getTime())) {
        requiredDate = d;
      }
    }
    if (!vesselId) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_tauBatBuoc") },
        { status: 400 }
      );
    }
    const scope = vesselScopeDayDu(user);
    if (!trongPhamVi(scope, vesselId)) {
      return NextResponse.json(
        {
          error: scope.unassigned
            ? t("actionsModule.yeuCau_chuaGanTau")
            : t("actionsModule.yeuCau_chiTauPhuTrach"),
        },
        { status: 403 }
      );
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_itNhatMotDong") },
        { status: 400 }
      );
    }
    // Đọc dòng bằng HÀM DÙNG CHUNG với đường sửa (PATCH .../[id]) — xem
    // lib/yeuCauVatTu.ts về lý do không được chép đôi đoạn này.
    const items = await locSonCoThat(docDongYeuCau(body.items));
    if (!items.length) {
      return NextResponse.json(
        { error: t("actionsModule.yeuCau_danhSachKhongHopLe") },
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
    const robByMaterial = await chupROB(vesselId, materialIds);
    // Số yêu cầu theo quy ước chứng từ: <MR|SR>-<mã tàu>-<năm 2 số>-<số thứ tự>.
    // VD MR-MLS001-26-0007. Số cũ dạng timestamp không tra cứu hay đối chiếu được.
    const prefix = kind === "SPARE" ? "SR" : "MR";
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { code: true },
    });
    if (!vessel) {
      return NextResponse.json(
        { error: t("actionsModule.tauKhongTonTai") },
        { status: 400 }
      );
    }
    // Cấp số trong CÙNG giao dịch ghi yêu cầu, sau khóa tư vấn theo dãy số của
    // tàu — xem capSoYeuCauTx (lib/yeuCauVatTu.ts).
    const created = await prisma.$transaction(async (tx) => {
      const requestNo = await capSoYeuCauTx(tx, prefix, vessel.code);
      const row = await tx.materialRequest.create({
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
                : (item.rob ?? 0),
            approvedQuantity: 0,
            note: item.note,
            paintProductId: item.paintProductId,
          })),
        },
      },
      include: {
        vessel: true,
        items: { include: { material: true } },
      },
      });
      // Mốc đầu tiên trong nhật ký phê duyệt — cùng giao dịch để không bao giờ
      // có yêu cầu thiếu mốc DRAFT mở đầu.
      await tx.materialRequestEvent.create({
        data: {
          requestId: row.id,
          fromStatus: null,
          toStatus: "DRAFT",
          actorName: user.name,
          actorRole: user.role,
          note: `Lập yêu cầu ${items.length} dòng`,
        },
      });
      return row;
    });
    // Lập từ file MLS-11-05 (yêu cầu nhanh): ghi lại yêu cầu vào file gốc —
    // chỉ file của chính người lập, chưa dùng cho yêu cầu nào.
    const tuTep = Number(body.tuTep);
    if (Number.isInteger(tuTep) && tuTep > 0) {
      await prisma.yeuCauTep
        .updateMany({ where: { id: tuTep, nguoiTaiId: user.id, requestId: null }, data: { requestId: created.id } })
        .catch(() => undefined);
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: t("actionsModule.yeuCau_khongTaoDuoc") },
      { status: 500 }
    );
  }
}
