"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { suaDonMua, type SuaDonMuaNhap } from "@/app/don-mua-actions";
import { tongDonMua } from "@/lib/donMuaQuyTrinh";
import { docSo } from "@/lib/docSo";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";

type Dong = { id?: number; description: string; partNo: string; uom: string; quantity: string; unitPrice: string; tuYeuCau: boolean };
export type DauDonSua = Omit<SuaDonMuaNhap, "items" | "discountPercent" | "transportFee" | "deliveryFee"> & {
  discountPercent: string;
  transportFee: string;
  deliveryFee: string;
};

const O = "w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm";
const so = (s: string) => {
  const n = docSo(s.trim() || "0");
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sửa đơn NHÁP ngay trên trang đơn mua. Dòng lấy từ yêu cầu vật tư giữ số lượng
 * đã duyệt cho mua (ô số lượng khóa) — sửa được mô tả, mã, đơn giá, hoặc bỏ.
 */
export default function SuaDonMuaForm({
  poId,
  dau: dauGoc,
  dong: dongGoc,
  suppliers,
}: {
  poId: number;
  dau: DauDonSua;
  dong: Dong[];
  suppliers: { id: number; name: string }[];
}) {
  const { t } = useNgonNgu();
  const [dau, setDau] = useState(dauGoc);
  const [dong, setDong] = useState<Dong[]>(dongGoc);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, startT] = useTransition();
  const tong = tongDonMua(
    dong.filter((d) => d.description.trim()).map((d) => ({ quantity: so(d.quantity), unitPrice: so(d.unitPrice) })),
    so(dau.discountPercent),
    so(dau.transportFee),
    so(dau.deliveryFee)
  );
  const doi = (i: number, patch: Partial<Dong>) => setDong((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const luu = () =>
    startT(async () => {
      const r = await suaDonMua(poId, { ...dau, supplierId: Number(dau.supplierId), items: dong.map(({ id, description, partNo, uom, quantity, unitPrice }) => ({ id, description, partNo, uom, quantity, unitPrice })) });
      setThongBao({ ok: Boolean(r.success), chu: r.message });
    });
  const tien = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("purchasing.nhaCungCap")}>
          <Select value={String(dau.supplierId)} onChange={(e) => setDau({ ...dau, supplierId: Number(e.target.value) })}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("purchasing.tienTe")}>
          <Input value={dau.currency} onChange={(e) => setDau({ ...dau, currency: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Y/ref">
          <Input value={dau.supplierRef} onChange={(e) => setDau({ ...dau, supplierRef: e.target.value })} placeholder={t("purchasing.yRefGoiY")} />
        </Field>
        <Field label={t("purchasing.tieuDeDon")}>
          <Input value={dau.subject} onChange={(e) => setDau({ ...dau, subject: e.target.value })} />
        </Field>
        <Field label={t("purchasing.ngayGiaoDuKien")}>
          <Input type="date" value={dau.expectedDate} onChange={(e) => setDau({ ...dau, expectedDate: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={t("purchasing.chietKhauPct")}>
            <Input value={dau.discountPercent} onChange={(e) => setDau({ ...dau, discountPercent: e.target.value })} inputMode="decimal" />
          </Field>
          <Field label={t("purchasing.phiVanChuyen")}>
            <Input value={dau.transportFee} onChange={(e) => setDau({ ...dau, transportFee: e.target.value })} inputMode="decimal" />
          </Field>
          <Field label={t("purchasing.phiGiaoHang")}>
            <Input value={dau.deliveryFee} onChange={(e) => setDau({ ...dau, deliveryFee: e.target.value })} inputMode="decimal" />
          </Field>
        </div>
      </div>
      <Field label={t("purchasing.ghiChuDon")}>
        <Textarea rows={2} value={dau.notes} onChange={(e) => setDau({ ...dau, notes: e.target.value })} />
      </Field>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-secondary)]">
              <th className="p-1">#</th>
              <th className="p-1">{t("purchasing.cotMoTa")}</th>
              <th className="p-1">PN</th>
              <th className="p-1">{t("purchasing.cotDvt")}</th>
              <th className="p-1 text-right">{t("purchasing.cotSoLuong")}</th>
              <th className="p-1 text-right">{t("purchasing.cotDonGia")}</th>
              <th className="p-1 text-right">{t("purchasing.cotThanhTien")}</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {dong.map((d, i) => (
              <tr key={i} className="align-top">
                <td className="p-1 text-xs text-[var(--text-muted)]">{i + 1}</td>
                <td className="p-1">
                  <input className={O} value={d.description} onChange={(e) => doi(i, { description: e.target.value })} />
                  {d.tuYeuCau && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("purchasing.dongTuYeuCau")}</p>}
                </td>
                <td className="w-32 p-1">
                  <input className={O} value={d.partNo} onChange={(e) => doi(i, { partNo: e.target.value })} />
                </td>
                <td className="w-20 p-1">
                  <input className={O} value={d.uom} onChange={(e) => doi(i, { uom: e.target.value })} />
                </td>
                <td className="w-24 p-1">
                  <input className={`${O} text-right`} value={d.quantity} disabled={d.tuYeuCau} onChange={(e) => doi(i, { quantity: e.target.value })} inputMode="decimal" />
                </td>
                <td className="w-28 p-1">
                  <input className={`${O} text-right`} value={d.unitPrice} onChange={(e) => doi(i, { unitPrice: e.target.value })} inputMode="decimal" />
                </td>
                <td className="tabular w-28 p-1 text-right">{tien(so(d.quantity) * so(d.unitPrice))}</td>
                <td className="p-1">
                  <button type="button" onClick={() => setDong((ds) => ds.filter((_, j) => j !== i))} title={t("purchasing.boDong")} aria-label={t("purchasing.boDong")} className="rounded p-1 text-[var(--text-danger)] hover:bg-rose-500/10">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" icon={<Plus className="size-4" />} onClick={() => setDong((ds) => [...ds, { description: "", partNo: "", uom: "PCS", quantity: "1", unitPrice: "", tuYeuCau: false }])}>
          {t("purchasing.themDong")}
        </Button>
        <p className="tabular text-sm text-[var(--text-secondary)]">
          {t("purchasing.tongCong")}: <b className="text-[var(--text-primary)]">{tien(tong.tong)} {dau.currency}</b>
        </p>
      </div>
      <Button type="button" variant="primary" loading={dang} icon={<Save className="size-4" />} onClick={luu}>
        {t("purchasing.luuDon")}
      </Button>
      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}
    </div>
  );
}
