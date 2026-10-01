import Link from "next/link";
import { ArrowLeft, FileInput, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScopeDayDu, vesselWhere } from "@/lib/auth";
import { LAP_DON_MUA } from "@/lib/donMuaQuyTrinh";
import { dangDocAi } from "@/lib/phieuGiao";
import { layT } from "@/lib/i18n/server";
import TaiBaoGiaForm from "@/components/TaiBaoGiaForm";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Báo giá nhà cung cấp: tải lên (Word / Excel / PDF / scan), xử lý thành PO nháp. */
export default async function BaoGiaPage({ searchParams }: { searchParams: Promise<{ vessel?: string; po?: string }> }) {
  const user = await requireScopedUser();
  const { t, ngayGio } = await layT();
  const scope = vesselScopeDayDu(user);
  const params = await searchParams;
  const canManage = LAP_DON_MUA.includes(user.role);
  const [vessels, suppliers, poNhap, ds] = await Promise.all([
    prisma.vessel.findMany({ where: vesselIdWhere(scope), orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchaseOrder.findMany({
      where: { ...vesselWhere(scope), status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, poNo: true, vesselId: true, supplier: { select: { name: true } } },
    }),
    prisma.baoGiaNcc.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fileName: true,
        loaiTep: true,
        soBaoGia: true,
        nhaCungCapDoc: true,
        supplierId: true,
        poId: true,
        trangThai: true,
        aiDangDocTu: true,
        nguoiTai: true,
        createdAt: true,
        dong: true,
        vessel: { select: { code: true } },
      },
    }),
  ]);
  const tenNcc = new Map(suppliers.map((s) => [s.id, s.name]));
  const soPo = new Map(
    (await prisma.purchaseOrder.findMany({ where: { id: { in: ds.map((d) => d.poId).filter((x): x is number => x !== null) } }, select: { id: true, poNo: true } })).map((p) => [p.id, p.poNo])
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/purchasing" className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--text-brand)] hover:underline">
          <ArrowLeft className="size-4" />
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <PageHeader title={t("purchasing.baoGiaTieuDe")} subtitle={t("purchasing.baoGiaMoTa")} />
      </div>
      {scope.unassigned && <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[26rem_minmax(0,1fr)]">
        {canManage && (
          <Card>
            <CardHeader icon={<Upload className="size-4" />} title={t("purchasing.taiBaoGiaTieuDe")} />
            <TaiBaoGiaForm
              vessels={vessels}
              suppliers={suppliers}
              poNhap={poNhap.map((p) => ({ id: p.id, poNo: p.poNo, vesselId: p.vesselId, nhaCungCap: p.supplier.name }))}
              macDinh={{ vesselId: Number(params.vessel) || null, poId: Number(params.po) || null }}
            />
          </Card>
        )}
        <Card className="min-w-0">
          <CardHeader icon={<FileInput className="size-4" />} title={t("purchasing.danhSachBaoGia", { n: ds.length })} />
          {ds.length === 0 ? (
            <EmptyState title={t("purchasing.chuaCoBaoGia")} />
          ) : (
            <TableWrap>
              <Table dense>
                <thead>
                  <tr>
                    <Th>{t("purchasing.cotNgayTai")}</Th>
                    <Th>{t("chung.tau")}</Th>
                    <Th>{t("purchasing.cotBaoGia")}</Th>
                    <Th>{t("purchasing.nhaCungCap")}</Th>
                    <Th align="right">{t("purchasing.cotSoDong")}</Th>
                    <Th>{t("purchasing.cotTrangThaiBaoGia")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {ds.map((b) => {
                    const doc = b.trangThai === "CHO_XU_LY" && dangDocAi(b.aiDangDocTu);
                    return (
                      <Tr key={b.id} className="align-top">
                        <Td className="whitespace-nowrap">{ngayGio(b.createdAt)}</Td>
                        <Td className="font-display text-xs tracking-wide">{b.vessel.code}</Td>
                        <Td>
                          <Link href={`/purchasing/bao-gia/${b.id}`} className="font-medium text-[var(--text-brand)] hover:underline">
                            {b.soBaoGia ?? b.fileName}
                          </Link>
                          <p className="text-xs text-[var(--text-muted)]">
                            {b.fileName} · {b.loaiTep} · {b.nguoiTai}
                          </p>
                        </Td>
                        <Td>{(b.supplierId && tenNcc.get(b.supplierId)) ?? b.nhaCungCapDoc ?? "—"}</Td>
                        <Td align="right">{Array.isArray(b.dong) ? b.dong.length : 0}</Td>
                        <Td>
                          <Badge tone={doc ? "info" : b.trangThai === "DA_AP_DUNG" ? "success" : "warning"} dot>
                            {doc ? t("purchasing.aiDangDocNgan") : b.trangThai === "DA_AP_DUNG" ? t("purchasing.baoGiaDaDung") : t("purchasing.baoGiaChoXuLy")}
                          </Badge>
                          {b.poId && soPo.get(b.poId) && (
                            <p className="mt-1 text-xs">
                              <Link href={`/purchasing/${b.poId}`} className="text-[var(--text-brand)] hover:underline">
                                {soPo.get(b.poId)}
                              </Link>
                            </p>
                          )}
                        </Td>
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
