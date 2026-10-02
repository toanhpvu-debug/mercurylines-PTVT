import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { coQuanLySon } from "@/lib/roles";
import { dangDocAi } from "@/lib/phieuGiao";
import { docDongNhanSon } from "@/lib/phieuSon";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import { layT } from "@/lib/i18n/server";
import BangNhanSon from "@/components/BangNhanSon";
import TuLamMoi from "@/components/TuLamMoi";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");

/** Soát một phiếu giao sơn đã tải: sửa dòng đọc sai, chọn loại sơn, rồi nhập vào tồn sơn của tàu. */
export default async function NhanSonPage({ params }: { params: Promise<{ id: string; tepId: string }> }) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio, so } = await layT();
  const p = await params;
  const vesselId = Number(p.id);
  const tepId = Number(p.tepId);
  const tep =
    Number.isInteger(tepId) && tepId > 0 ? await prisma.sonPhieuTep.findUnique({ where: { id: tepId }, include: { vessel: { select: { id: true, code: true, name: true } } } }) : null;
  if (!tep || tep.vesselId !== vesselId || !trongPhamVi(vesselScopeDayDu(user), tep.vesselId)) notFound();
  const coQuyen = coQuanLySon(user, tep.vesselId);
  const dangDoc = tep.trangThai === "CHO_XU_LY" && dangDocAi(tep.aiDangDocTu);
  const coSua = coQuyen && tep.trangThai === "CHO_XU_LY" && !dangDoc;
  const tenLoai = (ma: string) => (ma in PAINT_TYPE_LABEL ? tTuDo(`paint.loaiSon_${ma}`) : ma);
  const [sanPham, coAi] = await Promise.all([
    prisma.paintProduct.findMany({
      where: { isActive: true },
      orderBy: [{ paintType: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, maker: true, paintType: true, colorName: true, uom: true },
    }),
    coSua && tep.loaiTep === "PDF" ? import("@/lib/cauHinhAi").then(async (m) => Boolean(await m.layCauHinhAi())) : Promise.resolve(false),
  ]);
  const son = sanPham.map((s) => ({ id: s.id, code: s.code, uom: s.uom, label: [s.name, s.maker, tenLoai(s.paintType), s.colorName].filter(Boolean).join(" · ") }));
  const dong = docDongNhanSon(tep.dong);
  const tienDo = tep.aiTienDo && tep.aiTienDo.includes("/") ? tep.aiTienDo : t("paint.pgTienDoChuaRo");
  const kq = (tep.ketQua ?? null) as { soLoai?: number; tongSoLuong?: number; taoMoi?: number } | null;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/paint/${tep.vesselId}`} className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("paint.pgQuayLai", { tau: tep.vessel.name })}
        </Link>
        <PageHeader
          title={tep.fileName}
          subtitle={`${tep.vessel.code} ${tep.vessel.name} · ${t("paint.pgNguoiTaiLuc", { nguoi: tep.nguoiTai, luc: ngayGio(tep.createdAt) })}`}
          action={
            <>
              <Badge tone={tep.trangThai === "DA_AP_DUNG" ? "success" : dangDoc ? "info" : "warning"} dot>
                {dangDoc ? t("paint.pgAiDangDocNgan") : tep.trangThai === "DA_AP_DUNG" ? t("paint.pgDaNhapNhan") : t("paint.pgChoXuLy")}
              </Badge>
              <a href={`/api/son-phieu/${tep.id}/file`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                {tep.loaiTep === "PDF" ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
                {t("paint.pgTepGoc")}
              </a>
            </>
          }
        />
      </div>
      {dangDoc && (
        <>
          <TuLamMoi giay={5} />
          <Notice tone="info">{t("paint.pgAiDangDoc", { tienDo })}</Notice>
        </>
      )}
      {tep.loiAi && !dangDoc && (
        <Notice tone="warning">
          {t("paint.pgAiBao")} {tep.loiAi}
        </Notice>
      )}
      {tep.ghiChuDoc && <p className="text-xs text-[var(--text-muted)]">{tep.ghiChuDoc}</p>}
      {tep.trangThai === "DA_AP_DUNG" && (
        <Notice tone="success">
          {t("paint.pgDaNhapLuc", { nguoi: tep.apDungBoi ?? "—", luc: tep.apDungLuc ? ngayGio(tep.apDungLuc) : "—" })}{" "}
          {kq && t("paint.pgKetQua", { loai: kq.soLoai ?? 0, sl: so(kq.tongSoLuong ?? 0), moi: kq.taoMoi ?? 0 })}
        </Notice>
      )}
      {!dangDoc && (
        <div className={`grid grid-cols-1 gap-5 ${tep.loaiTep === "PDF" ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          <Card className="min-w-0">
            {coSua && <p className="mb-3 text-sm text-[var(--text-secondary)]">{t("paint.pgGoiYSoat")}</p>}
            {dong.length === 0 && coSua && <Notice tone="warning">{t("paint.pgChuaCoDong")}</Notice>}
            <BangNhanSon
              id={tep.id}
              dong={dong}
              dau={{ soPhieu: tep.soPhieu ?? "", nhaCungCap: tep.nhaCungCap ?? "", ngayNhan: iso(tep.ngayNhan) }}
              son={son}
              coSua={coSua}
              docLaiAi={coAi}
            />
          </Card>
          {tep.loaiTep === "PDF" && (
            <Card padded={false} className="hidden min-h-[70vh] overflow-hidden 2xl:block">
              <iframe src={`/api/son-phieu/${tep.id}/file`} title={tep.fileName} className="h-full min-h-[70vh] w-full" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
