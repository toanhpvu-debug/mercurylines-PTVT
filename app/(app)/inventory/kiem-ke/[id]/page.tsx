import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canManageVesselCatalog, requireScopedUser, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { VAN_HANH_TAU } from "@/lib/roles";
import { NGUOI_TAI_KIEM_KE, docDongJson } from "@/lib/kiemKe";
import { lapKeHoachKiemKe } from "@/lib/kiemKeServer";
import { dangDocAi } from "@/lib/phieuGiao";
import { layT } from "@/lib/i18n/server";
import BangKiemKe from "@/components/BangKiemKe";
import DocLaiKiemKeButton from "@/components/DocLaiKiemKeButton";
import TuLamMoi from "@/components/TuLamMoi";
import { Badge, Card, Notice, PageHeader, Stat, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Trang đối chiếu một lần kiểm kê theo file trước khi áp dụng vào tồn kho. */
export default async function KiemKeChiTietPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio, ngay } = await layT();
  const id = Number((await params).id);
  const kk = Number.isInteger(id) && id > 0 ? await prisma.kiemKeTep.findUnique({ where: { id }, include: { vessel: { select: { code: true, name: true } } } }) : null;
  if (!kk || !trongPhamVi(vesselScopeDayDu(user), kk.vesselId)) notFound();

  const dong = docDongJson(kk.dong);
  const keHoach = await lapKeHoachKiemKe(kk.vesselId, dong, kk.khoChon);
  const kho = kk.khoChon !== "AUTO" ? await prisma.warehouse.findUnique({ where: { id: Number(kk.khoChon) }, select: { code: true, name: true } }) : null;
  const dangDoc = kk.trangThai === "CHO_DUYET" && dangDocAi(kk.aiDangDocTu);
  const choDuyet = kk.trangThai === "CHO_DUYET" && !dangDoc;
  const coApDung = choDuyet && VAN_HANH_TAU.includes(user.role) && canManageVesselCatalog(user, kk.vesselId);
  const coSua = choDuyet && NGUOI_TAI_KIEM_KE.includes(user.role) && (kk.nguoiTaiId === user.id || canManageVesselCatalog(user, kk.vesselId));
  const kq = (kk.ketQua ?? null) as Record<string, number> | null;
  const tong = keHoach.tong;
  const tienDo = kk.aiTienDo && kk.aiTienDo.includes("/") ? kk.aiTienDo : t("kiemKe.tienDoChuaRo");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/inventory/kiem-ke" className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          {t("kiemKe.quayLai")}
        </Link>
        <PageHeader
          title={kk.fileName}
          subtitle={`${kk.vessel.code} ${kk.vessel.name} · ${tTuDo(`kiemKe.loaiTep_${kk.loaiTep}`)} · ${t("kiemKe.ngayKiemKe")} ${ngay(kk.ngayKiemKe)} · ${t("kiemKe.kho")}: ${
            kho ? `${kho.code} ${kho.name}` : t("kiemKe.khoTuDong")
          }`}
          action={
            <>
              <Badge tone={kk.trangThai === "DA_AP_DUNG" ? "success" : dangDoc ? "info" : "warning"} dot>
                {dangDoc ? t("kiemKe.aiDangDocNgan") : tTuDo(`kiemKe.trangThai_${kk.trangThai}`)}
              </Badge>
              <a href={`/api/kiem-ke/${kk.id}/file`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                {kk.loaiTep === "PDF" ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
                {kk.loaiTep === "PDF" ? t("kiemKe.xemTepGoc") : t("kiemKe.taiTepGoc")}
              </a>
            </>
          }
        />
        <p className="-mt-3 text-xs text-[var(--text-muted)]">{t("kiemKe.nguoiTaiLuc", { nguoi: kk.nguoiTai, luc: ngayGio(kk.createdAt) })}</p>
      </div>

      {dangDoc && (
        <>
          <TuLamMoi giay={5} />
          <Notice tone="info">{t("kiemKe.aiDangDoc", { tienDo })}</Notice>
        </>
      )}
      {kk.loiAi && !dangDoc && (
        <Notice tone="warning">
          {t("kiemKe.aiLoi")} {kk.loiAi}
        </Notice>
      )}
      {kk.ghiChuDoc && (
        <p className="text-xs text-[var(--text-muted)]">
          {t("kiemKe.ghiChuDoc")} {kk.ghiChuDoc}
        </p>
      )}
      {kk.loaiTep === "PDF" && coSua && <DocLaiKiemKeButton id={kk.id} />}

      {kk.trangThai === "DA_AP_DUNG" && kq && (
        <Notice tone="success">
          {t("kiemKe.daApDungLuc", { nguoi: kk.apDungBoi ?? "—", luc: kk.apDungLuc ? ngayGio(kk.apDungLuc) : "—" })}{" "}
          {t("kiemKe.ketQuaChiTiet", {
            doi: kq.thayDoi ?? 0,
            tang: kq.tang ?? 0,
            giam: kq.giam ?? 0,
            khongDoi: kq.khongDoi ?? 0,
            moi: kq.themMoi ?? 0,
            moiKhongThem: kq.moiKhongThem ?? 0,
            khongSo: kq.khongSo ?? 0,
          })}
        </Notice>
      )}

      {!dangDoc && dong.length > 0 && (
        <>
          {kk.trangThai !== "DA_AP_DUNG" && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={t("kiemKe.the_THAY_DOI")} value={tong.THAY_DOI} sub={t("kiemKe.tangGiam", { tang: tong.tang, giam: tong.giam })} tone="brand" />
              <Stat label={t("kiemKe.the_KHONG_DOI")} value={tong.KHONG_DOI} tone="success" />
              <Stat label={t("kiemKe.the_MOI")} value={tong.MOI} tone={tong.MOI ? "warning" : "neutral"} />
              <Stat label={t("kiemKe.the_KHONG_SO")} value={tong.KHONG_SO} tone="muted" />
            </div>
          )}
          <Card>
            {kk.trangThai === "CHO_DUYET" && <p className="mb-2 text-sm text-[var(--text-secondary)]">{t("kiemKe.goiYDoiChieu")}</p>}
            {tong.khongCoTrongFile > 0 && kk.trangThai === "CHO_DUYET" && (
              <p className="mb-3 text-xs text-[var(--text-muted)]">{t("kiemKe.khongCoTrongFile", { n: tong.khongCoTrongFile })}</p>
            )}
            {choDuyet && !coApDung && <Notice tone="muted" className="mb-3">{t("kiemKe.chiXem")}</Notice>}
            <BangKiemKe id={kk.id} dong={dong} keHoach={keHoach.dong} coSua={coSua} coApDung={coApDung} />
          </Card>
        </>
      )}
    </div>
  );
}
