"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus, Save, Trash2, UserPlus, Wand2 } from "lucide-react";
import { apDungVaoPo, luuBaoGia, taoNccTuBaoGia, taoPoTuBaoGia, xoaBaoGia, type LuuBaoGiaNhap } from "@/app/bao-gia-actions";
import { ghepVaoDonMua, tongBaoGia, type DongBaoGia } from "@/lib/baoGia";
import { docSo } from "@/lib/docSo";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

type Dong = { moTa: string; partNo: string; impa: string; donVi: string; soLuong: string; donGia: string; ghiChu: string; canhBao: string; boQua: boolean };
const sang = (d: DongBaoGia): Dong => ({
  moTa: d.moTa,
  partNo: d.partNo ?? "",
  impa: d.impa ?? "",
  donVi: d.donVi,
  soLuong: d.soLuong === null ? "" : String(d.soLuong),
  donGia: d.donGia === null ? "" : String(d.donGia),
  ghiChu: d.ghiChu ?? "",
  canhBao: d.canhBao ?? "",
  boQua: d.boQua,
});
const so = (s: string) => {
  const n = docSo(s.trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};
const O = "w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm";

export type DauBaoGiaSua = {
  supplierId: number | null;
  poId: number | null;
  soBaoGia: string;
  ngayBaoGia: string;
  tienTe: string;
  chietKhau: string;
  phiVanChuyen: string;
  phiGiaoHang: string;
};

/**
 * Trang xử lý một báo giá: sửa đầu báo giá và từng dòng (đọc sai thì sửa ngay),
 * xem trước dòng nào ghép vào dòng nào của PO, rồi áp giá vào PO nháp đã gắn
 * hoặc tạo PO nháp mới.
 */
export default function BangBaoGia({
  id,
  dau: dauGoc,
  dong: dongGoc,
  nhaCungCapDoc,
  suppliers,
  poNhap,
  poItems,
  coSua,
  laAdmin,
}: {
  id: number;
  dau: DauBaoGiaSua;
  dong: DongBaoGia[];
  nhaCungCapDoc: string | null;
  suppliers: { id: number; name: string }[];
  poNhap: { id: number; poNo: string }[];
  poItems: Record<number, { id: number; description: string; partNo: string | null }[]>;
  coSua: boolean;
  laAdmin: boolean;
}) {
  const { t } = useNgonNgu();
  const router = useRouter();
  const [dau, setDau] = useState(dauGoc);
  const [dong, setDong] = useState<Dong[]>(() => dongGoc.map(sang));
  const [themDongMoi, setThemDongMoi] = useState(true);
  const [capNhatSoLuong, setCapNhatSoLuong] = useState(false);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, startT] = useTransition();

  const dongSo = dong.map((d) => ({ ...d, sl: so(d.soLuong), dg: so(d.donGia) }));
  const tong = tongBaoGia(
    dongSo.map((d) => ({ soLuong: d.sl, donGia: d.dg, boQua: d.boQua })),
    so(dau.chietKhau) ?? 0,
    so(dau.phiVanChuyen) ?? 0,
    so(dau.phiGiaoHang) ?? 0
  );
  const itemsPo = useMemo(() => (dau.poId ? (poItems[dau.poId] ?? []) : []), [dau.poId, poItems]);
  const ghep = useMemo(() => {
    const dung = dong.map((d, i) => ({ d, i })).filter((x) => !x.d.boQua);
    const kq = ghepVaoDonMua(dung.map((x) => ({ moTa: x.d.moTa, partNo: x.d.partNo || null, impa: x.d.impa || null })), itemsPo);
    const theoDong = new Map<number, number | null>();
    dung.forEach((x, j) => theoDong.set(x.i, kq[j]));
    return theoDong;
  }, [dong, itemsPo]);
  const tien = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const doi = (i: number, patch: Partial<Dong>) => setDong((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const goiLen = (): LuuBaoGiaNhap => ({ ...dau, dong: dong.map((d) => ({ ...d, impa: d.impa, canhBao: d.canhBao })) });
  const chay = (fn: () => Promise<{ message: string; success?: boolean } | undefined>) =>
    startT(async () => {
      const r = await fn();
      if (!r) return; // đã chuyển trang (redirect)
      setThongBao({ ok: Boolean(r.success), chu: r.message });
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label={`${t("purchasing.nhaCungCap")} *`} hint={nhaCungCapDoc ? t("purchasing.nccDocDuoc", { ten: nhaCungCapDoc }) : undefined}>
          <Select value={dau.supplierId ?? ""} disabled={!coSua} onChange={(e) => setDau({ ...dau, supplierId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">— {t("purchasing.chonNcc")} —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {coSua && laAdmin && !dau.supplierId && nhaCungCapDoc && (
            <Button
              type="button"
              size="sm"
              className="mt-1"
              icon={<UserPlus className="size-4" />}
              onClick={() =>
                startT(async () => {
                  const r = await taoNccTuBaoGia(id, nhaCungCapDoc);
                  setThongBao({ ok: Boolean(r.success), chu: r.message });
                  if (r.success && r.supplierId) {
                    setDau((d) => ({ ...d, supplierId: r.supplierId! }));
                  }
                })
              }
            >
              {t("purchasing.themNccTheoTen")}
            </Button>
          )}
        </Field>
        <Field label={t("purchasing.soBaoGia")}>
          <Input value={dau.soBaoGia} disabled={!coSua} onChange={(e) => setDau({ ...dau, soBaoGia: e.target.value })} />
        </Field>
        <Field label={t("purchasing.ngayBaoGia")}>
          <Input type="date" value={dau.ngayBaoGia} disabled={!coSua} onChange={(e) => setDau({ ...dau, ngayBaoGia: e.target.value })} />
        </Field>
        <Field label={t("purchasing.tienTe")}>
          <Input value={dau.tienTe} disabled={!coSua} onChange={(e) => setDau({ ...dau, tienTe: e.target.value.toUpperCase() })} placeholder="USD" />
        </Field>
        <Field label={t("purchasing.ganVaoPo")}>
          <Select value={dau.poId ?? ""} disabled={!coSua} onChange={(e) => setDau({ ...dau, poId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t("purchasing.taoPoMoiSau")}</option>
            {poNhap.map((p) => (
              <option key={p.id} value={p.id}>
                {p.poNo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("purchasing.chietKhauPct")}>
          <Input value={dau.chietKhau} disabled={!coSua} onChange={(e) => setDau({ ...dau, chietKhau: e.target.value })} inputMode="decimal" />
        </Field>
        <Field label={t("purchasing.phiVanChuyen")}>
          <Input value={dau.phiVanChuyen} disabled={!coSua} onChange={(e) => setDau({ ...dau, phiVanChuyen: e.target.value })} inputMode="decimal" />
        </Field>
        <Field label={t("purchasing.phiGiaoHang")}>
          <Input value={dau.phiGiaoHang} disabled={!coSua} onChange={(e) => setDau({ ...dau, phiGiaoHang: e.target.value })} inputMode="decimal" />
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-secondary)]">
              <th className="p-1">#</th>
              <th className="p-1">{t("purchasing.cotMoTa")}</th>
              <th className="p-1">PN / IMPA</th>
              <th className="p-1">{t("purchasing.cotDvt")}</th>
              <th className="p-1 text-right">{t("purchasing.cotSoLuong")}</th>
              <th className="p-1 text-right">{t("purchasing.cotDonGia")}</th>
              <th className="p-1 text-right">{t("purchasing.cotThanhTien")}</th>
              {dau.poId && <th className="p-1">{t("purchasing.cotGhepPo")}</th>}
              <th className="p-1 text-center">{t("purchasing.cotBoQua")}</th>
            </tr>
          </thead>
          <tbody>
            {dongSo.map((d, i) => {
              const g = ghep.get(i);
              const it = g ? itemsPo.find((x) => x.id === g) : null;
              return (
                <tr key={i} className={`align-top ${d.boQua ? "opacity-50" : ""}`}>
                  <td className="p-1 text-xs text-[var(--text-muted)]">{i + 1}</td>
                  <td className="p-1">
                    <input className={O} value={d.moTa} disabled={!coSua} onChange={(e) => doi(i, { moTa: e.target.value })} />
                    {d.canhBao && <p className="mt-0.5 text-xs text-[var(--text-warning)]">⚠ {d.canhBao}</p>}
                    {d.ghiChu && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{d.ghiChu}</p>}
                  </td>
                  <td className="w-36 p-1">
                    <input className={O} value={d.partNo || d.impa} disabled={!coSua} onChange={(e) => doi(i, { partNo: e.target.value })} />
                  </td>
                  <td className="w-20 p-1">
                    <input className={O} value={d.donVi} disabled={!coSua} onChange={(e) => doi(i, { donVi: e.target.value })} />
                  </td>
                  <td className="w-24 p-1">
                    <input className={`${O} text-right ${d.soLuong && d.sl === null ? "border-rose-500" : ""}`} value={d.soLuong} disabled={!coSua} onChange={(e) => doi(i, { soLuong: e.target.value })} inputMode="decimal" />
                  </td>
                  <td className="w-28 p-1">
                    <input className={`${O} text-right ${d.donGia && d.dg === null ? "border-rose-500" : ""}`} value={d.donGia} disabled={!coSua} onChange={(e) => doi(i, { donGia: e.target.value })} inputMode="decimal" />
                  </td>
                  <td className="tabular w-28 p-1 text-right">{d.sl !== null && d.dg !== null ? tien(d.sl * d.dg) : ""}</td>
                  {dau.poId && (
                    <td className="w-48 p-1 text-xs">
                      {d.boQua ? "" : it ? <span className="text-[var(--text-success)]">✓ {it.description}</span> : <span className="text-[var(--text-warning)]">{t("purchasing.dongMoiChoPo")}</span>}
                    </td>
                  )}
                  <td className="p-1 text-center">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={d.boQua} disabled={!coSua} onChange={(e) => doi(i, { boQua: e.target.checked })} aria-label={`${t("purchasing.cotBoQua")} ${i + 1}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {coSua ? (
          <Button type="button" size="sm" icon={<Plus className="size-4" />} onClick={() => setDong((ds) => [...ds, { moTa: "", partNo: "", impa: "", donVi: "PCS", soLuong: "1", donGia: "", ghiChu: "", canhBao: "", boQua: false }])}>
            {t("purchasing.themDong")}
          </Button>
        ) : (
          <span />
        )}
        <p className="tabular text-sm text-[var(--text-secondary)]">
          {t("purchasing.tongBaoGia", { cong: tien(tong.cong), giam: tien(tong.giam) })} · <b className="text-[var(--text-primary)]">{tien(tong.tong)} {dau.tienTe || ""}</b>
        </p>
      </div>

      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}

      {coSua && (
        <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
          {dau.poId && (
            <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-brand-600" checked={themDongMoi} onChange={(e) => setThemDongMoi(e.target.checked)} />
                {t("purchasing.tuyChonThemDong")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-brand-600" checked={capNhatSoLuong} onChange={(e) => setCapNhatSoLuong(e.target.checked)} />
                {t("purchasing.tuyChonCapNhatSl")}
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {dau.poId ? (
              <Button
                type="button"
                variant="primary"
                loading={dang}
                icon={<Wand2 className="size-4" />}
                onClick={() => {
                  if (window.confirm(t("purchasing.xacNhanApBaoGia"))) chay(() => apDungVaoPo(id, goiLen(), { themDongMoi, capNhatSoLuong }));
                }}
              >
                {t("purchasing.nutApVaoPo", { po: poNhap.find((p) => p.id === dau.poId)?.poNo ?? "" })}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                loading={dang}
                icon={<FilePlus2 className="size-4" />}
                onClick={() => {
                  if (window.confirm(t("purchasing.xacNhanTaoPo"))) chay(() => taoPoTuBaoGia(id, goiLen()));
                }}
              >
                {t("purchasing.nutTaoPoTuBaoGia")}
              </Button>
            )}
            <Button type="button" disabled={dang} icon={<Save className="size-4" />} onClick={() => chay(() => luuBaoGia(id, goiLen()))}>
              {t("purchasing.luuBaoGia")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={dang}
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!window.confirm(t("purchasing.xacNhanXoaBaoGia"))) return;
                startT(async () => {
                  const r = await xoaBaoGia(id);
                  if (r.success) router.push("/purchasing/bao-gia");
                  else setThongBao({ ok: false, chu: r.message });
                });
              }}
            >
              {t("purchasing.xoaBaoGia")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
