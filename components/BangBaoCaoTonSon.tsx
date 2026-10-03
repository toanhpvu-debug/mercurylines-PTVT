"use client";

import { useMemo, useState, useTransition } from "react";
import { ClipboardCheck, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { apDungBaoCaoTon, docLaiPhieuSonAi, luuBaoCaoTon, xoaPhieuSon } from "@/app/son-phieu-actions";
import { keHoachBaoCaoTon, ngayCuoiQuy, tenKy, type ButToanBaoCao, type KeHoachBaoCaoTon } from "@/lib/baoCaoTonSon";
import type { DongNhanSon } from "@/lib/phieuSon";
import { nhanDangTenSon } from "@/lib/tenSon";
import { QUY_LA_MA, bonCotQuy, heThongQuy, mocQuy, type GiaoDichSonKy, type HeThongQuy, type KyQuy } from "@/lib/tonSon";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice, Select } from "@/components/ui";
import type { SonLuaChon } from "@/components/BangNhanSon";

/*
 * Trang soát BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14 tải lên: mỗi dòng có bốn số của báo cáo
 * (sửa được), bốn số app đang ghi cho quý đó, và các dòng app SẼ GHI để quý đó khớp
 * báo cáo (lib/baoCaoTonSon.ts keHoachBaoCaoTon) — tính ngay trên máy từ lịch sử
 * nhập / xuất của tàu, đổi quý / đổi loại sơn là thấy lại. Máy chủ tính lại hết lúc
 * bấm Cập nhật (trong một giao dịch).
 */

type Dong = {
  ten: string;
  hang: string;
  mau: string;
  maMau: string;
  ma: string;
  dvt: string;
  tonDau: string;
  nhan: string;
  tieuThu: string;
  tonCuoi: string;
  dungTich: string;
  loaiSon: string;
  paintProductId: string;
  boQua: boolean;
  canhBao: string;
  ghiChu: string;
};
const chuSo = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const sang = (d: DongNhanSon): Dong => ({
  ten: d.ten,
  hang: d.hang ?? "",
  mau: d.mau ?? "",
  maMau: d.maMau ?? "",
  ma: d.ma ?? "",
  dvt: d.dvt ?? "",
  tonDau: chuSo(d.bc?.tonDau),
  nhan: chuSo(d.bc?.nhan),
  tieuThu: chuSo(d.bc?.tieuThu),
  tonCuoi: chuSo(d.soLuong),
  dungTich: chuSo(d.dungTich),
  loaiSon: d.loaiSon ?? "",
  paintProductId: d.paintProductId === null ? "" : String(d.paintProductId),
  boQua: d.boQua,
  canhBao: d.canhBao ?? "",
  ghiChu: d.ghiChu ?? "",
});
const dongTrong = (): Dong => ({ ten: "", hang: "", mau: "", maMau: "", ma: "", dvt: "", tonDau: "", nhan: "", tieuThu: "", tonCuoi: "", dungTich: "", loaiSon: "", paintProductId: "", boQua: false, canhBao: "", ghiChu: "" });
/** Như máy chủ (lib/phieuSon.ts sachDongNhanSon): trống = null, dấu phẩy là thập phân. */
const soO = (s: string) => {
  if (!s.trim()) return null;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const soSai = (s: string) => s.trim() !== "" && soO(s) === null;
const gonKhoa = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const khoaDong = (d: Dong) => (d.paintProductId ? `id:${d.paintProductId}` : `moi:${gonKhoa(d.ten)}|${gonKhoa(d.hang)}|${gonKhoa(d.mau)}|${gonKhoa(d.maMau)}`);
const HT_RONG: HeThongQuy = { hienTai: 0, dauKy: 0, nhan: 0, tieuThu: 0, dieuChinh: 0, nhanBc: 0, tieuThuBc: 0, cuoiBc: 0, cuoiKy: 0 };
/** Tên tàu so khớp: bỏ dấu chấm, gạch chéo, "M/V", hoa thường. */
const gonTau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\bM\/?V\b/g, "")
    .replace(/[^A-Z0-9]/g, "");

const O = "w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm disabled:opacity-60";
const O_SO = `${O} tabular text-right`;

