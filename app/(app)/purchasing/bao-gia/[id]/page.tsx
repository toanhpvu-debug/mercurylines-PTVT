import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { LAP_DON_MUA, QUAN_LY_NCC } from "@/lib/donMuaQuyTrinh";
import { docDongBaoGia } from "@/lib/baoGia";
import { dangDocAi } from "@/lib/phieuGiao";
import { layT } from "@/lib/i18n/server";
import BangBaoGia from "@/components/BangBaoGia";
import DocLaiBaoGiaButton from "@/components/DocLaiBaoGiaButton";
import TuLamMoi from "@/components/TuLamMoi";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");

/** Xử lý một báo giá: sửa, xem ghép dòng với PO, áp vào PO nháp / tạo PO mới. */
export default async function BaoGiaChiTietPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScopedUser();
  const { t, ngayGio } = await layT();
  const id = Number((await params).id);
  const bg = Number.isInteger(id) && id > 0 ? await prisma.baoGiaNcc.findUnique({ where: { id }, include: { vessel: { select: { code: true, name: true } } } }) : null;
  if (!bg || !trongPhamVi(vesselScopeDayDu(user), bg.vesselId)) notFound();
  const dangDoc = bg.trangThai === "CHO_XU_LY" && dangDocAi(bg.aiDangDocTu);
  const coSua = bg.trangThai === "CHO_XU_LY" && !dangDoc && LAP_DON_MUA.includes(user.role);
  const [suppliers, poNhap] = await Promise.all([
    prisma.supplier.findMany({ where: { OR: [{ isActive: true }, ...(bg.supplierId ? [{ id: bg.supplierId }] : [])] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchaseOrder.findMany({
      where: { vesselId: bg.vesselId, OR: [{ status: "DRAFT" }, ...(bg.poId ? [{ id: bg.poId }] : [])] },
      orderBy: { createdAt: "desc" },
      select: { id: true, poNo: true, items: { select: { id: true, description: true, partNo: true } } },
    }),
  ]);
  const poItems = Object.fromEntries(poNhap.map((p) => [p.id, p.items]));
  const dong = docDongBaoGia(bg.dong);
  const tienDo = bg.aiTienDo && bg.aiTienDo.includes("/") ? bg.aiTienDo : t("purchasing.tienDoChuaRo");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/purchasing/bao-gia" className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("purchasing.baoGiaTieuDe")}
        </Link>
        <PageHeader
          title={bg.soBaoGia ? t("purchasing.baoGiaSo", { so: bg.soBaoGia }) : bg.fileName}
          subtitle={`${bg.vessel.code} ${bg.vessel.name} · ${bg.fileName} · ${bg.nguoiTai}, ${ngayGio(bg.createdAt)}`}
          action={
            <>
              <Badge tone={bg.trangThai === "DA_AP_DUNG" ? "success" : dangDoc ? "info" : "warning"} dot>
                {dangDoc ? t("purchasing.aiDangDocNgan") : bg.trangThai === "DA_AP_DUNG" ? t("purchasing.baoGiaDaDung") : t("purchasing.baoGiaChoXuLy")}
              </Badge>
              <a href={`/api/bao-gia/${bg.id}/file`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                {bg.loaiTep === "PDF" ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
                {t("purchasing.tepGocBaoGia")}
              </a>
            </>
          }
        />
      </div>
      {dangDoc && (
        <>
          <TuLamMoi giay={5} />
          <Notice tone="info">{t("purchasing.aiDangDocBaoGia", { tienDo })}</Notice>
        </>
      )}
      {bg.loiAi && !dangDoc && (
        <Notice tone="warning">
          {t("purchasing.aiBao")} {bg.loiAi}
        </Notice>
      )}
      {bg.ghiChuDoc && <p className="text-xs text-[var(--text-muted)]">{bg.ghiChuDoc}</p>}
      {bg.loaiTep === "PDF" && coSua && <DocLaiBaoGiaButton id={bg.id} />}
      {bg.trangThai === "DA_AP_DUNG" && (
        <Notice tone="success">
          {t("purchasing.baoGiaDaApDungLuc", { nguoi: bg.apDungBoi ?? "—", luc: bg.apDungLuc ? ngayGio(bg.apDungLuc) : "—" })}{" "}
          {bg.poId && (
            <Link href={`/purchasing/${bg.poId}`} className="font-medium text-[var(--text-brand)] hover:underline">
              {poNhap.find((p) => p.id === bg.poId)?.poNo ?? t("purchasing.moPo")}
            </Link>
          )}
        </Notice>
      )}
      {!dangDoc && (
        <div className={`grid grid-cols-1 gap-5 ${bg.loaiTep === "PDF" ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          <Card className="min-w-0">
            {coSua && <p className="mb-3 text-sm text-[var(--text-secondary)]">{t("purchasing.goiYXuLyBaoGia")}</p>}
            <BangBaoGia
              id={bg.id}
              dau={{
                supplierId: bg.supplierId,
                poId: bg.poId,
                soBaoGia: bg.soBaoGia ?? "",
                ngayBaoGia: iso(bg.ngayBaoGia),
                tienTe: bg.tienTe ?? "",
                chietKhau: bg.chietKhau ? String(bg.chietKhau) : "",
                phiVanChuyen: bg.phiVanChuyen ? String(bg.phiVanChuyen) : "",
                phiGiaoHang: bg.phiGiaoHang ? String(bg.phiGiaoHang) : "",
              }}
              dong={dong}
              nhaCungCapDoc={bg.nhaCungCapDoc}
              suppliers={suppliers}
              poNhap={poNhap.map((p) => ({ id: p.id, poNo: p.poNo }))}
              poItems={poItems}
              coSua={coSua}
              laAdmin={QUAN_LY_NCC.includes(user.role)}
            />
          </Card>
          {bg.loaiTep === "PDF" && (
            <Card padded={false} className="hidden min-h-[70vh] overflow-hidden 2xl:block">
              <iframe src={`/api/bao-gia/${bg.id}/file`} title={bg.fileName} className="h-full min-h-[70vh] w-full" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
