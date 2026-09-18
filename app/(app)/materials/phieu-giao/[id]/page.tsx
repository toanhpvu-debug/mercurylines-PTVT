import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canManageVesselCatalog, requireScopedUser, vesselScopeDayDu } from "@/lib/auth";
import { trongPhamVi } from "@/lib/roles";
import { NGUOI_TAI_PHIEU_GIAO, chuoiNgay } from "@/lib/phieuGiao";
import { aiDaCauHinh } from "@/lib/cauHinhAi";
import PhieuGiaoDuyet, { type DongHienThi } from "@/components/PhieuGiaoDuyet";
import { layT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function ngayGio(d: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function PhieuGiaoChiTietPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; nguon?: string; ai?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  const { id } = await params;
  const sp = await searchParams;
  const phieuId = Number(id);
  if (!Number.isInteger(phieuId) || phieuId <= 0) notFound();
  const phieu = await prisma.phieuGiaoNhan.findUnique({
    where: { id: phieuId },
    include: {
      vessel: { select: { id: true, code: true, name: true } },
      uploadedBy: { select: { id: true, name: true } },
      dong: {
        orderBy: { thuTu: "asc" },
        include: { material: { select: { code: true, nameVn: true } } },
      },
    },
  });
  if (!phieu) notFound();
  if (!trongPhamVi(vesselScopeDayDu(user), phieu.vesselId)) redirect("/materials/phieu-giao");

  const warehouses = await prisma.warehouse.findMany({
    where: { vesselId: phieu.vesselId },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const coQuyenDuyet = canManageVesselCatalog(user, phieu.vesselId);
  const coQuyenSua =
    coQuyenDuyet || (phieu.uploadedById === user.id && NGUOI_TAI_PHIEU_GIAO.includes(user.role));

  // Thông báo ngay sau khi tải lên: đọc được bao nhiêu dòng, hay vì sao không đọc được.
  let thongBaoDoc: { tone: "info" | "warning" | "success"; text: string } | null = null;
  if (sp.doc !== undefined) {
    const n = Number(sp.doc) || 0;
    if (n > 0) thongBaoDoc = { tone: "success", text: t("phieuGiao.daDocN", { n }) };
    else if (sp.ai === "loi") thongBaoDoc = { tone: "warning", text: t("phieuGiao.aiLoiLucTai") };
    else if (sp.nguon === "TAY" && !phieu.chuDoc) thongBaoDoc = { tone: "warning", text: t("phieuGiao.ocrChiWindows") };
    else thongBaoDoc = { tone: "warning", text: t("phieuGiao.docKhongRaDong") };
  }
  const aiBat = await aiDaCauHinh();

  const dong: DongHienThi[] = phieu.dong.map((d) => ({
    id: d.id,
    chon: d.chon,
    ten: d.ten,
    partNo: d.partNo ?? "",
    impa: d.impa ?? "",
    soLuong: d.soLuong,
    donVi: d.donVi,
    loai: d.loai === "STORE" ? "STORE" : "SPARE",
    thietBi: d.thietBi ?? "",
    materialId: d.materialId,
    chuGoc: d.chuGoc,
    materialLabel: d.material ? `${d.material.code} — ${d.material.nameVn}` : null,
  }));
  const TONE: Record<string, "warning" | "success" | "danger"> = { CHO_DUYET: "warning", DA_DUYET: "success", TU_CHOI: "danger" };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/materials/phieu-giao"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("phieuGiao.quayLai")}
        </Link>
        <PageHeader
          title={`${t("phieuGiao.duyetTieuDe")} · ${phieu.soPhieu || phieu.fileName}`}
          subtitle={
            <>
              {phieu.vessel.code} — {phieu.vessel.name} · {t("phieuGiao.cotNguoiTai")}: {phieu.uploadedBy.name} ·{" "}
              {ngayGio(phieu.createdAt)}{" "}
              <Badge tone={TONE[phieu.status] ?? "neutral"} dot className="ml-1">
                {tTuDo(`phieuGiao.trangThai_${phieu.status}`)}
              </Badge>
            </>
          }
        />
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("phieuGiao.duyetMoTa")}</p>
      </div>
      <Card>
        <PhieuGiaoDuyet
          phieu={{
            id: phieu.id,
            fileName: phieu.fileName,
            nhaCungCap: phieu.nhaCungCap ?? "",
            soPhieu: phieu.soPhieu ?? "",
            ngayGiao: chuoiNgay(phieu.ngayGiao),
            ghiChu: phieu.ghiChu ?? "",
            status: phieu.status,
            nguonChu: phieu.nguonChu,
            chuDoc: phieu.chuDoc,
            approvedBy: phieu.approvedBy,
            approvedAtChuoi: phieu.approvedAt ? ngayGio(phieu.approvedAt) : null,
            lyDoTuChoi: phieu.lyDoTuChoi,
          }}
          dongBanDau={dong}
          warehouses={warehouses.map((w) => ({ id: w.id, label: `${w.code} — ${w.name}` }))}
          coQuyenDuyet={coQuyenDuyet}
          coQuyenSua={coQuyenSua}
          thongBaoDoc={thongBaoDoc}
          aiBat={aiBat}
        />
      </Card>
    </div>
  );
}
