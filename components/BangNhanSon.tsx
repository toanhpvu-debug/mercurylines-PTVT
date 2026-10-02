"use client";

import { useMemo, useState, useTransition } from "react";
import { PackagePlus, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { apDungPhieuSon, docLaiPhieuSonAi, luuPhieuSon, xoaPhieuSon, type DauPhieuSon } from "@/app/son-phieu-actions";
import { CANH_BAO_THIEU_SO, demPhieuSon, type DongNhanSon } from "@/lib/phieuSon";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice } from "@/components/ui";

/** Một loại sơn trong danh mục để chọn cho dòng. */
export type SonLuaChon = { id: number; code: string; label: string; uom: string };

/** Dòng trên bảng soát: ô số là chữ người dùng gõ, đổi thành số khi lưu (máy chủ kiểm lại). */
type Dong = {
  ten: string;
  hang: string;
  mau: string;
  maMau: string;
  ma: string;
  dvt: string;
  soLuong: string;
  dungTich: string;
  loaiSon: string;
  paintProductId: string;
  boQua: boolean;
  canhBao: string;
  ghiChu: string;
};
const sang = (d: DongNhanSon): Dong => ({
  ten: d.ten,
  hang: d.hang ?? "",
  mau: d.mau ?? "",
  maMau: d.maMau ?? "",
  ma: d.ma ?? "",
  dvt: d.dvt ?? "",
  soLuong: d.soLuong === null ? "" : String(d.soLuong),
  dungTich: d.dungTich === null ? "" : String(d.dungTich),
  loaiSon: d.loaiSon ?? "",
  paintProductId: d.paintProductId === null ? "" : String(d.paintProductId),
  boQua: d.boQua,
  canhBao: d.canhBao ?? "",
  ghiChu: d.ghiChu ?? "",
});
const dongTrong = (): Dong => sang({ ten: "", hang: null, mau: null, maMau: null, ma: null, dvt: null, soLuong: null, dungTich: null, loaiSon: null, paintProductId: null, boQua: false, canhBao: null, ghiChu: null });
const soO = (s: string) => {
  if (!s.trim()) return null;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const O = "w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm disabled:opacity-60";

/** Bảng soát phiếu giao sơn: sửa dòng đọc sai, chọn loại sơn (hoặc tạo mới), bỏ dòng rác, rồi nhập vào tồn sơn. */
export default function BangNhanSon({
  id,
  dong: dongGoc,
  dau: dauGoc,
  son,
  coSua,
  docLaiAi,
}: {
  id: number;
  dong: DongNhanSon[];
  dau: DauPhieuSon;
  son: SonLuaChon[];
  coSua: boolean;
  /** PDF + có bộ đọc AI: hiện nút Đọc lại bằng AI. */
  docLaiAi: boolean;
}) {
  const { t } = useNgonNgu();
  const [dong, setDong] = useState<Dong[]>(() => (dongGoc.length ? dongGoc.map(sang) : coSua ? [dongTrong()] : []));
  const [dau, setDau] = useState(dauGoc);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, startT] = useTransition();
  const sonTheoId = useMemo(() => new Map(son.map((s) => [String(s.id), s])), [son]);

  const goiLen = (ds: Dong[] = dong) => ds.map((d) => ({ ...d, canhBao: d.canhBao || null }));
  const dem = demPhieuSon(
    dong.map((d) => ({
      ten: d.ten,
      hang: null,
      mau: null,
      maMau: null,
      ma: null,
      dvt: null,
      soLuong: soO(d.soLuong),
      dungTich: null,
      loaiSon: null,
      paintProductId: d.paintProductId ? Number(d.paintProductId) : null,
      boQua: d.boQua || (!d.ten.trim() && !d.paintProductId),
      canhBao: d.canhBao || null,
      ghiChu: null,
    }))
  );
  const doi = (i: number, patch: Partial<Dong>) => setDong((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const chay = (fn: () => Promise<{ message: string; success?: boolean } | undefined>) =>
    startT(async () => {
      const r = await fn();
      if (!r) return; // đã chuyển trang (redirect)
      setThongBao({ ok: Boolean(r.success), chu: r.message });
    });
  const soSai = (s: string) => s.trim() !== "" && soO(s) === null;
  const coSo = (s: string) => (soO(s) ?? 0) > 0;
  // Dòng bộ đọc đã tự bỏ tick vì không có số lượng (lib/phieuSon.ts boTickDongThieuSo) mà chưa được điền.
  const soDongTuBo = dong.filter((d) => d.boQua && !coSo(d.soLuong) && d.canhBao.includes(CANH_BAO_THIEU_SO)).length;
  // Điền số vào dòng đang bỏ tick vì chưa có số lượng → tick lại luôn (khỏi bấm thêm ô tick).
  const doiSo = (i: number, v: string) =>
    setDong((ds) => ds.map((d, j) => (j !== i ? d : { ...d, soLuong: v, ...(d.boQua && !coSo(d.soLuong) && coSo(v) ? { boQua: false } : {}) })));
  // Bấm Nhập: dòng đang tick mà chưa có số lượng thì HỎI bỏ qua các dòng đó rồi nhập phần
  // còn lại — không dừng cả phiếu ở lỗi "Dòng 1: chưa có số lượng nhận".
  const nhapVaoTon = () => {
    const thieu = dong
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !d.boQua && (d.ten.trim() || d.paintProductId) && !coSo(d.soLuong));
    if (!thieu.length) {
      if (window.confirm(t("paint.pgXacNhanNhap", { n: dem.nhap }))) chay(() => apDungPhieuSon(id, goiLen(), dau));
      return;
    }
    const con = dem.nhap - thieu.length;
    if (con <= 0) {
      setThongBao({ ok: false, chu: t("paint.pgChuaDongNaoCoSo") });
      return;
    }
    const ds = thieu
      .slice(0, 5)
      .map(({ d, i }) => `${i + 1}. ${d.ten.trim() || "…"}`)
      .join("; ");
    if (!window.confirm(t("paint.pgHoiBoQuaThieuSo", { n: thieu.length, ds: thieu.length > 5 ? `${ds}; …` : ds, con }))) return;
    const bo = new Set(thieu.map(({ i }) => i));
    const moi = dong.map((d, i) => (bo.has(i) ? { ...d, boQua: true } : d));
    setDong(moi);
    chay(() => apDungPhieuSon(id, goiLen(moi), dau));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("paint.pgSoPhieu")}>
          <Input value={dau.soPhieu} disabled={!coSua} onChange={(e) => setDau({ ...dau, soPhieu: e.target.value })} />
        </Field>
        <Field label={t("paint.pgNhaCungCap")}>
          <Input value={dau.nhaCungCap} disabled={!coSua} onChange={(e) => setDau({ ...dau, nhaCungCap: e.target.value })} />
        </Field>
        <Field label={t("paint.pgNgayNhan")}>
          <Input type="date" value={dau.ngayNhan} disabled={!coSua} onChange={(e) => setDau({ ...dau, ngayNhan: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="brand">{t("paint.pgDemNhap", { n: dem.nhap })}</Badge>
        <Badge tone="success">{t("paint.pgDemKhop", { n: dem.khop })}</Badge>
        {dem.moi > 0 && <Badge tone="info">{t("paint.pgDemMoi", { n: dem.moi })}</Badge>}
        {dem.thieuSo > 0 && <Badge tone="warning">{t("paint.pgDemThieuSo", { n: dem.thieuSo })}</Badge>}
        {dem.tong - dem.nhap > 0 && <Badge tone="muted">{t("paint.pgDemBoQua", { n: dem.tong - dem.nhap })}</Badge>}
      </div>
      {coSua && soDongTuBo > 0 && <Notice tone="warning">{t("paint.pgCoDongThieuSo", { n: soDongTuBo })}</Notice>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-secondary)]">
              <th className="p-1">#</th>
              <th className="p-1">{t("paint.pgCotNhap")}</th>
              <th className="p-1">{t("paint.pgCotTen")}</th>
              <th className="p-1">{t("paint.pgCotLoai")}</th>
              <th className="p-1">{t("paint.pgCotHang")}</th>
              <th className="p-1">{t("paint.pgCotMau")}</th>
              <th className="p-1">{t("paint.pgCotDvt")}</th>
              <th className="p-1 text-right">{t("paint.pgCotSoLuong")}</th>
              <th className="p-1">{t("paint.pgCotGhiChu")}</th>
              {coSua && <th className="p-1" />}
            </tr>
          </thead>
          <tbody>
            {dong.map((d, i) => {
              const sp = d.paintProductId ? sonTheoId.get(d.paintProductId) : undefined;
              const moi = !d.paintProductId;
              return (
                <tr key={i} className={`border-t border-[var(--border-subtle)] align-top ${d.boQua ? "opacity-50" : ""}`}>
                  <td className="p-1 text-xs text-[var(--text-muted)]">{i + 1}</td>
                  <td className="p-1">
                    <input type="checkbox" className="mt-2 size-4 accent-brand-600" checked={!d.boQua} disabled={!coSua} onChange={(e) => doi(i, { boQua: !e.target.checked })} aria-label={t("paint.pgCotNhap")} />
                  </td>
                  <td className="w-72 p-1">
                    <input className={O} value={d.ten} disabled={!coSua} onChange={(e) => doi(i, { ten: e.target.value })} />
                    {d.ma && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{d.ma}</span>}
                  </td>
                  <td className="w-72 p-1">
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
                  <td className="w-32 p-1">
                    <input className={O} value={d.hang} disabled={!coSua || !moi} onChange={(e) => doi(i, { hang: e.target.value })} />
                  </td>
                  <td className="w-28 p-1">
                    <input className={O} value={d.mau} disabled={!coSua || !moi} onChange={(e) => doi(i, { mau: e.target.value })} />
                  </td>
                  <td className="w-20 p-1">
                    <input className={O} value={d.dvt} disabled={!coSua || !moi} onChange={(e) => doi(i, { dvt: e.target.value })} />
                  </td>
                  <td className="w-24 p-1">
                    <input
                      className={`${O} tabular text-right ${soSai(d.soLuong) || (!d.boQua && !d.soLuong.trim()) ? "border-[var(--text-warning)]" : ""}`}
                      value={d.soLuong}
                      disabled={!coSua}
                      inputMode="decimal"
                      onChange={(e) => doiSo(i, e.target.value)}
                    />
                  </td>
                  <td className="w-56 p-1">
                    <input className={O} value={d.ghiChu} disabled={!coSua} onChange={(e) => doi(i, { ghiChu: e.target.value })} />
                    {d.canhBao && <span className="mt-0.5 block text-xs text-[var(--text-warning)]">{d.canhBao}</span>}
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
          <Button type="button" disabled={dang} icon={<Save className="size-4" />} onClick={() => chay(() => luuPhieuSon(id, goiLen(), dau))}>
            {t("paint.pgNutLuu")}
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={dang}
            disabled={dem.nhap === 0}
            icon={<PackagePlus className="size-4" />}
            onClick={() => {
              nhapVaoTon();
            }}
          >
            {t("paint.pgNutNhap")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={dang}
            icon={<Trash2 className="size-4" />}
            className="text-[var(--text-danger)]"
            onClick={() => {
              if (window.confirm(t("paint.pgXacNhanXoa"))) chay(() => xoaPhieuSon(id));
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
