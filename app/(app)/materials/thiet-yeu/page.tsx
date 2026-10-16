import { Fragment } from "react";
import Link from "next/link";
import { Eye, History, PackageSearch, Ship } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere } from "@/lib/auth";
import { coQuanLyThietYeu, vesselScopeDayDu } from "@/lib/roles";
import { layBangThietYeu, layLichSuThietYeu, tongQuanDoiThietYeu } from "@/lib/thietYeuServer";
import { canBoSung, gomNhom, laThieu, ngayBaoCao, soIn, thangHopLe, tongHopNhom } from "@/lib/thietYeu";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import BangThietYeu from "@/components/BangThietYeu";
import NhapThietYeuForm from "@/components/NhapThietYeuForm";
import XoaBanInSauNhap from "@/components/XoaBanInSauNhap";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Notice, PageHeader, Select, Stat, Table, TableWrap, Td, Th, Tr, TrNhom } from "@/components/ui";

export const dynamic = "force-dynamic";

const SO_THANG_THEO_DOI = 6;
const tenThang = (t: string | null) => (t ? `${t.slice(5)}/${t.slice(0, 4)}` : "");

/**
 * Phụ tùng thiết yếu MLS-11-04 — danh mục RIÊNG của từng tàu (không lẫn vào danh mục vật
 * tư chung): nhập từ tệp tàu gửi (Word / Excel, xem trước rồi mới nhập; nhập tệp tháng sau
 * là cập nhật số), điền số hằng tháng, in hoặc xuất Word đúng mẫu công ty để Máy trưởng /
 * Thuyền trưởng ký gửi văn phòng. Quản lý: toàn đội (tàu nào thiếu, tàu nào chưa báo cáo),
 * theo nhóm, mục cần bổ sung, theo dõi nhiều tháng.
 */
