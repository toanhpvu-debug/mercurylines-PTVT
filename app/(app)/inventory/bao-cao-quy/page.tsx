import Form from "next/form";
import Link from "next/link";
import { BarChart3, ClipboardCheck, Download, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { chonDuocTau, requireScopedUser, trongPhamVi, vesselIdWhere, vesselScopeDayDu } from "@/lib/auth";
import { QUY_LA_MA, docKyQuy, mocQuy, ngayCuaVN, quyCua } from "@/lib/kyQuy";
import { soLieuKyVatTu, tenKyThang, thangCuaQuy } from "@/lib/tonKhoQuy";
import { soHieuHang, taiDuLieuTonKy } from "@/lib/tonKhoQuyServer";
import { duongDanTheKho } from "@/lib/theKho";
import { layT } from "@/lib/i18n/server";
import LogoBieuMau from "@/components/LogoBieuMau";
import PrintButton from "@/components/PrintButton";
import { Button, Card, Field, Input, Notice, PageHeader, Select, Stat, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Dòng hiện tối đa trên trang (bảng MLS-11-06 của cả tàu có thể vài trăm dòng; Excel xuất đủ). */
const TOI_DA_DONG = 600;
const BO_PHAN = ["ALL", "ENG", "DECK", "STORE"] as const;

/**
 * TỒN KHO VẬT TƯ & PHỤ TÙNG THEO QUÝ — bốn cột của biểu mẫu MLS-11-06 (Còn tồn đợt
 * trước · Nhận trong kỳ · Tiêu thụ trong kỳ · Tồn trên tàu) cho một tàu, một quý,
 * tính từ lịch sử nhập / xuất (lib/tonKhoQuy.ts). Cùng số với file Excel MLS-11-06
 * (/api/export/inventory?quy=&nam=) và với kiểm kê theo file theo kỳ. In được.
 */
export default async function BaoCaoTonQuyPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; quy?: string; nam?: string; dept?: string; type?: string; q?: string; dong?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const sp = await searchParams;
  const vessels = await prisma.vessel.findMany({ where: vesselIdWhere(scope), orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const chonTay = Number(sp.vessel);
  const tau = (chonDuocTau(scope) && Number.isInteger(chonTay) && trongPhamVi(scope, chonTay) ? vessels.find((v) => v.id === chonTay) : null) ?? vessels[0] ?? null;
  const bayGio = new Date();
  const ky = docKyQuy(sp.nam, sp.quy, bayGio);
  const moc = mocQuy(ky);
  const dept = (BO_PHAN as readonly string[]).includes(String(sp.dept)) ? String(sp.dept) : "ALL";
  const loai = sp.type === "STORE" || sp.type === "SPARE" ? sp.type : "ALL";
  const q = String(sp.q ?? "").trim().toLowerCase();
  const chiCoDong = sp.dong === "1";
  const hienTai = quyCua(bayGio);
  const cacNam = Array.from({ length: 5 }, (_, i) => hienTai.nam - i);

  if (!tau) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("tonQuy.tieuDe")} subtitle={t("tonQuy.moTa")} />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  const du = await taiDuLieuTonKy({ vesselId: tau.id, boPhan: dept, loai, tuNgay: moc.batDau });
  const soLieu = soLieuKyVatTu(du.tonHienTai, du.giaoDich, moc);
  const tatCa = soLieu
    .map((s) => ({ s, m: du.vatTu.get(s.materialId)! }))
    .filter(({ m }) => Boolean(m))
    .filter(({ m }) => !q || [m.nameVn, m.nameEn, m.code, m.impa, m.partNumber].some((x) => (x ?? "").toLowerCase().includes(q)))
    .filter(({ s }) => !chiCoDong || s.cot.nhan !== 0 || s.cot.tieuThu !== 0 || s.cot.dieuChinh !== 0)
    .sort((a, b) => a.m.nhom.localeCompare(b.m.nhom, "vi") || a.m.nameVn.localeCompare(b.m.nameVn, "vi"));
  const dong = tatCa.slice(0, TOI_DA_DONG);
  const coNhan = tatCa.filter(({ s }) => s.cot.nhan !== 0).length;
  const coTieu = tatCa.filter(({ s }) => s.cot.tieuThu !== 0).length;
  const coDieuChinh = tatCa.filter(({ s }) => s.cot.dieuChinh !== 0).length;
  const thang = thangCuaQuy(ky);
  const cuoiQuy = new Date(Math.min(moc.ketThuc.getTime() - 1, bayGio.getTime()));
  const so = (n: number) => String(Math.round(n * 1000) / 1000);
  const thamSoXuat = new URLSearchParams({ vessel: String(tau.id), quy: String(ky.quy), nam: String(ky.nam), dept, type: loai });
  const nhanBoPhan = (k: string) =>
    k === "ENG" ? t("inventory.bpMay") : k === "DECK" ? t("inventory.bpBoong") : k === "STORE" ? t("inventory.bpKhoTieuHao") : t("inventory.bpTatCa");
  const nhanLoai = loai === "STORE" ? t("tonQuy.loaiStore") : loai === "SPARE" ? t("tonQuy.loaiSpare") : t("tonQuy.loaiTatCa");
  const vn = ngayCuaVN(cuoiQuy);

  return (
    <div className="space-y-5">
      <div className="no-print">
        <Link href={`/inventory?vessel=${tau.id}`} className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("menu.tonKho")}
        </Link>
        <PageHeader
          title={t("tonQuy.tieuDe")}
          subtitle={t("tonQuy.moTa")}
          action={
            <>
              <Link href={`/inventory/thong-ke?vessel=${tau.id}&dept=${dept}&type=${loai}`} className={buttonClass("secondary")}>
                <BarChart3 className="size-4" />
                {t("tonQuy.nutThongKe")}
              </Link>
              <Link href="/inventory/kiem-ke" className={buttonClass("secondary")}>
                <ClipboardCheck className="size-4" />
                {t("tonQuy.nutKiemKe")}
              </Link>
            </>
          }
        />
      </div>

      <Card className="no-print">
        <Form action="/inventory/bao-cao-quy" className="flex flex-wrap items-end gap-3">
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
          <Field label={t("tonQuy.quy")} className="w-24">
            <Select name="quy" defaultValue={ky.quy}>
              {QUY_LA_MA.map((r, i) => (
                <option key={r} value={i + 1}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("tonQuy.nam")} className="w-28">
            <Select name="nam" defaultValue={ky.nam}>
              {cacNam.map((n) => (
                <option key={n} value={n}>
                  {n}
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
          <Field label={t("tonQuy.loai")} className="w-48">
            <Select name="type" defaultValue={loai}>
              <option value="ALL">{t("tonQuy.loaiTatCa")}</option>
              <option value="STORE">{t("tonQuy.loaiStore")}</option>
              <option value="SPARE">{t("tonQuy.loaiSpare")}</option>
            </Select>
          </Field>
          <Field label={t("tonQuy.timKiem")} className="w-56">
            <Input name="q" defaultValue={sp.q ?? ""} />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" name="dong" value="1" defaultChecked={chiCoDong} className="size-4 accent-brand-600" />
            {t("tonQuy.chiCoDong")}
          </label>
          <Button type="submit" variant="primary" icon={<FileText className="size-4" />}>
            {t("tonQuy.nutXem")}
          </Button>
          <a href={`/api/export/inventory?${thamSoXuat}`} className={buttonClass("secondary")}>
            <Download className="size-4" />
            {t("tonQuy.nutXuatExcel")}
          </a>
          <PrintButton label={t("tonQuy.nutIn")} />
        </Form>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {t("tonQuy.kyMoTa", { quy: `${QUY_LA_MA[ky.quy - 1]}/${ky.nam}`, tu: ngay(moc.batDau), den: ngay(new Date(moc.ketThuc.getTime() - 1)) })}
        </p>
      </Card>

      <div className="no-print grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("tonQuy.soMatHang")} value={tatCa.length} tone="brand" />
        <Stat label={t("tonQuy.coNhan")} value={coNhan} tone="success" />
        <Stat label={t("tonQuy.coTieuThu")} value={coTieu} tone="info" />
        <Stat label={t("tonQuy.coDieuChinh")} value={coDieuChinh} tone={coDieuChinh ? "warning" : "muted"} />
      </div>
      {coDieuChinh > 0 && (
        <Notice tone="info" className="no-print">
          {t("tonQuy.dieuChinhGoiY", { n: coDieuChinh })}
        </Notice>
      )}
      {tatCa.length > dong.length && (
        <Notice tone="warning" className="no-print">
          {t("tonQuy.gioiHan", { n: dong.length, tong: tatCa.length })}
        </Notice>
      )}

      <div className="print-area surface rounded-xl border p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <table className="w-full border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="w-44 border border-black p-2 align-middle">
                <LogoBieuMau />
              </td>
              <td className="border border-black p-2 text-center">
                <p className="text-lg font-bold">{t("tonQuy.inTieuDe")}</p>
                <p className="font-bold">{t("tonQuy.inTieuDeVi")}</p>
                <p className="text-xs italic">Phù hợp: Bộ luật ISM 5.2, 6.1.3, 10.1</p>
              </td>
              <td className="w-44 border border-black p-2 text-right text-xs italic">
                <p>MLS-11-06</p>
                <p>Ngày ban hành: 10/01/2024</p>
                <p>Soát xét:</p>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="font-semibold">{t("tonQuy.inTau")}</span> {tau.name}
          </p>
          <p className="text-right">
            <span className="font-semibold">{t("tonQuy.inNgay")}</span> {`${String(vn.ngay).padStart(2, "0")}/${String(vn.thang).padStart(2, "0")}/${vn.nam}`}
          </p>
          <p>
            <span className="font-semibold">{t("tonQuy.inBoPhan")}</span> {dept === "ALL" ? nhanLoai : `${nhanBoPhan(dept)} · ${nhanLoai}`}
          </p>
          <p className="text-right">
            <span className="font-semibold">{t("tonQuy.inKy")}</span> {tenKyThang(thang.tu, thang.den)}
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-2 border-black text-xs">
            <thead>
              <tr className="text-center">
                <th className="border border-black p-1">
                  S. No.
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_stt")}</span>
                </th>
                <th className="border border-black p-1">
                  Group
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_nhom")}</span>
                </th>
                <th className="border border-black p-1 no-print">{t("tonQuy.cot_ma")}</th>
                <th className="border border-black p-1">
                  Description
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_moTa")}</span>
                </th>
                <th className="border border-black p-1">
                  IMPA Code
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_soHieu")}</span>
                </th>
                <th className="border border-black p-1">
                  Unit
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_dvt")}</span>
                </th>
                <th className="border border-black p-1">
                  Last R.O.B
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_tonDau")}</span>
                </th>
                <th className="border border-black p-1">
                  Receive
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_nhan")}</span>
                </th>
                <th className="border border-black p-1">
                  Cons.
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_tieuThu")}</span>
                </th>
                <th className="border border-black p-1">
                  R.O.B
                  <br />
                  <span className="font-normal italic">{t("tonQuy.cot_tonCuoi")}</span>
                </th>
                <th className="border border-black p-1 no-print">{t("tonQuy.cot_dieuChinh")}</th>
              </tr>
            </thead>
            <tbody>
              {dong.length === 0 && (
                <tr>
                  <td colSpan={11} className="border border-black p-3 text-center text-[var(--text-muted)]">
                    {t("tonQuy.khongCo")}
                  </td>
                </tr>
              )}
              {dong.map(({ s, m }, i) => {
                const kho = du.khoChinh.get(m.id);
                return (
                  <tr key={m.id} className="align-top">
                    <td className="tabular border border-black px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="border border-black px-1 py-0.5">{m.nhom}</td>
                    <td className="border border-black px-1 py-0.5 whitespace-nowrap no-print">
                      {kho ? (
                        <Link href={duongDanTheKho(m.id, kho)} className="text-[var(--text-brand)] hover:underline">
                          {m.code}
                        </Link>
                      ) : (
                        m.code
                      )}
                    </td>
                    <td className="border border-black px-1 py-0.5">{m.nameVn}</td>
                    <td className="border border-black px-1 py-0.5">{soHieuHang(m)}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{m.uom}</td>
                    <td className="tabular border border-black px-1 py-0.5 text-right">{so(s.cot.tonDau)}</td>
                    <td className="tabular border border-black px-1 py-0.5 text-right">{so(s.cot.nhan)}</td>
                    <td className="tabular border border-black px-1 py-0.5 text-right">{so(s.cot.tieuThu)}</td>
                    <td className="tabular border border-black px-1 py-0.5 text-right font-semibold">{so(s.cot.tonCuoi)}</td>
                    <td className="tabular border border-black px-1 py-0.5 text-right text-[var(--text-muted)] no-print">
                      {s.cot.dieuChinh ? `${s.cot.dieuChinh > 0 ? "+" : ""}${so(s.cot.dieuChinh)}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2 text-center text-sm">
          <p className="font-semibold">{t("tonQuy.kyMay")}</p>
          <p className="font-semibold">{t("tonQuy.kySq")}</p>
          <p className="font-semibold">{t("tonQuy.kyPhong")}</p>
          <p className="font-semibold">{t("tonQuy.kyTt")}</p>
        </div>
      </div>
    </div>
  );
}
