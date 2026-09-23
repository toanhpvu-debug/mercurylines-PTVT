import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canManageVesselCatalog, requireScopedUser, vesselScopeDayDu } from "@/lib/auth";
import { trongPhamVi } from "@/lib/roles";
import { NGUOI_TAI_PHIEU_GIAO, chuoiNgay, dangDocAi } from "@/lib/phieuGiao";
import TuLamMoi from "@/components/TuLamMoi";
import { aiDaCauHinh } from "@/lib/cauHinhAi";
import PhieuGiaoDuyet, { type DongHienThi } from "@/components/PhieuGiaoDuyet";
import GoPhieuGiaoButton from "@/components/GoPhieuGiaoButton";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import { Badge, Card, Notice, PageHeader, Spinner } from "@/components/ui";

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
  searchParams: Promise<{ doc?: string; kiem?: string; nguon?: string; ai?: string }>;
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
    const k = Number(sp.kiem) || 0;
    if (n > 0 && k > 0) thongBaoDoc = { tone: "warning", text: t("phieuGiao.daDocNKiem", { n, k }) };
    else if (n > 0) thongBaoDoc = { tone: "success", text: t("phieuGiao.daDocN", { n }) };
    else if (phieu.loiAi || sp.ai === "loi") thongBaoDoc = null; // báo bằng lỗi nguyên văn bên dưới
    else if (sp.nguon === "TAY" && !phieu.chuDoc) thongBaoDoc = { tone: "warning", text: t("phieuGiao.ocrChiWindows") };
    else thongBaoDoc = { tone: "warning", text: t("phieuGiao.docKhongRaDong") };
  }
  // Lỗi NGUYÊN VĂN của nhà cung cấp AI ở lần đọc gần nhất — hiện ở mọi lần mở
  // trang khi phiếu còn chờ duyệt, để người dùng biết phải sửa gì (khóa, mô
  // hình, hạn mức) thay vì câu chung chung.
  // Bộ đọc AI chạy nền: đang đọc thì trang hiện tiến độ và tự làm mới; dấu còn
  // mà quá 30 phút là lần đọc bị gián đoạn (máy chủ khởi động lại giữa chừng).
  const dangDoc = phieu.status === "CHO_DUYET" && dangDocAi(phieu.aiDangDocTu);
  const biNgat = phieu.status === "CHO_DUYET" && Boolean(phieu.aiDangDocTu) && !dangDoc;
  if (!thongBaoDoc && !dangDoc && phieu.loiAi && phieu.status === "CHO_DUYET") {
    thongBaoDoc = { tone: "warning", text: `${t("phieuGiao.aiLoi", { loi: phieu.loiAi })} ${t("phieuGiao.aiLoiGoiY")}` };
  }
  if (!thongBaoDoc && biNgat) thongBaoDoc = { tone: "warning", text: t("phieuGiao.aiBiNgat") };
  const tienDo = phieu.aiTienDo && phieu.aiTienDo.includes("/") ? phieu.aiTienDo : t("phieuGiao.tienDoChuaRo");
  const aiBat = await aiDaCauHinh();
  const goDuoc = user.role === "ADMIN" && phieu.status === "DA_DUYET" && !(await laBanTau());

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
    tenEn: d.tenEn,
    trang: d.trang,
    canhBao: d.canhBao,
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
      {dangDoc && (
        <Notice tone="info">
          <span className="inline-flex items-start gap-2">
            <Spinner className="mt-0.5 size-4 shrink-0" />
            <span>{t("phieuGiao.aiDangDocNen", { tienDo })}</span>
          </span>
          <TuLamMoi giay={5} />
        </Notice>
      )}
      <Card>
        <PhieuGiaoDuyet
          // Đổi khóa khi AI đọc xong để bảng lấy lại các dòng mới từ máy chủ.
          key={dangDoc ? "dang-doc" : "san-sang"}
          dangDocAi={dangDoc}
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
      {goDuoc && (
        <div className="flex justify-end">
          <GoPhieuGiaoButton phieuId={phieu.id} tenPhieu={phieu.soPhieu || phieu.fileName} trangThai={phieu.status} size="md" veDanhSach />
        </div>
      )}
    </div>
  );
}
