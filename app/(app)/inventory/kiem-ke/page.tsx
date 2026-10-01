import Link from "next/link";
import { ClipboardCheck, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScopeDayDu, vesselWhere } from "@/lib/auth";
import { NGUOI_TAI_KIEM_KE } from "@/lib/kiemKe";
import { dangDocAi } from "@/lib/phieuGiao";
import { layT } from "@/lib/i18n/server";
import TaiKiemKeForm from "@/components/TaiKiemKeForm";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr, type Tone } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE_TRANG_THAI: Record<string, Tone> = { CHO_DUYET: "warning", DANG_AP_DUNG: "info", DA_AP_DUNG: "success" };

/**
 * Kiểm kê theo file MLS-11-06: tải file thuyền viên đã đếm (Excel / PDF scan),
 * đối chiếu, rồi áp dụng — tồn mặt hàng đã có được đặt đúng số đếm.
 */
export default async function KiemKePage() {
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const [vessels, warehouses, ds] = await Promise.all([
    prisma.vessel.findMany({ where: vesselIdWhere(scope), orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.warehouse.findMany({ where: vesselWhere(scope), orderBy: { code: "asc" }, select: { id: true, code: true, name: true, vesselId: true } }),
    prisma.kiemKeTep.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fileName: true,
        loaiTep: true,
        ngayKiemKe: true,
        trangThai: true,
        aiDangDocTu: true,
        nguoiTai: true,
        createdAt: true,
        dong: true,
        ketQua: true,
        vessel: { select: { code: true, name: true } },
      },
    }),
  ]);
  const taiDuoc = NGUOI_TAI_KIEM_KE.includes(user.role) && !scope.unassigned && vessels.length > 0;
  const homNay = new Date();
  const homNayStr = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, "0")}-${String(homNay.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/inventory" className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("menu.tonKho")}
        </Link>
        <PageHeader title={t("kiemKe.tieuDe")} subtitle={t("kiemKe.moTa")} />
      </div>
      {scope.unassigned && <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[26rem_minmax(0,1fr)]">
        {taiDuoc && (
          <Card>
            <CardHeader icon={<Upload className="size-4" />} title={t("kiemKe.taiLenTieuDe")} />
            <TaiKiemKeForm
              vessels={vessels}
              warehouses={warehouses.flatMap((w) => (w.vesselId === null ? [] : [{ id: w.id, vesselId: w.vesselId, label: `${w.code} · ${w.name}` }]))}
              homNay={homNayStr}
            />
          </Card>
        )}
        <Card className="min-w-0">
          <CardHeader icon={<ClipboardCheck className="size-4" />} title={t("kiemKe.lichSu")} />
          {ds.length === 0 ? (
            <EmptyState title={t("kiemKe.chuaCo")} />
          ) : (
            <TableWrap>
              <Table dense>
                <thead>
                  <tr>
                    <Th>{t("kiemKe.cot_ngayTai")}</Th>
                    <Th>{t("kiemKe.tau")}</Th>
                    <Th>{t("kiemKe.cot_tep")}</Th>
                    <Th>{t("kiemKe.ngayKiemKe")}</Th>
                    <Th className="text-right">{t("kiemKe.cot_soDong")}</Th>
                    <Th>{t("kiemKe.cot_trangThai")}</Th>
                    <Th>{t("kiemKe.cot_nguoiTai")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {ds.map((k) => {
                    const kq = (k.ketQua ?? null) as { thayDoi?: number; themMoi?: number } | null;
                    const doc = k.trangThai === "CHO_DUYET" && dangDocAi(k.aiDangDocTu);
                    return (
                      <Tr key={k.id} className="align-top">
                        <Td className="whitespace-nowrap">{ngayGio(k.createdAt)}</Td>
                        <Td className="whitespace-nowrap">
                          <span className="font-display text-xs tracking-wide">{k.vessel.code}</span>
                        </Td>
                        <Td>
                          <Link href={`/inventory/kiem-ke/${k.id}`} className="font-medium text-[var(--text-brand)] hover:underline">
                            {k.fileName}
                          </Link>
                          <p className="text-xs text-[var(--text-muted)]">{tTuDo(`kiemKe.loaiTep_${k.loaiTep}`)}</p>
                        </Td>
                        <Td className="whitespace-nowrap">{ngay(k.ngayKiemKe)}</Td>
                        <Td className="tabular text-right">{Array.isArray(k.dong) ? k.dong.length : 0}</Td>
                        <Td>
                          <Badge tone={doc ? "info" : (TONE_TRANG_THAI[k.trangThai] ?? "neutral")} dot>
                            {doc ? t("kiemKe.aiDangDocNgan") : tTuDo(`kiemKe.trangThai_${k.trangThai}`)}
                          </Badge>
                          {kq && (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{t("kiemKe.ketQuaNgan", { doi: kq.thayDoi ?? 0, moi: kq.themMoi ?? 0 })}</p>
                          )}
                        </Td>
                        <Td>{k.nguoiTai}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
