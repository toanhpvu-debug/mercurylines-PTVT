import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselScopeDayDu } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU, boPhanCuaChucDanh, coQuanLySon, nguoiDuyetCapTau, trinhThangLenCongTy, trongPhamVi } from "@/lib/roles";
import { dangDocAi } from "@/lib/phieuGiao";
import { docDauYeuCau, docDongYeuCauFile } from "@/lib/yeuCauNhap";
import { dongFormSonTuFile, ghepSon } from "@/lib/yeuCauSon";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import TaiFileYeuCau, { BoFileYeuCauButton } from "@/components/TaiFileYeuCau";
import TuLamMoi from "@/components/TuLamMoi";
import YeuCauSonForm, { type DienSonTuFile } from "@/components/YeuCauSonForm";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, TONE_YEU_CAU, Table, TableWrap, Td, Th, Tr } from "@/components/ui";

export const dynamic = "force-dynamic";

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

/**
 * YÊU CẦU SƠN TỪ TÀU: đại phó (hoặc thuyền trưởng / máy trưởng / quản trị) chọn
 * sơn từ danh mục sơn hoặc tải phiếu MLS-11-05 (Word / Excel / PDF / PDF scan),
 * soát dòng rồi trình. Yêu cầu đi đúng dây chuyền yêu cầu vật tư: thuyền trưởng
 * duyệt cấp tàu → công ty duyệt → mua sắm → nhận hàng cộng vào tồn sơn.
 */