export default function BangBaoCaoTonSon({
  id,
  dong: dongGoc,
  ky: kyGoc,
  son,
  coSua,
  docLaiAi,
  tenTau,
  tauTrenTep,
  tonHienTai,
  giaoDich,
  tenSanPham,
  kyDaCapNhat,
}: {
  id: number;
  dong: DongNhanSon[];
  /** Quý / năm đang lưu ("" nếu chưa đọc được). */
  ky: { quy: string; nam: string };
  son: SonLuaChon[];
  coSua: boolean;
  docLaiAi: boolean;
  tenTau: string;
  tauTrenTep: string | null;
  /** Tồn hiện tại của tàu theo loại sơn. */
  tonHienTai: Record<number, number>;
  /** Lịch sử nhập / xuất của tàu (ngày dạng ISO). */
  giaoDich: { productId: number; type: string; quantity: number; dieuChinh: boolean; occurredAt: string; cotBaoCao: string | null }[];
  tenSanPham: Record<number, { ten: string; uom: string }>;
  /** Ngày cuối quý (yyyy-mm-dd) của các báo cáo tồn KHÁC đã cập nhật cho tàu này. */
  kyDaCapNhat: string[];
}) {
  const { t, so, ngay } = useNgonNgu();
  const [dong, setDong] = useState<Dong[]>(() => (dongGoc.length ? dongGoc.map(sang) : coSua ? [dongTrong()] : []));
  const [ky, setKy] = useState(kyGoc);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  // "Bây giờ" lấy một lần lúc mở trang (render phải thuần): đủ để nhận ra quý chưa bắt đầu.
  const [bayGio] = useState(() => Date.now());
  const [dang, startT] = useTransition();
  const sonTheoId = useMemo(() => new Map(son.map((s) => [String(s.id), s])), [son]);
  const gdTheoLoai = useMemo(() => {
    const m = new Map<number, GiaoDichSonKy[]>();
    for (const g of giaoDich) {
      const x: GiaoDichSonKy = { ...g, occurredAt: new Date(g.occurredAt) };
      const ds = m.get(g.productId);
      if (ds) ds.push(x);
      else m.set(g.productId, [x]);
    }
    return m;
  }, [giaoDich]);

  const kyHop: KyQuy | null = (() => {
    const q = Number(ky.quy);
    const n = Number(ky.nam);
    return Number.isInteger(q) && q >= 1 && q <= 4 && Number.isInteger(n) && n >= 2000 && n <= 2100 ? { quy: q as KyQuy["quy"], nam: n } : null;
  })();
  const moc = kyHop ? mocQuy(kyHop) : null;
  const ngayBaoCao = kyHop ? ngayCuoiQuy(kyHop) : null;
  const tuongLai = moc ? moc.batDau.getTime() > bayGio : false;
  const quySau = ngayBaoCao ? kyDaCapNhat.filter((k) => k > ngayBaoCao).sort().pop() : undefined;
  const htCua = (pid: number | null): HeThongQuy => (pid && moc ? heThongQuy(tonHienTai[pid] ?? 0, gdTheoLoai.get(pid) ?? [], moc) : HT_RONG);

  // Gộp dòng cùng loại sơn như máy chủ sẽ gộp: kế hoạch tính trên tổng, hiện ở dòng đầu của nhóm.
  const nhom = useMemo(() => {
    const m = new Map<string, { dau: number; cac: number[] }>();
    dong.forEach((d, i) => {
      if (d.boQua || (!d.ten.trim() && !d.paintProductId)) return;
      const k = khoaDong(d);
      const g = m.get(k);
      if (g) g.cac.push(i);
      else m.set(k, { dau: i, cac: [i] });
    });
    return m;
  }, [dong]);
  const keHoach = new Map<number, { ht: HeThongQuy; kh: KeHoachBaoCaoTon | null; gopVao: number | null }>();
  for (const g of nhom.values()) {
    const d0 = dong[g.dau];
    const cong = (k: "tonDau" | "nhan" | "tieuThu" | "tonCuoi") => {
      const ds = g.cac.map((i) => soO(dong[i][k]));
      return ds.every((x) => x === null) ? null : ds.reduce<number>((s, x) => s + (x ?? 0), 0);
    };
    const tonCuoi = g.cac.some((i) => soO(dong[i].tonCuoi) === null) ? null : cong("tonCuoi");
    const ht = htCua(d0.paintProductId ? Number(d0.paintProductId) : null);
    const kh = tonCuoi !== null && moc ? keHoachBaoCaoTon({ tonDau: cong("tonDau"), nhan: cong("nhan"), tieuThu: cong("tieuThu"), tonCuoi }, ht) : null;
    keHoach.set(g.dau, { ht, kh, gopVao: null });
    for (const i of g.cac.slice(1)) keHoach.set(i, { ht, kh: null, gopVao: g.dau });
  }
  const cacNhom = [...nhom.values()].map((g) => keHoach.get(g.dau)!);
  const dem = {
    capNhat: cacNhom.filter((x) => x.kh).length,
    khop: cacNhom.filter((x) => x.kh?.khop).length,
    doi: cacNhom.filter((x) => x.kh && !x.kh.khop).length,
    moi: [...nhom.values()].filter((g) => !dong[g.dau].paintProductId).length,
    thieu: dong.filter((d) => !d.boQua && (d.ten.trim() || d.paintProductId) && soO(d.tonCuoi) === null).length,
    boQua: dong.filter((d) => d.boQua).length,
  };

  // Loại sơn tàu còn lúc hết quý mà báo cáo không ghi (báo cáo bỏ sót loại đã hết?).
  const daCoTrongBaoCao = new Set(dong.filter((d) => !d.boQua && d.paintProductId).map((d) => Number(d.paintProductId)));
  const thieuTrongBaoCao = !moc
    ? []
    : [...new Set<number>([...Object.keys(tonHienTai).map(Number), ...gdTheoLoai.keys()])]
        .filter((pid) => !daCoTrongBaoCao.has(pid))
        .map((pid) => ({ pid, ht: heThongQuy(tonHienTai[pid] ?? 0, gdTheoLoai.get(pid) ?? [], moc) }))
        .filter((x) => x.ht.cuoiKy > 0.0005)
        .sort((a, b) => (tenSanPham[a.pid]?.ten ?? "").localeCompare(tenSanPham[b.pid]?.ten ?? "", "vi"));

  const doi = (i: number, patch: Partial<Dong>) => setDong((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  // Điền Tồn cuối kỳ cho dòng đang bỏ tick vì thiếu số → tick lại luôn.
  const doiTonCuoi = (i: number, v: string) =>
    setDong((ds) => ds.map((d, j) => (j !== i ? d : { ...d, tonCuoi: v, ...(d.boQua && soO(d.tonCuoi) === null && soO(v) !== null ? { boQua: false } : {}) })));
  const goiLen = () =>
    dong.map((d) => ({
      ten: d.ten,
      hang: d.hang,
      mau: d.mau,
      maMau: d.maMau,
      ma: d.ma,
      dvt: d.dvt,
      soLuong: d.tonCuoi,
      dungTich: d.dungTich,
      loaiSon: d.loaiSon,
      paintProductId: d.paintProductId,
      boQua: d.boQua,
      canhBao: d.canhBao || null,
      ghiChu: d.ghiChu,
      bc: { tonDau: d.tonDau, nhan: d.nhan, tieuThu: d.tieuThu },
    }));
  const chay = (fn: () => Promise<{ message: string; success?: boolean } | undefined>) =>
    startT(async () => {
      const r = await fn();
      if (!r) return; // đã chuyển trang (redirect)
      setThongBao({ ok: Boolean(r.success), chu: r.message });
    });
  const capNhat = () => {
    if (!kyHop) {
      setThongBao({ ok: false, chu: t("paint.btLoiKy") });
      return;
    }
    const ngayIn = ngay(new Date(`${ngayCuoiQuy(kyHop)}T12:00:00`));
    if (window.confirm(t("paint.btXacNhan", { quy: tenKy(kyHop), n: dem.capNhat, ngay: ngayIn }))) chay(() => apDungBaoCaoTon(id, goiLen(), ky));
  };
  const chuButToan = (b: ButToanBaoCao) => {
    switch (b.cot) {
      case "tonDau":
        return t("paint.btGhiDau", { truoc: so(b.truoc), sau: so(b.sau) });
      case "nhan":
        return b.loai === "NHAN" ? t("paint.btGhiNhan", { so: so(b.so) }) : t("paint.btGhiBotNhan", { so: so(-b.so) });
      case "tieuThu":
        return b.loai === "TIEU_THU" ? t("paint.btGhiTieu", { so: so(b.so) }) : t("paint.btGhiBotTieu", { so: so(b.so) });
      case "tonCuoi":
        return b.loai === "TIEU_THU" ? t("paint.btGhiTieuCuoi", { so: so(b.so) }) : t("paint.btGhiCuoi", { truoc: so(b.truoc), sau: so(b.sau) });
    }
  };
  const moTaSeTao = (d: Dong) => {
    const n = nhanDangTenSon(d.ten);
    const dungTich = d.dungTich.trim() || (n.dungTich ? String(n.dungTich) : "");
    return [n.ten, d.hang.trim() || n.hang, d.maMau.trim() || n.maMau, d.mau.trim() || n.mau, dungTich ? `${dungTich} L` : null].filter(Boolean).join(" · ");
  };
  const tauKhac = tauTrenTep && gonTau(tauTrenTep) && !gonTau(tenTau).includes(gonTau(tauTrenTep)) && !gonTau(tauTrenTep).includes(gonTau(tenTau));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("paint.bcQuy")}>
          <Select value={ky.quy} disabled={!coSua} onChange={(e) => setKy({ ...ky, quy: e.target.value })} className="w-24">
            <option value="">—</option>
            {QUY_LA_MA.map((q, i) => (
              <option key={q} value={String(i + 1)}>
                {q}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("paint.bcNam")}>
          <Input type="number" min={2000} max={2100} value={ky.nam} disabled={!coSua} onChange={(e) => setKy({ ...ky, nam: e.target.value })} className="w-28" />
        </Field>
        {kyHop && ngayBaoCao && (
          <p className="min-w-64 flex-1 pb-2 text-sm text-[var(--text-secondary)]">
            {t("paint.btMoTa", { quy: tenKy(kyHop), ngay: ngay(new Date(`${ngayBaoCao}T12:00:00`)) })}
          </p>
        )}
      </div>
      {!kyHop && <Notice tone="warning">{t("paint.btChuaChonKy")}</Notice>}
      {kyHop && tuongLai && <Notice tone="danger">{t("paint.btKyTuongLai", { quy: tenKy(kyHop) })}</Notice>}
      {coSua && quySau && <Notice tone="danger">{t("paint.btCoBaoCaoSau", { quy: tenKy({ nam: Number(quySau.slice(0, 4)), quy: Math.ceil(Number(quySau.slice(5, 7)) / 3) as KyQuy["quy"] }) })}</Notice>}
      {tauKhac && <Notice tone="warning">{t("paint.btTauKhac", { tren: tauTrenTep!, tau: tenTau })}</Notice>}

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="brand">{t("paint.btDemCapNhat", { n: dem.capNhat })}</Badge>
        {dem.khop > 0 && <Badge tone="success">{t("paint.btDemKhop", { n: dem.khop })}</Badge>}
        {dem.doi > 0 && <Badge tone="info">{t("paint.btDemDoi", { n: dem.doi })}</Badge>}
        {dem.moi > 0 && <Badge tone="info">{t("paint.pgDemMoi", { n: dem.moi })}</Badge>}
        {dem.thieu > 0 && <Badge tone="warning">{t("paint.btDemThieu", { n: dem.thieu })}</Badge>}
        {dem.boQua > 0 && <Badge tone="muted">{t("paint.pgDemBoQua", { n: dem.boQua })}</Badge>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1380px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-secondary)]">
              <th className="p-1" rowSpan={2}>
                #
              </th>
              <th className="p-1" rowSpan={2}>
                {t("paint.btCotCapNhat")}
              </th>
              <th className="p-1" rowSpan={2}>
                {t("paint.btCotTen")}
              </th>
              <th className="p-1" rowSpan={2}>
                {t("paint.pgCotLoai")}
              </th>
              <th className="p-1" rowSpan={2}>
                {t("paint.pgCotDvt")}
              </th>
              <th className="border-b border-[var(--border-subtle)] p-1 text-center" colSpan={4}>
                {t("paint.btNhomBaoCao")}
              </th>
              <th className="border-b border-[var(--border-subtle)] p-1 text-center" colSpan={4}>
                {t("paint.btNhomApp")}
              </th>
              <th className="p-1" rowSpan={2}>
                {t("paint.btSeGhi")}
              </th>
              <th className="p-1 text-right" rowSpan={2}>
                {t("paint.btTonNay")}
              </th>
              {coSua && <th className="p-1" rowSpan={2} />}
            </tr>
            <tr className="text-right text-xs text-[var(--text-secondary)]">
              {[0, 1].map((k) => (
                <Cot4 key={k} t={t} />
              ))}
            </tr>
          </thead>
          <tbody>
            {dong.map((d, i) => {
              const sp = d.paintProductId ? sonTheoId.get(d.paintProductId) : undefined;
              const moi = !d.paintProductId;
              const k = keHoach.get(i);
              const htHien = k?.ht ?? htCua(d.paintProductId ? Number(d.paintProductId) : null);
              // Số app như tờ in quý (điều chỉnh đã gộp vào Nhận / Tồn đầu kỳ) — đúng số kế hoạch đem so.
              const app = bonCotQuy(htHien, false);
              const soApp = [app.tonDau, app.nhan, app.tieuThu, htHien.cuoiKy];
              return (
                <tr key={i} className={`border-t border-[var(--border-subtle)] align-top ${d.boQua ? "opacity-50" : ""}`}>
                  <td className="p-1 text-xs text-[var(--text-muted)]">{i + 1}</td>
                  <td className="p-1">
                    <input type="checkbox" className="mt-2 size-4 accent-brand-600" checked={!d.boQua} disabled={!coSua} onChange={(e) => doi(i, { boQua: !e.target.checked })} aria-label={t("paint.btCotCapNhat")} />
                  </td>
                  <td className="w-72 p-1">
                    <input className={O} value={d.ten} disabled={!coSua} onChange={(e) => doi(i, { ten: e.target.value })} aria-label={t("paint.btCotTen")} />
                    {moi && d.ten.trim() && <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{t("paint.pgSeTao", { mo: moTaSeTao(d) })}</span>}
                    {d.ghiChu && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{d.ghiChu}</span>}
                    {d.canhBao && <span className="mt-0.5 block text-xs text-[var(--text-warning)]">{d.canhBao}</span>}
                  </td>
                  <td className="w-64 p-1">
                    <select className={O} value={d.paintProductId} disabled={!coSua} onChange={(e) => doi(i, { paintProductId: e.target.value })} aria-label={t("paint.pgCotLoai")}>
                      <option value="">{t("paint.pgTaoMoi")}</option>
                      {son.map((s) => (
                        <option key={s.id} value={s.id}>
                          {`${s.code} — ${s.label}`}
                        </option>
                      ))}
                    </select>
                    {sp && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{t("paint.pgDonViDanhMuc", { dvt: sp.uom })}</span>}
                  </td>
                  <td className="w-20 p-1">
                    <input className={O} value={d.dvt} disabled={!coSua || !moi} onChange={(e) => doi(i, { dvt: e.target.value })} aria-label={t("paint.pgCotDvt")} />
                  </td>
                  {(["tonDau", "nhan", "tieuThu"] as const).map((c) => (
                    <td key={c} className="w-20 p-1">
                      <input className={`${O_SO} ${soSai(d[c]) ? "border-[var(--text-warning)]" : ""}`} value={d[c]} disabled={!coSua} inputMode="decimal" onChange={(e) => doi(i, { [c]: e.target.value })} />
                    </td>
                  ))}
                  <td className="w-20 p-1">
                    <input
                      className={`${O_SO} font-semibold ${soSai(d.tonCuoi) || (!d.boQua && !d.tonCuoi.trim()) ? "border-[var(--text-warning)]" : ""}`}
                      value={d.tonCuoi}
                      disabled={!coSua}
                      inputMode="decimal"
                      onChange={(e) => doiTonCuoi(i, e.target.value)}
                      aria-label={t("paint.btCuoi")}
                    />
                  </td>
                  {soApp.map((x, c) => (
                    <td key={c} className="tabular w-16 p-1 pt-2 text-right text-[var(--text-secondary)]">
                      {moi || !moc ? "—" : so(x)}
                    </td>
                  ))}
                  <td className="w-56 p-1 pt-2 text-xs">
                    {d.boQua ? null : k?.gopVao !== null && k?.gopVao !== undefined ? (
                      <span className="text-[var(--text-muted)]">↑ {k.gopVao + 1}</span>
                    ) : !k?.kh ? (
                      <span className="text-[var(--text-warning)]">{soO(d.tonCuoi) === null ? t("paint.btThieuCuoi") : "—"}</span>
                    ) : k.kh.khop ? (
                      <span className="text-[var(--text-success)]">{t("paint.btKhop")}</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {k.kh.buToan.map((b, j) => (
                          <li key={j}>{chuButToan(b)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="tabular w-28 p-1 pt-2 text-right whitespace-nowrap">
                    {k?.kh && !k.kh.khop ? (
                      <>
                        {so(k.ht.hienTai)} → <span className={k.kh.hienTaiMoi < 0 ? "font-semibold text-[var(--text-danger)]" : "font-semibold"}>{so(k.kh.hienTaiMoi)}</span>
                      </>
                    ) : (
                      so(htHien.hienTai)
                    )}
                  </td>
                  {coSua && (
                    <td className="p-1">
                      <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setDong((ds) => ds.filter((_, j) => j !== i))} aria-label={t("requests.xoaDong")} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {coSua && thieuTrongBaoCao.length > 0 && (
        <Notice tone="info">
          <p>{t("paint.btThieuTrongBaoCao", { n: thieuTrongBaoCao.length })}</p>
          <ul className="mt-1.5 space-y-1">
            {thieuTrongBaoCao.map(({ pid, ht }) => (
              <li key={pid} className="flex flex-wrap items-center gap-2">
                <span>
                  {tenSanPham[pid]?.ten ?? `#${pid}`} — {so(ht.cuoiKy)} {tenSanPham[pid]?.uom ?? ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  icon={<Plus className="size-4" />}
                  onClick={() =>
                    setDong((ds) => [...ds, { ...dongTrong(), ten: tenSanPham[pid]?.ten ?? "", dvt: tenSanPham[pid]?.uom ?? "", paintProductId: String(pid), tonCuoi: "0", ghiChu: t("paint.btGhiChuThem0") }])
                  }
                >
                  {t("paint.btThemDong0")}
                </Button>
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {coSua && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" icon={<Plus className="size-4" />} onClick={() => setDong((ds) => [...ds, dongTrong()])}>
            {t("paint.pgThemDong")}
          </Button>
          <span className="flex-1" />
          {docLaiAi && (
            <Button type="button" disabled={dang} icon={<Sparkles className="size-4" />} onClick={() => chay(() => docLaiPhieuSonAi(id))}>
              {t("paint.pgDocLaiAi")}
            </Button>
          )}
          <Button type="button" disabled={dang} icon={<Save className="size-4" />} onClick={() => chay(() => luuBaoCaoTon(id, goiLen(), ky))}>
            {t("paint.pgNutLuu")}
          </Button>
          <Button type="button" variant="primary" loading={dang} disabled={dem.capNhat === 0 || !kyHop || tuongLai} icon={<ClipboardCheck className="size-4" />} onClick={capNhat}>
            {t("paint.btNutCapNhat")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={dang}
            icon={<Trash2 className="size-4" />}
            className="text-[var(--text-danger)]"
            onClick={() => {
              if (window.confirm(t("paint.btXacNhanXoa"))) chay(() => xoaPhieuSon(id));
            }}
          >
            {t("paint.pgNutXoa")}
          </Button>
        </div>
      )}
      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}
    </div>
  );
}

/** Bốn ô tiêu đề cột số (Đầu kỳ · Nhận · Tiêu thụ · Cuối kỳ). */
function Cot4({ t }: { t: ReturnType<typeof useNgonNgu>["t"] }) {
  return (
    <>
      <th className="p-1">{t("paint.btDau")}</th>
      <th className="p-1">{t("paint.btNhan")}</th>
      <th className="p-1">{t("paint.btTieu")}</th>
      <th className="p-1">{t("paint.btCuoi")}</th>
    </>
  );
}
