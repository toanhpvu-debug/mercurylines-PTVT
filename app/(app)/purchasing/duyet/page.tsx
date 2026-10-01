import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, FileInput, History, ShieldCheck, UserCheck, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselWhere } from "@/lib/auth";
import { trangThaiUyQuyen } from "@/lib/roles";
import { layT } from "@/lib/i18n/server";
import {
  GIO_CANH_BAO_CHO_DUYET,
  VAI_TRO_DUYET_PO,
  XEM_KIEM_SOAT_PO,
  duocDuyet,
  gioChoDuyet,
  tongDonMua,
  tuCachDuyetPo,
} from "@/lib/donMuaQuyTrinh";
import { coLanhDaoDuyetPo, phamViDonMua } from "@/lib/duyetPoServer";
import { BoChiDinhLanhDao, ChiDinhLanhDaoForm, DuyetNhanhPo, LapUyQuyenDuyetPo } from "@/components/KiemSoatDuyetPo";
import { NhanTrangThaiUyQuyen, ThuHoiUyQuyen } from "@/components/QuyenNangCao";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat, Table, TableWrap, Td, Th, Tr } from "@/components/ui";

export const dynamic = "force-dynamic";

const LINK = "text-brand-700 hover:underline dark:text-brand-300";
const BA_MUOI_NGAY = 30 * 24 * 60 * 60 * 1000;

/**
 * KIỂM SOÁT DUYỆT PO — chỗ làm việc của lãnh đạo phòng Kỹ thuật – Vật tư và
 * người được ủy quyền: PO chuyên viên mua sắm đã trình (duyệt / trả lại ngay
 * tại đây), lịch sử duyệt, ủy quyền duyệt PO, và (quản trị) chỉ định lãnh đạo.
 */