export default async function YeuCauSonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tuTep?: string }> }) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay } = await layT();
  const vesselId = Number((await params).id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  if (!trongPhamVi(vesselScopeDayDu(user), vesselId)) notFound();
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true, name: true } });
  if (!vessel) notFound();
  const coLap = coQuanLySon(user, vesselId) && LAP_YEU_CAU.includes(user.role);
  const tenLoaiSon = (ma: string) => (ma in PAINT_TYPE_LABEL ? tTuDo(`paint.loaiSon_${ma}`) : ma);

  const [sanPham, ton, ganDay] = await Promise.all([
    prisma.paintProduct.findMany({
      where: { isActive: true },
      orderBy: [{ paintType: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, maker: true, paintType: true, colorName: true, colorCode: true, uom: true },
    }),
    prisma.paintStock.findMany({ where: { vesselId }, select: { productId: true, quantity: true, minQty: true } }),
    // Yêu cầu sơn gần đây của tàu — người lập theo dõi được đã tới bước nào.
    prisma.materialRequest.findMany({
      where: { vesselId, items: { some: { paintProductId: { not: null } } } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, requestNo: true, status: true, createdAt: true, requestedBy: true, _count: { select: { items: true } } },
    }),
  ]);
  const tonTheoId = new Map(ton.map((s) => [s.productId, s]));
  const son = sanPham.map((p) => ({
    id: p.id,
    code: p.code,
    uom: p.uom,
    label: [p.name, p.maker, tenLoaiSon(p.paintType), p.colorName].filter(Boolean).join(" · "),
    ton: tonTheoId.get(p.id)?.quantity ?? 0,
    minQty: tonTheoId.get(p.id)?.minQty ?? 0,
  }));

  // Phiếu MLS-11-05 vừa tải (?tuTep=<id>): chỉ người tải (hoặc quản trị), đúng tàu, đúng loại "SON".
  const tuTepId = Number((await searchParams).tuTep) || 0;
  const tepTho =
    tuTepId > 0
      ? await prisma.yeuCauTep.findUnique({
          where: { id: tuTepId },
          select: { id: true, fileName: true, vesselId: true, dau: true, dong: true, loiAi: true, aiDangDocTu: true, aiTienDo: true, nguoiTaiId: true, requestId: true, muc: true },
        })
      : null;
  const tep = tepTho && tepTho.muc === "SON" && tepTho.vesselId === vesselId && (tepTho.nguoiTaiId === user.id || user.role === "ADMIN") ? tepTho : null;
  const tepDangDoc = Boolean(tep && dangDocAi(tep.aiDangDocTu));
  const coDongTep = Array.isArray(tep?.dong) && tep.dong.length > 0;
  let banDau: DienSonTuFile | undefined;
  if (tep && !tepDangDoc && !tep.requestId && coDongTep) {
    const dau = docDauYeuCau(tep.dau);
    const dong = docDongYeuCauFile(tep.dong);
    const ghep = ghepSon(dong, sanPham);
    banDau = {
      tepId: tep.id,
      ten: tep.fileName,
      dong: dongFormSonTuFile(dong, ghep, (d) => d.canhBao ?? undefined),
      purpose: dau.soYeuCau ? t("requests.tepSoGoc", { so: dau.soYeuCau }) : "",
      requiredDate: dau.ngay ?? "",
      khop: ghep.filter(Boolean).length,
      moi: ghep.filter((g) => !g).length,
      thieuSo: dong.filter((d) => !(d.soLuong !== null && d.soLuong > 0)).length,
      canhBao: dong.filter((d) => d.canhBao).length,
    };
  }
  const yeuCauTuTep = tep?.requestId ? await prisma.materialRequest.findUnique({ where: { id: tep.requestId }, select: { id: true, requestNo: true } }) : null;
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  const coAi = coLap ? Boolean(await layCauHinhAi()) : false;

  // Ai duyệt kế tiếp: thuyền trưởng / quản trị lập thì cấp tàu coi như đã ký → công ty.
  const boPhan = boPhanCuaChucDanh(user.role) ?? "DECK";
  const nguoiDuyet = trinhThangLenCongTy(user.role) ? t("labels.role_TECH_MANAGER") : tTuDo(`labels.role_${nguoiDuyetCapTau(boPhan)}`);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/paint/${vesselId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-4" />
          {t("paint.ycQuayLai", { tau: vessel.name })}
        </Link>
        <PageHeader title={t("paint.ycTieuDe", { tau: vessel.name })} subtitle={t("paint.ycMoTa")} />
      </div>

      <Notice tone="info">
        {t("paint.ycLuong", {
          nguoiLap: tTuDo(`labels.role_${user.role}`),
          boPhan: tTuDo(`labels.reqDept_${boPhan}`),
          nguoiDuyet,
        })}
      </Notice>

      {!coLap ? (
        <Notice tone="warning">{t("paint.ycKhongCoQuyen")}</Notice>
      ) : (
        <>
          <TaiFileYeuCau coAi={coAi} moSan={!banDau} son={{ vesselId }} />
          {tuTepId > 0 && !tep && <Notice tone="warning">{t("requests.tepKhongThay")}</Notice>}
          {tep && (tepDangDoc || banDau || (!tep.requestId && !coDongTep)) && (
            <div className="space-y-2">
              {tepDangDoc ? (
                <Notice tone="info">
                  {t("requests.tepAiDangDoc", { ten: tep.fileName, tienDo: tep.aiTienDo && tep.aiTienDo !== "0" ? ` (${tep.aiTienDo})` : "" })}
                  <TuLamMoi giay={5} />
                </Notice>
              ) : !coDongTep ? (
                <Notice tone="danger">{t("requests.tepAiLoi", { ten: tep.fileName, loi: tep.loiAi ?? "—" })}</Notice>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a href={`/api/yeu-cau-tep/${tep.id}/file`} target="_blank" rel="noopener" className={LINK}>
                  {t("requests.tepXemGoc")}
                </a>
                <BoFileYeuCauButton id={tep.id} />
              </div>
            </div>
          )}
          {yeuCauTuTep && (
            <Notice tone="info">
              <Link href={`/requests/${yeuCauTuTep.id}`} className={LINK}>
                {t("requests.tepDaDung", { ten: tep!.fileName, ma: yeuCauTuTep.requestNo })}
              </Link>
            </Notice>
          )}
          <YeuCauSonForm key={banDau ? `tep-${banDau.tepId}` : "moi"} vesselId={vesselId} son={son} nguoiDuyet={nguoiDuyet} banDau={banDau} />
        </>
      )}

      <Card>
        <CardHeader icon={<ClipboardList className="size-4" />} title={t("paint.ycGanDay", { n: ganDay.length })} />
        {ganDay.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title={t("paint.ycChuaCoYeuCau")} />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("requests.cotSoYeuCau")}</Th>
                  <Th>{t("requests.cotLapLuc")}</Th>
                  <Th>{t("requests.nguoiYeuCau")}</Th>
                  <Th align="right">{t("paint.ycSoDong")}</Th>
                  <Th>{t("chung.trangThai")}</Th>
                </tr>
              </thead>
              <tbody>
                {ganDay.map((r) => (
                  <Tr key={r.id}>
                    <Td className="whitespace-nowrap">
                      <Link href={`/requests/${r.id}`} className={`font-display text-xs tracking-wide ${LINK}`}>
                        {r.requestNo}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{ngay(r.createdAt)}</Td>
                    <Td>{r.requestedBy}</Td>
                    <Td align="right">{r._count.items}</Td>
                    <Td>
                      <Badge tone={TONE_YEU_CAU[r.status] ?? "neutral"} dot>
                        {tTuDo(`labels.reqStatus_${r.status}`)}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
