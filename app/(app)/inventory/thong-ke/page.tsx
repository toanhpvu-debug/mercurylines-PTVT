import Form from "next/form";
import Link from "next/link";
import { BarChart3, Download, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { chonDuocTau, requireScopedUser, trongPhamVi, vesselIdWhere, vesselScopeDayDu } from "@/lib/auth";
import { QUY_LA_MA, mocQuy, quyCua } from "@/lib/kyQuy";
import { cacQuyThongKe, canhBaoThongKe, thongKeNhieuQuy } from "@/lib/tonKhoQuy";
import { taiDuLieuTonKy } from "@/lib/tonKhoQuyServer";
import { duongDanTheKho } from "@/lib/theKho";
import { layT } from "@/lib/i18n/server";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Stat, Table, TableWrap, Td, Th, Tr, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const TOI_DA_DONG = 500;
const BO_PHAN = ["ALL", "ENG", "DECK", "STORE"] as const;
const LOC = ["TAT_CA", "CO_DONG", "THIEU", "SAP_HET", "KHONG_DONG"] as const;
const SAP_XEP = ["TIEU_THU", "DU_DUNG", "TEN", "MA"] as const;

/**
 * THỐNG KÊ XUẤT NHẬP TỒN THEO QUÝ của một tàu: mỗi mặt hàng — nhận / tiêu thụ từng
 * quý, tổng, tiêu thụ trung bình một quý (quý đã hết), tồn hiện tại đủ dùng mấy quý;
 * lọc hàng dưới tối thiểu, sắp hết, nằm kho. Cùng cách tính với báo cáo theo quý
 * (lib/tonKhoQuy.ts thongKeNhieuQuy). Xuất Excel ở /api/export/thong-ke-ton.
 */
export default async function ThongKeTonPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; nam?: string; dept?: string; type?: string; q?: string; loc?: string; sx?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  const scope = vesselScopeDayDu(user);
  const sp = await searchParams;
  const vessels = await prisma.vessel.findMany({ where: vesselIdWhere(scope), orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const chonTay = Number(sp.vessel);
  const tau = (chonDuocTau(scope) && Number.isInteger(chonTay) && trongPhamVi(scope, chonTay) ? vessels.find((v) => v.id === chonTay) : null) ?? vessels[0] ?? null;
  const bayGio = new Date();
  const hienTai = quyCua(bayGio);
  const namChon = Number(sp.nam);
  const nam = Number.isInteger(namChon) && namChon >= 2000 && namChon <= hienTai.nam ? namChon : null;
  const dept = (BO_PHAN as readonly string[]).includes(String(sp.dept)) ? String(sp.dept) : "ALL";
  const loai = sp.type === "STORE" || sp.type === "SPARE" ? sp.type : "ALL";
  const q = String(sp.q ?? "").trim().toLowerCase();
  const loc = (LOC as readonly string[]).includes(String(sp.loc)) ? String(sp.loc) : "TAT_CA";
  const sx = (SAP_XEP as readonly string[]).includes(String(sp.sx)) ? String(sp.sx) : "TIEU_THU";
  const cacNam = Array.from({ length: 5 }, (_, i) => hienTai.nam - i);

  if (!tau) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("tonQuy.tkTieuDe")} subtitle={t("tonQuy.tkMoTa")} />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  const cacQuy = cacQuyThongKe(bayGio, nam);
  const du = await taiDuLieuTonKy({ vesselId: tau.id, boPhan: dept, loai, tuNgay: mocQuy(cacQuy[0]).batDau });
  const tk = thongKeNhieuQuy(du.tonHienTai, du.giaoDich, cacQuy, bayGio);
  const tatCa = tk
    .map((x) => ({ x, m: du.vatTu.get(x.materialId)! }))
    .filter(({ m }) => Boolean(m))
    .filter(({ m }) => !q || [m.nameVn, m.nameEn, m.code, m.impa, m.partNumber].some((v) => (v ?? "").toLowerCase().includes(q)));
  const locDong = tatCa.filter(({ x, m }) => {
    const n = canhBaoThongKe(x, m.minStock);
    if (loc === "THIEU") return n.thieu;
    if (loc === "SAP_HET") return n.sapHet;
    if (loc === "KHONG_DONG") return n.khongDong;
    if (loc === "CO_DONG") return x.tongNhan !== 0 || x.tongTieuThu !== 0;
    return true;
  });
  locDong.sort((a, b) => {
    if (sx === "TEN") return a.m.nameVn.localeCompare(b.m.nameVn, "vi");
    if (sx === "MA") return a.m.code.localeCompare(b.m.code);
    if (sx === "DU_DUNG") return (a.x.duDungQuy ?? Infinity) - (b.x.duDungQuy ?? Infinity) || b.x.tongTieuThu - a.x.tongTieuThu;
    return b.x.tongTieuThu - a.x.tongTieuThu || a.m.nameVn.localeCompare(b.m.nameVn, "vi");
  });
  const dong = locDong.slice(0, TOI_DA_DONG);
  // Thẻ từng quý: bao nhiêu mặt hàng có nhận / tiêu thụ / điều chỉnh, bao nhiêu lần.
  const theQuy = cacQuy.map((k, i) => {
    const qs = tatCa.map(({ x }) => x.theoQuy[i]);
    return {
      ten: `${QUY_LA_MA[k.quy - 1]}/${k.nam}`,
      dangChay: k.nam === hienTai.nam && k.quy === hienTai.quy,
      matNhan: qs.filter((s) => s.nhan !== 0).length,
      lanNhan: qs.reduce((s, x) => s + x.soLanNhan, 0),
      matTieu: qs.filter((s) => s.tieuThu !== 0).length,
      lanXuat: qs.reduce((s, x) => s + x.soLanXuat, 0),
      matDieuChinh: qs.filter((s) => s.dieuChinh !== 0).length,
    };
  });
  const so = (n: number) => String(Math.round(n * 1000) / 1000);
  const nhanBoPhan = (k: string) =>
    k === "ENG" ? t("inventory.bpMay") : k === "DECK" ? t("inventory.bpBoong") : k === "STORE" ? t("inventory.bpKhoTieuHao") : t("inventory.bpTatCa");
  const thamSoXuat = new URLSearchParams({ vessel: String(tau.id), dept, type: loai, ...(nam ? { nam: String(nam) } : {}), loc, sx, ...(q ? { q } : {}) });

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/inventory/bao-cao-quy?vessel=${tau.id}&dept=${dept}&type=${loai}`} className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("tonQuy.tieuDe")}
        </Link>
        <PageHeader title={t("tonQuy.tkTieuDe")} subtitle={t("tonQuy.tkMoTa")} />
      </div>

      <Card>
        <Form action="/inventory/thong-ke" className="flex flex-wrap items-end gap-3">
          {chonDuocTau(scope) ? (
            <Field label={t("tonQuy.tau")} className="w-60">
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
          <Field label={t("tonQuy.tkKy")} className="w-44">
            <Select name="nam" defaultValue={nam ?? ""}>
              <option value="">{t("tonQuy.tkBonQuyGanNhat")}</option>
              {cacNam.map((n) => (
                <option key={n} value={n}>
                  {t("tonQuy.tkNam", { nam: n })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("tonQuy.boPhan")} className="w-44">
            <Select name="dept" defaultValue={dept}>
              {BO_PHAN.map((k) => (
                <option key={k} value={k}>
                  {nhanBoPhan(k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("tonQuy.loai")} className="w-44">
            <Select name="type" defaultValue={loai}>
              <option value="ALL">{t("tonQuy.loaiTatCa")}</option>
              <option value="STORE">{t("tonQuy.loaiStore")}</option>
              <option value="SPARE">{t("tonQuy.loaiSpare")}</option>
            </Select>
          </Field>
          <Field label={t("tonQuy.tkLoc")} className="w-48">
            <Select name="loc" defaultValue={loc}>
              <option value="TAT_CA">{t("tonQuy.tkLocTatCa")}</option>
              <option value="CO_DONG">{t("tonQuy.tkLocCoDong")}</option>
              <option value="THIEU">{t("tonQuy.tkLocThieu")}</option>
              <option value="SAP_HET">{t("tonQuy.tkLocSapHet")}</option>
              <option value="KHONG_DONG">{t("tonQuy.tkLocKhongDong")}</option>
            </Select>
          </Field>
          <Field label={t("tonQuy.tkSapXep")} className="w-44">
            <Select name="sx" defaultValue={sx}>
              <option value="TIEU_THU">{t("tonQuy.tkSxTieuThu")}</option>
              <option value="DU_DUNG">{t("tonQuy.tkSxDuDung")}</option>
              <option value="TEN">{t("tonQuy.tkSxTen")}</option>
              <option value="MA">{t("tonQuy.tkSxMa")}</option>
            </Select>
          </Field>
          <Field label={t("tonQuy.timKiem")} className="w-52">
            <Input name="q" defaultValue={sp.q ?? ""} />
          </Field>
          <Button type="submit" variant="primary" icon={<FileText className="size-4" />}>
            {t("tonQuy.nutXem")}
          </Button>
          <a href={`/api/export/thong-ke-ton?${thamSoXuat}`} className={buttonClass("secondary")}>
            <Download className="size-4" />
            {t("tonQuy.tkNutXuatExcel")}
          </a>
        </Form>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{t("tonQuy.tkGoiYTb")}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {theQuy.map((x) => (
          <Stat
            key={x.ten}
            label={`${t("tonQuy.tkTheQuy", { quy: x.ten })}${x.dangChay ? ` · ${t("tonQuy.tkTheDangChay")}` : ""}`}
            value={x.matTieu}
            sub={`${t("tonQuy.tkTheTieu", { n: x.matTieu, lan: x.lanXuat })} · ${t("tonQuy.tkTheNhan", { n: x.matNhan, lan: x.lanNhan })}${
              x.matDieuChinh ? ` · ${t("tonQuy.tkTheDieuChinh", { n: x.matDieuChinh })}` : ""
            }`}
            tone={x.dangChay ? "info" : "brand"}
          />
        ))}
      </div>

      <Card>
        <p className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <BarChart3 className="size-4" />
          {t("tonQuy.tkTongDong", { n: locDong.length })}
        </p>
        {locDong.length > dong.length && (
          <Notice tone="warning" className="mb-2">
            {t("tonQuy.gioiHan", { n: dong.length, tong: locDong.length })}
          </Notice>
        )}
        {dong.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t("tonQuy.tkKhongCo")}</p>
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th rowSpan={2}>{t("tonQuy.cot_ma")}</Th>
                  <Th rowSpan={2}>{t("tonQuy.cot_moTa")}</Th>
                  <Th rowSpan={2}>{t("tonQuy.cot_dvt")}</Th>
                  <Th rowSpan={2} className="text-right">
                    {t("tonQuy.tkCot_min")}
                  </Th>
                  <Th rowSpan={2} className="text-right">
                    {t("tonQuy.tkCot_tonNay")}
                  </Th>
                  {theQuy.map((x) => (
                    <Th key={x.ten} colSpan={2} className="text-center">
                      {x.ten}
                    </Th>
                  ))}
                  <Th rowSpan={2} className="text-right">
                    {t("tonQuy.tkCot_tongNhan")}
                  </Th>
                  <Th rowSpan={2} className="text-right">
                    {t("tonQuy.tkCot_tongTieu")}
                  </Th>
                  <Th rowSpan={2} className="text-right">
                    {t("tonQuy.tkCot_tb")}
                  </Th>
                  <Th rowSpan={2} className="text-right">
                    {t("tonQuy.tkCot_duDung")}
                  </Th>
                </tr>
                <tr>
                  {theQuy.map((x) => (
                    <FragmentQuy key={x.ten} nhan={t("tonQuy.tkCot_nhan")} tieu={t("tonQuy.tkCot_tieu")} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {dong.map(({ x, m }) => {
                  const n = canhBaoThongKe(x, m.minStock);
                  const kho = du.khoChinh.get(m.id);
                  return (
                    <Tr key={m.id} className="align-top">
                      <Td className="whitespace-nowrap">
                        {kho ? (
                          <Link href={duongDanTheKho(m.id, kho)} className="font-display text-xs tracking-wide text-[var(--text-brand)] hover:underline">
                            {m.code}
                          </Link>
                        ) : (
                          <span className="font-display text-xs tracking-wide">{m.code}</span>
                        )}
                      </Td>
                      <Td>
                        <p className="font-medium text-[var(--text-primary)]">{m.nameVn}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <span className="text-xs text-[var(--text-muted)]">{m.nhom}</span>
                          {n.thieu && <Badge tone="danger">{t("tonQuy.tkBadgeThieu")}</Badge>}
                          {n.sapHet && <Badge tone="warning">{t("tonQuy.tkBadgeSapHet")}</Badge>}
                          {n.khongDong && <Badge tone="muted">{t("tonQuy.tkBadgeKhongDong")}</Badge>}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{m.uom}</Td>
                      <Td className="tabular text-right text-[var(--text-secondary)]">{m.minStock ? so(m.minStock) : ""}</Td>
                      <Td className="tabular text-right font-semibold">{so(x.tonHienTai)}</Td>
                      {x.theoQuy.map((s, i) => (
                        <OQuy key={i} nhan={s.nhan} tieu={s.tieuThu} so={so} />
                      ))}
                      <Td className="tabular text-right">{x.tongNhan ? so(x.tongNhan) : ""}</Td>
                      <Td className="tabular text-right">{x.tongTieuThu ? so(x.tongTieuThu) : ""}</Td>
                      <Td className="tabular text-right">{x.tbTieuThuQuy ? so(x.tbTieuThuQuy) : ""}</Td>
                      <Td className="tabular whitespace-nowrap text-right">{x.duDungQuy !== null ? t("tonQuy.tkDuDung", { n: so(x.duDungQuy) }) : ""}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <p className="mt-2 text-xs text-[var(--text-muted)]">{tTuDo("tonQuy.tkGoiYTb")}</p>
      </Card>
    </div>
  );
}

function FragmentQuy({ nhan, tieu }: { nhan: string; tieu: string }) {
  return (
    <>
      <Th className="text-right text-xs">{nhan}</Th>
      <Th className="text-right text-xs">{tieu}</Th>
    </>
  );
}

function OQuy({ nhan, tieu, so }: { nhan: number; tieu: number; so: (n: number) => string }) {
  return (
    <>
      <Td className="tabular text-right text-[var(--text-success)]">{nhan ? so(nhan) : ""}</Td>
      <Td className="tabular text-right text-[var(--text-warning)]">{tieu ? so(tieu) : ""}</Td>
    </>
  );
}
