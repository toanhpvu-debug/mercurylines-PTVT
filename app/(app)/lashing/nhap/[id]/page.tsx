import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { NHAP_CHANG_BUOC, docDongChangBuoc } from "@/lib/changBuocNhap";
import { dangDocAi } from "@/lib/phieuGiao";
import { layT } from "@/lib/i18n/server";
import BangChangBuoc from "@/components/BangChangBuoc";
import DocLaiChangBuocButton from "@/components/DocLaiChangBuocButton";
import TuLamMoi from "@/components/TuLamMoi";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
const chuanTen = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Soát một file MLS-11-13 đã tải: sửa dòng đọc sai, xem ghép với danh mục, áp dụng. */
export default async function NhapChangBuocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScopedUser();
  const { t, ngayGio } = await layT();
  const id = Number((await params).id);
  const tep = Number.isInteger(id) && id > 0 ? await prisma.changBuocTep.findUnique({ where: { id }, include: { vessel: { select: { id: true, code: true, name: true } } } }) : null;
  if (!tep || !NHAP_CHANG_BUOC.includes(user.role) || !trongPhamVi(vesselScopeDayDu(user), tep.vesselId)) notFound();
  const dangDoc = tep.trangThai === "CHO_XU_LY" && dangDocAi(tep.aiDangDocTu);
  const coSua = tep.trangThai === "CHO_XU_LY" && !dangDoc;
  const gears = await prisma.lashingGear.findMany({
    where: { vesselId: tep.vesselId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, partNo: true, minQty: true, standardQty: true },
  });
  const dong = docDongChangBuoc(tep.dong);
  const tienDo = tep.aiTienDo && tep.aiTienDo.includes("/") ? tep.aiTienDo : t("changBuoc.tienDoChuaRo");
  const kq = (tep.ketQua ?? null) as { them?: number; capNhat?: number; giong?: number; trung?: number; boQua?: number } | null;
  // Tên tàu ghi trên biểu mẫu khác tàu đang nhập → nhắc (không chặn: tên viết tắt / có tiền tố M/V).
  const tauLech = tep.tenTauDoc && !chuanTen(tep.tenTauDoc).includes(chuanTen(tep.vessel.name)) && !chuanTen(tep.vessel.name).includes(chuanTen(tep.tenTauDoc));

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/lashing?vessel=${tep.vesselId}`} className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("changBuoc.quayLai")}
        </Link>
        <PageHeader
          title={tep.fileName}
          subtitle={`${tep.vessel.code} ${tep.vessel.name} · ${t("changBuoc.nguoiTaiLuc", { nguoi: tep.nguoiTai, luc: ngayGio(tep.createdAt) })}`}
          action={
            <>
              <Badge tone={tep.trangThai === "DA_AP_DUNG" ? "success" : dangDoc ? "info" : "warning"} dot>
                {dangDoc ? t("changBuoc.aiDangDocNgan") : tep.trangThai === "DA_AP_DUNG" ? t("changBuoc.daApDungNhan") : t("changBuoc.choXuLy")}
              </Badge>
              <a href={`/api/chang-buoc/${tep.id}/file`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                {tep.loaiTep === "PDF" ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
                {t("changBuoc.tepGoc")}
              </a>
            </>
          }
        />
      </div>
      {dangDoc && (
        <>
          <TuLamMoi giay={5} />
          <Notice tone="info">{t("changBuoc.aiDangDoc", { tienDo })}</Notice>
        </>
      )}
      {tep.loiAi && !dangDoc && (
        <Notice tone="warning">
          {t("changBuoc.aiBao")} {tep.loiAi}
        </Notice>
      )}
      {tep.ghiChuDoc && <p className="text-xs text-[var(--text-muted)]">{tep.ghiChuDoc}</p>}
      {tep.tenTauDoc && (
        <Notice tone={tauLech ? "warning" : "info"}>
          {tauLech ? t("changBuoc.tauLech", { tauFile: tep.tenTauDoc, tau: tep.vessel.name }) : t("changBuoc.tauFile", { tauFile: tep.tenTauDoc })}
        </Notice>
      )}
      {tep.loaiTep === "PDF" && coSua && <DocLaiChangBuocButton id={tep.id} />}
      {tep.trangThai === "DA_AP_DUNG" && (
        <Notice tone="success">
          {t("changBuoc.daApDungLuc", { nguoi: tep.apDungBoi ?? "—", luc: tep.apDungLuc ? ngayGio(tep.apDungLuc) : "—" })}{" "}
          {kq && t("changBuoc.ketQua", { them: kq.them ?? 0, capNhat: kq.capNhat ?? 0, giong: kq.giong ?? 0 })}{" "}
          {tep.reportId && (
            <Link href={`/lashing/${tep.reportId}`} className="inline-flex items-center gap-1 font-medium text-[var(--text-brand)] hover:underline">
              <Printer className="size-4" />
              {t("changBuoc.xemBaoCao")}
            </Link>
          )}
        </Notice>
      )}
      {!dangDoc && (
        <div className={`grid grid-cols-1 gap-5 ${tep.loaiTep === "PDF" ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          <Card className="min-w-0">
            {coSua && <p className="mb-3 text-sm text-[var(--text-secondary)]">{t("changBuoc.goiYSoat")}</p>}
            {dong.length === 0 && coSua && <Notice tone="warning">{t("changBuoc.chuaCoDong")}</Notice>}
            <BangChangBuoc id={tep.id} dong={dong} dau={{ cang: tep.cangDoc ?? "", ngay: iso(tep.ngayDoc) }} gears={gears} coSua={coSua} />
          </Card>
          {tep.loaiTep === "PDF" && (
            <Card padded={false} className="hidden min-h-[70vh] overflow-hidden 2xl:block">
              <iframe src={`/api/chang-buoc/${tep.id}/file`} title={tep.fileName} className="h-full min-h-[70vh] w-full" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