export default async function KiemSoatDuyetPoPage() {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay, ngayGio, so } = await layT();
  const coLanhDao = await coLanhDaoDuyetPo();
  const tuCach = tuCachDuyetPo(user, coLanhDao);
  const laAdmin = user.role === "ADMIN";

  const quayLai = (
    <Link href="/purchasing" className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300">
      <ArrowLeft className="size-4" />
      {t("purchasing.quayLaiMuaSam")}
    </Link>
  );
  if (!XEM_KIEM_SOAT_PO.includes(user.role) && !tuCach.length) {
    return (
      <div className="space-y-5">
        <div>
          {quayLai}
          <PageHeader title={t("purchasing.kiemSoatTieuDe")} />
        </div>
        <Notice tone="warning">{t("purchasing.kiemSoatKhongQuyen")}</Notice>
      </div>
    );
  }

  const scope = phamViDonMua(user, coLanhDao);
  const bayGio = new Date();
  const tu30Ngay = new Date(bayGio.getTime() - BA_MUOI_NGAY);
  const poTrongPhamVi = scope.all ? null : (await prisma.purchaseOrder.findMany({ where: vesselWhere(scope), select: { id: true } })).map((p) => p.id);
  const locLichSu = poTrongPhamVi ? { poId: { in: poTrongPhamVi } } : {};

  const [choDuyet, lichSu, daDuyet30, traLai30, lanhDao, uyQuyen, nguoiVanPhong] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { ...vesselWhere(scope), status: "PENDING_APPROVAL" },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      include: {
        supplier: { select: { name: true } },
        vessel: { select: { code: true, name: true } },
        items: { select: { quantity: true, unitPrice: true } },
      },
    }),
    prisma.lichSuDuyetPo.findMany({ where: locLichSu, orderBy: { id: "desc" }, take: 40 }),
    prisma.lichSuDuyetPo.count({ where: { ...locLichSu, hanhDong: "DUYET", createdAt: { gte: tu30Ngay } } }),
    prisma.lichSuDuyetPo.count({ where: { ...locLichSu, hanhDong: "TRA_LAI", createdAt: { gte: tu30Ngay } } }),
    prisma.user.findMany({ where: { duyetDonMua: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true } }),
    // Ủy quyền liên quan tới việc duyệt PO: loại "chỉ duyệt PO", và ủy quyền
    // toàn bộ của một lãnh đạo (cũng mang theo quyền duyệt PO).
    prisma.delegation.findMany({
      where: { OR: [{ phamVi: "DUYET_PO" }, { phamVi: null, delegator: { duyetDonMua: true } }] },
      orderBy: [{ revokedAt: "asc" }, { endAt: "desc" }],
      take: 40,
      include: {
        delegator: { select: { id: true, name: true, role: true } },
        delegate: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: [...VAI_TRO_DUYET_PO] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, duyetDonMua: true },
    }),
  ]);

  // Người trình theo lịch sử của bản cài này (để luật "không tự duyệt" so theo id).
  const lanTrinh = choDuyet.length
    ? await prisma.lichSuDuyetPo.findMany({
        where: { poId: { in: choDuyet.map((p) => p.id) }, hanhDong: "TRINH" },
        orderBy: { id: "desc" },
        select: { poId: true, nguoiId: true, nguoi: true },
      })
    : [];
  const baoGia = choDuyet.length
    ? await prisma.baoGiaNcc.findMany({ where: { poId: { in: choDuyet.map((p) => p.id) } }, orderBy: { id: "desc" }, select: { id: true, poId: true, soBaoGia: true, fileName: true } })
    : [];
  const trinhTheoPo = new Map<number, { nguoiId: number | null; nguoi: string }>();
  for (const l of lanTrinh) if (!trinhTheoPo.has(l.poId)) trinhTheoPo.set(l.poId, l);
  const baoGiaTheoPo = new Map<number, (typeof baoGia)[number]>();
  for (const b of baoGia) if (b.poId && !baoGiaTheoPo.has(b.poId)) baoGiaTheoPo.set(b.poId, b);

  const dong = choDuyet.map((po) => {
    const trinh = trinhTheoPo.get(po.id);
    const submittedById = trinh && trinh.nguoi === po.submittedBy ? trinh.nguoiId : null;
    const gio = gioChoDuyet(po.submittedAt, bayGio);
    return {
      po,
      tong: tongDonMua(po.items, po.discountPercent, po.transportFee, po.deliveryFee).tong,
      gio,
      kt: duocDuyet(user, { ...po, submittedById }, coLanhDao),
      bg: baoGiaTheoPo.get(po.id) ?? null,
    };
  });
  const quaHan = dong.filter((d) => d.gio >= GIO_CANH_BAO_CHO_DUYET).length;
  const tongTheoTien = new Map<string, number>();
  for (const d of dong) tongTheoTien.set(d.po.currency, (tongTheoTien.get(d.po.currency) ?? 0) + d.tong);
  const tien = (n: number) => so(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const choBaoLau = (gio: number) => (gio >= 24 ? t("purchasing.choNgayGio", { ngay: Math.floor(gio / 24), gio: gio % 24 }) : t("purchasing.choGio", { gio }));

  const laLanhDao = user.duyetDonMua && VAI_TRO_DUYET_PO.includes(user.role);
  const lanhDaoHoatDong = lanhDao.filter((u) => u.isActive && VAI_TRO_DUYET_PO.includes(u.role));
  const moFormUyQuyen = laLanhDao || (laAdmin && lanhDaoHoatDong.length > 0);
  const nguoiNhanUyQuyen = nguoiVanPhong.filter((u) => u.id !== user.id || laAdmin);
  const ungVienChiDinh = nguoiVanPhong.filter((u) => !u.duyetDonMua);

  return (
    <div className="space-y-5">
      <div>
        {quayLai}
        <PageHeader title={t("purchasing.kiemSoatTieuDe")} subtitle={t("purchasing.kiemSoatMoTa")} />
      </div>

      {/* Mình đang duyệt với tư cách gì */}
      {tuCach.length === 0 ? (
        <Notice tone="info">{t("purchasing.kiemSoatChiXem")}</Notice>
      ) : (
        <Notice tone={tuCach.some((x) => x.tamThoi) ? "warning" : "success"}>
          {tuCach.map((x, i) => (
            <span key={i} className="block">
              {x.tamThoi
                ? t("purchasing.tuCachTamThoi")
                : x.kyThay
                  ? t("purchasing.tuCachKyThay", {
                      ten: x.kyThay.name,
                      ngay: (() => {
                        const het = user.duyetPoTu.find((u) => u.delegatorId === x.kyThay?.id)?.endAt;
                        return het ? ngay(het) : "—";
                      })(),
                    })
                  : t("purchasing.tuCachLanhDao")}
            </span>
          ))}
        </Notice>
      )}
      {!coLanhDao && !laAdmin && <Notice tone="warning">{t("purchasing.chuaChiDinhLanhDao")}</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("purchasing.statChoDuyet")}
          value={dong.length}
          tone={dong.length ? "warning" : "neutral"}
          icon={<ShieldCheck className="size-4" />}
          sub={[...tongTheoTien].map(([tt, n]) => `${tien(n)} ${tt}`).join(" · ") || undefined}
        />
        <Stat
          label={t("purchasing.statQuaHan", { gio: GIO_CANH_BAO_CHO_DUYET })}
          value={quaHan}
          tone={quaHan ? "danger" : "neutral"}
          icon={<Clock className="size-4" />}
        />
        <Stat label={t("purchasing.statDaDuyet30")} value={daDuyet30} tone="success" icon={<UserCheck className="size-4" />} />
        <Stat label={t("purchasing.statTraLai30")} value={traLai30} icon={<History className="size-4" />} />
      </div>

      {/* PO chờ duyệt */}
      <Card>
        <CardHeader icon={<ShieldCheck className="size-4" />} title={t("purchasing.poChoDuyet", { n: dong.length })} subtitle={t("purchasing.poChoDuyetMoTa")} />
        {dong.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-5" />} title={t("purchasing.khongCoPoChoDuyet")} />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("purchasing.cotSoPo")}</Th>
                  <Th>{t("purchasing.cotTauNcc")}</Th>
                  <Th align="right">{t("purchasing.cotTongTien")}</Th>
                  <Th>{t("purchasing.cotTrinh")}</Th>
                  <Th>{t("purchasing.cotDaCho")}</Th>
                  <Th>{t("chung.thaoTac")}</Th>
                </tr>
              </thead>
              <tbody>
                {dong.map(({ po, tong, gio, kt, bg }) => (
                  <Tr key={po.id} className="align-top">
                    <Td>
                      <Link href={`/purchasing/${po.id}`} className={`font-display text-xs tracking-wide ${LINK}`}>
                        {po.poNo}
                      </Link>
                      {po.subject && <span className="block text-xs text-[var(--text-secondary)]">{po.subject}</span>}
                      {bg && (
                        <Link href={`/purchasing/bao-gia/${bg.id}`} className={`mt-0.5 inline-flex items-center gap-1 text-xs ${LINK}`}>
                          <FileInput className="size-3.5" />
                          {t("purchasing.baoGiaSo", { so: bg.soBaoGia ?? bg.fileName })}
                        </Link>
                      )}
                    </Td>
                    <Td>
                      {po.vessel.code} {po.vessel.name}
                      <span className="block text-xs text-[var(--text-secondary)]">{po.supplier.name}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{t("purchasing.soDongHang", { n: po.items.length })}</span>
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap font-medium">
                      {tien(tong)} {po.currency}
                    </Td>
                    <Td>
                      {po.submittedBy ?? "—"}
                      <span className="block text-xs text-[var(--text-muted)]">{po.submittedAt ? ngayGio(po.submittedAt) : "—"}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={gio >= GIO_CANH_BAO_CHO_DUYET ? "danger" : gio >= 24 ? "warning" : "muted"}>{choBaoLau(gio)}</Badge>
                    </Td>
                    <Td>
                      {kt.ok ? (
                        <div className="space-y-1">
                          {kt.kyThay && <span className="block text-xs text-[var(--text-muted)]">{t("purchasing.kyThayNgan", { ten: kt.kyThay.name })}</span>}
                          <DuyetNhanhPo poId={po.id} poNo={po.poNo} />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {kt.lyDo === "tuDuyet" && <span className="block text-xs text-[var(--text-warning)]">{t("purchasing.khongTuDuyetNgan")}</span>}
                          <Link href={`/purchasing/${po.id}`} className={`inline-flex items-center gap-1 text-sm ${LINK}`}>
                            {t("purchasing.xemPo")}
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* Lịch sử duyệt */}
      <Card>
        <CardHeader icon={<History className="size-4" />} title={t("purchasing.lichSuDuyetTieuDe")} subtitle={t("purchasing.lichSuDuyetMoTa")} />
        {lichSu.length === 0 ? (
          <EmptyState icon={<History className="size-5" />} title={t("purchasing.chuaCoLichSuDuyet")} />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("purchasing.cotThoiGian")}</Th>
                  <Th>{t("purchasing.cotSoPo")}</Th>
                  <Th>{t("purchasing.cotHanhDong")}</Th>
                  <Th>{t("purchasing.cotNguoiThucHien")}</Th>
                  <Th align="right">{t("purchasing.cotTongTien")}</Th>
                  <Th>{t("purchasing.cotGhiChuDuyet")}</Th>
                </tr>
              </thead>
              <tbody>
                {lichSu.map((l) => (
                  <Tr key={l.id} className="align-top">
                    <Td className="tabular whitespace-nowrap text-xs">{ngayGio(l.createdAt)}</Td>
                    <Td>
                      <Link href={`/purchasing/${l.poId}`} className={`font-display text-xs tracking-wide ${LINK}`}>
                        {l.poNo}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={l.hanhDong === "DUYET" ? "success" : l.hanhDong === "TRA_LAI" ? "danger" : l.hanhDong === "TRINH" ? "info" : "muted"}>
                        {tTuDo(`purchasing.hanhDong_${l.hanhDong}`)}
                      </Badge>
                    </Td>
                    <Td>
                      {l.nguoi}
                      {l.kyThay && <span className="block text-xs text-[var(--text-muted)]">{t("purchasing.kyThayNgan", { ten: l.kyThay })}</span>}
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap">
                      {tien(l.tong)} {l.tienTe}
                    </Td>
                    <Td className="text-[var(--text-secondary)]">{l.ghiChu ?? "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Lãnh đạo phòng KT-VT (người duyệt PO) */}
        <Card>
          <CardHeader icon={<UserCheck className="size-4" />} title={t("purchasing.lanhDaoTieuDe")} subtitle={t("purchasing.lanhDaoMoTa")} />
          {lanhDao.length === 0 ? (
            <Notice tone="warning">{t("purchasing.chuaChiDinhLanhDao")}</Notice>
          ) : (
            <ul className="mb-3 space-y-2 text-sm">
              {lanhDao.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium text-[var(--text-primary)]">{u.name}</span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {tTuDo(`labels.role_${u.role}`)} · {u.email}
                      {!u.isActive && ` · ${t("labels.active_false")}`}
                    </span>
                  </span>
                  {laAdmin && <BoChiDinhLanhDao userId={u.id} ten={u.name} />}
                </li>
              ))}
            </ul>
          )}
          {laAdmin && (
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
              {ungVienChiDinh.length ? (
                <ChiDinhLanhDaoForm ungVien={ungVienChiDinh.map((u) => ({ id: u.id, name: u.name, role: u.role }))} />
              ) : (
                <p className="text-xs text-[var(--text-muted)]">{t("purchasing.khongConUngVien")}</p>
              )}
            </div>
          )}
        </Card>

        {/* Ủy quyền duyệt PO */}
        <Card className="xl:col-span-2">
          <CardHeader icon={<Users className="size-4" />} title={t("purchasing.uyQuyenPoTieuDe")} subtitle={t("purchasing.uyQuyenPoMoTa")} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div>
              {moFormUyQuyen ? (
                <LapUyQuyenDuyetPo
                  lanhDao={lanhDaoHoatDong.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
                  nguoiNhan={nguoiNhanUyQuyen.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
                  laAdmin={laAdmin}
                />
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">{t("purchasing.uyQuyenPoChiLanhDao")}</p>
              )}
            </div>
            {uyQuyen.length === 0 ? (
              <EmptyState icon={<Users className="size-5" />} title={t("vessels.chuaCoUyQuyen")} />
            ) : (
              <TableWrap>
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("purchasing.uqLanhDaoGiao")}</Th>
                      <Th>{t("vessels.cotNguoiNhan")}</Th>
                      <Th>{t("vessels.cotThoiHan")}</Th>
                      <Th>{t("chung.trangThai")}</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {uyQuyen.map((u) => {
                      const trangThai = trangThaiUyQuyen(u, bayGio);
                      const conHieuLuc = trangThai === "HIEU_LUC" || trangThai === "CHUA_TOI";
                      return (
                        <Tr key={u.id} className="align-top">
                          <Td>
                            {u.delegator.name}
                            <span className="block text-xs text-[var(--text-muted)]">
                              {u.phamVi === "DUYET_PO" ? t("purchasing.phamViChiDuyetPo") : t("purchasing.phamViToanBo")}
                            </span>
                          </Td>
                          <Td>
                            {u.delegate.name}
                            <span className="block text-xs text-[var(--text-muted)]">{tTuDo(`labels.role_${u.delegate.role}`)}</span>
                            {u.reason && <span className="block text-xs text-[var(--text-secondary)]">{u.reason}</span>}
                          </Td>
                          <Td className="tabular whitespace-nowrap text-xs">
                            {ngay(u.startAt)} → {ngay(u.endAt)}
                          </Td>
                          <Td>
                            <NhanTrangThaiUyQuyen trangThai={trangThai} revokedAt={u.revokedAt} />
                          </Td>
                          <Td>{conHieuLuc && (laAdmin || u.delegatorId === user.id) && <ThuHoiUyQuyen id={u.id} />}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
