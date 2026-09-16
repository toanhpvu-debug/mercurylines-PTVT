import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  canEditRequest,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import RequestForm, { type YeuCauDangSua } from "@/components/RequestForm";
import { Notice, PageHeader } from "@/components/ui";

/**
 * Sửa một yêu cầu vật tư / phụ tùng đã lập.
 *
 * Dùng LẠI RequestForm của trang lập mới ở chế độ `dangSua` thay vì dựng form
 * thứ hai — xem ghi chú ở kiểu YeuCauDangSua về lý do.
 *
 * Trang này chỉ quyết định "có được vào hay không" và dọn dữ liệu cho form; luật
 * thật nằm ở canEditRequest (lib/roles.ts) và được kiểm lại lần nữa ở PATCH
 * /api/material-requests/[id]. Kiểm hai lần là cố ý: giấu nút đi không phải là
 * chặn, người ta gọi thẳng API được.
 */
export default async function SuaYeuCauPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const request = await prisma.materialRequest.findUnique({
    where: { id },
    select: {
      id: true,
      requestNo: true,
      kind: true,
      vesselId: true,
      status: true,
      requestedById: true,
      department: true,
      priority: true,
      requiredDate: true,
      purpose: true,
      equipment: true,
      maker: true,
      serialNo: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          materialId: true,
          itemName: true,
          itemCode: true,
          itemUom: true,
          quantity: true,
          note: true,
        },
      },
    },
  });
  if (!request) notFound();

  const duocSua = canEditRequest(user, request);

  const [vessels, materials] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Cùng bộ lọc với trang lập mới: chỉ mặt hàng thuộc tàu người này phụ trách.
    prisma.material.findMany({
      where: {
        isActive: true,
        ...(scope.all ? {} : { vesselMaterials: { some: vesselWhere(scope) } }),
      },
      orderBy: [{ materialType: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        nameVn: true,
        uom: true,
        materialType: true,
        partNumber: true,
        equipment: true,
      },
    }),
  ]);

  const dangSua: YeuCauDangSua = {
    id: request.id,
    requestNo: request.requestNo,
    kind: request.kind === "SPARE" ? "SPARE" : "STORE",
    vesselId: request.vesselId,
    department: request.department,
    priority: request.priority,
    // <input type="date"> chỉ nhận yyyy-mm-dd. toISOString() cắt 10 ký tự đầu là
    // ngày theo GIỜ UTC — với múi giờ +07 thì một ngày lưu lúc 00:30 sẽ lùi về
    // hôm trước. Lấy theo giờ địa phương của máy chủ để ô ngày hiện đúng cái
    // người dùng đã chọn.
    requiredDate: request.requiredDate
      ? [
          request.requiredDate.getFullYear(),
          String(request.requiredDate.getMonth() + 1).padStart(2, "0"),
          String(request.requiredDate.getDate()).padStart(2, "0"),
        ].join("-")
      : "",
    purpose: request.purpose ?? "",
    equipment: request.equipment ?? "",
    maker: request.maker ?? "",
    serialNo: request.serialNo ?? "",
    items: request.items.map((item) => ({
      mode: item.materialId ? ("existing" as const) : ("new" as const),
      materialId: item.materialId ? String(item.materialId) : "",
      itemName: item.itemName ?? "",
      itemCode: item.itemCode ?? "",
      itemUom: item.itemUom ?? "",
      quantity: String(item.quantity),
      note: item.note ?? "",
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/requests/${request.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" />
          {t("requests.quayLaiChiTiet")}
        </Link>
        <PageHeader
          title={
            <span className="font-display tracking-wide">
              {request.requestNo}
            </span>
          }
          subtitle={
            duocSua ? t("requests.suaMoTa") : t("requests.khongSuaDuocTieuDe")
          }
        />
      </div>
      {duocSua ? (
        <RequestForm
          vessels={vessels}
          materials={materials}
          nguoiLap={{ name: user.name, role: user.role }}
          dangSua={dangSua}
        />
      ) : (
        <Notice tone="warning">
          {t("actionsModule.yeuCau_khongSuaDuocOTrangThaiNay")}
        </Notice>
      )}
    </div>
  );
}