export default async function ThietYeuPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; thang?: string; daGo?: string; daNhap?: string }>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  const params = await searchParams;
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const tau = vessels.find((v) => v.id === Number(params.vessel)) ?? vessels[0] ?? null;
  const thang = thangHopLe(params.thang);
  const thangHienTai = thangHopLe(null);

  if (scope.unassigned || !tau) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("thietYeu.tieuDe")} subtitle={t("thietYeu.moTa")} />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  const [dong, lichSu, doi] = await Promise.all([
    layBangThietYeu(tau.id, thang),
    layLichSuThietYeu(tau.id, thang, SO_THANG_THEO_DOI),
    vessels.length > 1 ? tongQuanDoiThietYeu(vessels.map((v) => v.id), thang) : Promise.resolve(null),
  ]);
  const coQuyen = coQuanLyThietYeu(user, tau.id);
  // Gỡ cả danh mục: quản trị ở bản cài văn phòng (như mọi chức năng gỡ / xóa khác).
  const goDuoc = user.role === "ADMIN" && !(await laBanTau());
  // Vừa gỡ danh mục (goDanhMucThietYeu → URL ?daGo=<số mục>): báo lại ở đầu trang.
  const daGo = dong.length === 0 && /^\d{1,4}$/.test(params.daGo ?? "") ? Number(params.daGo) : 0;
  // Vừa nhập tệp (NhapThietYeuForm → ?daNhap=n.nhom.moi.capNhat.xoa.soThang.gan): báo lại ở đầu trang.
  const daNhap = /^\d{1,4}(\.\d{1,4}){6}$/.test(params.daNhap ?? "") ? params.daNhap!.split(".").map(Number) : null;
  const soThieu = dong.filter(laThieu).length;
  const soChuaCoSo = dong.filter((d) => d.hienCo === null).length;
  const soDaLuu = dong.filter((d) => d.nguon === "DA_LUU").length;
  const theoNhom = tongHopNhom(dong);
  const boSung = dong.filter(laThieu).map((d) => ({ d, can: canBoSung(d)! }));
  const chuNhom = (n: string) => /^\s*([A-ZĐ])\s*[.)]/.exec(n)?.[1] ?? "";
  const lien = (vesselId: number) => `/materials/thiet-yeu?vessel=${vesselId}&thang=${thang}`;
  const tauCoDanhMuc = doi ? vessels.flatMap((v) => { const x = doi.get(v.id); return x && x.soMuc > 0 ? [{ v, x }] : []; }) : [];
  const tauChuaCo = doi ? vessels.filter((v) => !(doi.get(v.id)?.soMuc ?? 0)) : [];

  return (
    <div className="space-y-5">
      <div className="no-print">
        <PageHeader title={t("thietYeu.tieuDe")} subtitle={t("thietYeu.moTa")} />
      </div>

      <Card className="no-print">
        <form className="flex flex-wrap items-end gap-3">
          {vessels.length > 1 ? (
            <Field label={t("chung.tau")} className="w-64">
              <Select name="vessel" defaultValue={tau.id}>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} - {v.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="vessel" value={tau.id} />
          )}
          <Field label={t("inventory.thang")} className="w-44">
            <Input name="thang" type="month" defaultValue={thang} max={thangHienTai} />
          </Field>
          <Button type="submit" variant="primary" icon={<Eye className="size-4" />}>
            {t("thietYeu.xem")}
          </Button>
        </form>
      </Card>

      {doi && (
        <Card className="no-print">
          <CardHeader icon={<Ship className="size-4" />} title={t("thietYeu.doiTieuDe", { thang: tenThang(thang) })} subtitle={t("thietYeu.doiMoTa")} />
          {tauCoDanhMuc.length > 0 && (
            <TableWrap>
              <Table dense>
                <thead>
                  <tr>
                    <Th>{t("thietYeu.doi_tau")}</Th>
                    <Th className="text-right">{t("thietYeu.cot_soMuc")}</Th>
                    <Th className="text-right">{t("thietYeu.cot_thieu")}</Th>
                    <Th className="text-right">{t("thietYeu.cot_chuaCoSo")}</Th>
                    <Th>{t("thietYeu.doi_daLuu", { thang: tenThang(thang) })}</Th>
                    <Th>{t("thietYeu.doi_ganNhat")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {tauCoDanhMuc.map(({ v, x }) => (
                    <Tr key={v.id} className={v.id === tau.id ? "bg-brand-500/10" : undefined}>
                      <Td className="whitespace-nowrap">
                        <Link href={lien(v.id)} className="inline-flex items-center gap-1.5 font-medium text-[var(--text-brand)] hover:underline">
                          <Ship className="size-3.5" />
                          {v.code} - {v.name}
                        </Link>
                      </Td>
                      <Td className="tabular text-right">{x.soMuc}</Td>
                      <Td className={`tabular text-right ${x.soThieu ? "font-semibold text-[var(--text-danger)]" : "text-[var(--text-muted)]"}`}>{x.soThieu || "–"}</Td>
                      <Td className={`tabular text-right ${x.soChuaCoSo ? "text-[var(--text-warning)]" : "text-[var(--text-muted)]"}`}>{x.soChuaCoSo || "–"}</Td>
                      <Td>
                        {x.daLuuThang > 0 ? (
                          <Badge tone={x.daLuuThang >= x.soMuc ? "success" : "warning"}>
                            {x.daLuuThang}/{x.soMuc}
                          </Badge>
                        ) : (
                          <Badge tone="muted">{t("thietYeu.doi_chuaLuu")}</Badge>
                        )}
                      </Td>
                      <Td className="tabular">{tenThang(x.thangGanNhat) || "–"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          {tauChuaCo.length > 0 && (
            // Tàu chưa nhập danh mục: một dòng tên, không chiếm mỗi tàu một hàng.
            <p className={`text-sm text-[var(--text-secondary)] ${tauCoDanhMuc.length ? "mt-3" : ""}`}>
              {t("thietYeu.doi_chuaCoDanhMuc", { n: tauChuaCo.length })}{" "}
              {tauChuaCo.map((v, i) => (
                <Fragment key={v.id}>
                  {i ? ", " : ""}
                  <Link href={lien(v.id)} className={`hover:underline ${v.id === tau.id ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-brand)]"}`}>
                    {v.code}
                  </Link>
                </Fragment>
              ))}
            </p>
          )}
        </Card>
      )}

      {daNhap && <XoaBanInSauNhap vesselId={tau.id} />}
      {daNhap && (
        <Notice tone="success" className="no-print">
          {t("thietYeu.daNhapTep", {
            n: daNhap[0],
            nhom: daNhap[1],
            moi: daNhap[2],
            capNhat: daNhap[3],
            xoa: daNhap[4] ? t("thietYeu.daNhapXoa", { n: daNhap[4] }) : "",
            thang,
            soThang: daNhap[5],
            gan: daNhap[6],
          })}
        </Notice>
      )}

      {daGo > 0 && (
        <Notice tone="success" className="no-print">
          {t("thietYeu.daGoDanhMucNgan", { tau: tau.name, n: daGo })}
        </Notice>
      )}

      {dong.length === 0 ? (
        <Card className="no-print">
          <EmptyState title={t("thietYeu.chuaCoDanhMuc")} hint={coQuyen ? t("thietYeu.chuaCoDanhMucGoiY") : t("thietYeu.chiXem")} />
          {coQuyen && (
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <CardHeader title={t("thietYeu.nhapTieuDe")} />
              <NhapThietYeuForm vesselId={tau.id} soMucHienCo={0} thangHienTai={thangHienTai} />
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="no-print grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("thietYeu.tongMuc")} value={dong.length} />
            <Stat label={t("thietYeu.soThieu")} value={soThieu} tone={soThieu > 0 ? "danger" : "success"} />
            <Stat label={t("thietYeu.soChuaCoSo")} value={soChuaCoSo} tone={soChuaCoSo > 0 ? "warning" : "neutral"} />
            <Stat label={t("thietYeu.soDaLuu")} value={`${soDaLuu}/${dong.length}`} tone={soDaLuu === dong.length ? "success" : "neutral"} />
          </div>

          <div className="no-print grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <Card>
              <CardHeader title={t("thietYeu.theoNhomTieuDe", { thang: tenThang(thang) })} />
              <TableWrap>
                <Table dense xuongDong>
                  <thead>
                    <tr>
                      <Th>{t("thietYeu.cot_nhom")}</Th>
                      <Th className="text-right">{t("thietYeu.cot_soMuc")}</Th>
                      <Th className="text-right">{t("thietYeu.cot_dat")}</Th>
                      <Th className="text-right">{t("thietYeu.cot_thieu")}</Th>
                      <Th className="text-right">{t("thietYeu.cot_chuaCoSo")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {theoNhom.map((g) => (
                      <Tr key={g.nhom}>
                        <Td>{g.nhom}</Td>
                        <Td className="tabular text-right">{g.soMuc}</Td>
                        <Td className="tabular text-right text-[var(--text-success)]">{g.soMuc - g.soThieu - g.soChuaCoSo}</Td>
                        <Td className={`tabular text-right ${g.soThieu ? "font-semibold text-[var(--text-danger)]" : "text-[var(--text-muted)]"}`}>{g.soThieu || "–"}</Td>
                        <Td className={`tabular text-right ${g.soChuaCoSo ? "text-[var(--text-warning)]" : "text-[var(--text-muted)]"}`}>{g.soChuaCoSo || "–"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>

            <Card>
              <CardHeader
                icon={<PackageSearch className="size-4" />}
                title={t("thietYeu.canBoSungTieuDe", { n: boSung.length })}
                subtitle={t("thietYeu.canBoSungMoTa", { thang: tenThang(thang) })}
              />
              {boSung.length === 0 ? (
                <p className="text-sm text-[var(--text-success)]">{t("thietYeu.canBoSungTrong", { thang: tenThang(thang) })}</p>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <TableWrap>
                    <Table dense xuongDong>
                      <thead>
                        <tr>
                          <Th className="w-12">#</Th>
                          <Th className="min-w-56">{t("thietYeu.cot_moTa")}</Th>
                          <Th className="text-right">{t("thietYeu.cot_toiThieu")}</Th>
                          <Th className="text-right">{t("thietYeu.cot_hienCo")}</Th>
                          <Th className="text-right">{t("thietYeu.cot_canThem")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {boSung.map(({ d, can }) => (
                          <Tr key={d.id}>
                            <Td className="tabular whitespace-nowrap text-[var(--text-muted)]">
                              {chuNhom(d.nhom)}
                              {chuNhom(d.nhom) ? "." : ""}
                              {d.stt}
                            </Td>
                            <Td className="min-w-56">
                              {d.moTa}
                              {d.partNo && <span className="block text-xs text-[var(--text-muted)]">P/N {d.partNo}</span>}
                            </Td>
                            <Td className="whitespace-nowrap text-right">{d.toiThieu}</Td>
                            <Td className="tabular text-right">{soIn(d.hienCo)}</Td>
                            <Td className="tabular whitespace-nowrap text-right font-semibold text-[var(--text-danger)]">
                              {soIn(can.so)} {can.donVi}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                </div>
              )}
            </Card>
          </div>

          <Notice tone={soDaLuu === dong.length ? "success" : "info"} className="no-print">
            {soDaLuu === dong.length ? t("thietYeu.thangDaLuu", { thang }) : t("thietYeu.thangChuaLuu", { thang })}{" "}
            <span className="text-xs text-[var(--text-secondary)]">{t("thietYeu.nguonGiaiThich")}</span>
          </Notice>
          {!coQuyen && <Notice tone="muted" className="no-print">{t("thietYeu.chiXem")}</Notice>}

          <BangThietYeu
            key={`${tau.id}-${thang}`}
            vesselId={tau.id}
            maTau={tau.code}
            thang={thang}
            tenTau={tau.name}
            ngay={ngayBaoCao(thang)}
            dongGoc={dong}
            coQuyen={coQuyen}
            goDuoc={goDuoc}
          />

          <Card className="no-print">
            <CardHeader
              icon={<History className="size-4" />}
              title={t("thietYeu.lsTieuDe", { n: SO_THANG_THEO_DOI, tu: tenThang(lichSu.thang[0]), den: tenThang(thang) })}
              subtitle={t("thietYeu.lsMoTa")}
            />
            <TableWrap>
              <Table dense xuongDong>
                <thead>
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th className="min-w-48">{t("thietYeu.cot_moTa")}</Th>
                    <Th className="text-right">{t("thietYeu.cot_toiThieu")}</Th>
                    {lichSu.thang.map((th, i) => (
                      <Th key={th} className="text-right">
                        {tenThang(th)}
                        <span className="block font-normal normal-case tracking-normal text-[var(--text-muted)]">
                          {t("thietYeu.lsDaLuu", { n: lichSu.daLuu[i], tong: lichSu.muc.length })}
                        </span>
                      </Th>
                    ))}
                    <Th className="whitespace-normal text-right">{t("thietYeu.ls_thangThieu")}</Th>
                    <Th className="whitespace-normal text-right">{t("thietYeu.ls_tieuThu")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {gomNhom(lichSu.muc).map((g) => (
                    <Fragment key={g.nhom}>
                      <TrNhom colSpan={5 + lichSu.thang.length}>{g.nhom}</TrNhom>
                      {g.dong.map((m) => (
                        <Tr key={m.id}>
                          <Td className="tabular text-[var(--text-muted)]">{m.stt}</Td>
                          <Td className="min-w-48">{m.moTa}</Td>
                          <Td className="whitespace-nowrap text-right">{m.toiThieu}</Td>
                          {m.hienCo.map((h, i) => {
                            const thieu = laThieu({ toiThieuSo: m.toiThieuSo, hienCo: h });
                            return (
                              <Td key={i} className={`tabular text-right ${h === null ? "text-[var(--text-muted)]" : thieu ? "bg-rose-500/10 font-semibold text-[var(--text-danger)]" : ""}`}>
                                {h === null ? "—" : soIn(h)}
                              </Td>
                            );
                          })}
                          <Td className={`tabular text-right ${m.soThangThieu ? "font-semibold text-[var(--text-danger)]" : "text-[var(--text-muted)]"}`}>{m.soThangThieu || "–"}</Td>
                          <Td className="tabular text-right">{m.tieuThu ? soIn(m.tieuThu) : "–"}</Td>
                        </Tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          {coQuyen && (
            <details className="no-print surface rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">{t("thietYeu.nhapLai")}</summary>
              <div className="mt-3">
                <NhapThietYeuForm vesselId={tau.id} soMucHienCo={dong.length} thangHienTai={thangHienTai} />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
