"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Trash2 } from "lucide-react";
import { apDungKiemKe, luuKiemKe, xoaKiemKe } from "@/app/kiem-ke-actions";
import { soTonNhap, type DongKiemKe, type SuaDongKiemKe } from "@/lib/kiemKe";
import type { DongKeHoach, TrangThaiDongKK } from "@/lib/kiemKeServer";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Notice, Table, TableWrap, Td, Th, Tr, type Tone } from "@/components/ui";

type Loc = "THAY_DOI" | "MOI" | "KHONG_DOI" | "KHAC" | "TAT_CA";
const TONE: Record<TrangThaiDongKK, Tone> = {
  THAY_DOI: "brand",
  KHONG_DOI: "success",
  MOI: "warning",
  KHONG_SO: "muted",
  BO_QUA: "muted",
  GOP: "info",
  KHONG_KHO: "danger",
};
const nhomLoc = (s: TrangThaiDongKK): Exclude<Loc, "TAT_CA"> => (s === "THAY_DOI" || s === "MOI" || s === "KHONG_DOI" ? s : "KHAC");
const tron = (n: number) => Math.round(n * 1000) / 1000;
const so = (n: number | null) => (n === null ? "" : String(tron(n)));

type Sua = { ton: string; boQua: boolean; themMoi: boolean };

/**
 * Bảng đối chiếu một lần kiểm kê: dòng trong file ↔ mặt hàng đã có, tồn hiện
 * tại → số đếm → chênh lệch. Sửa số đếm / bỏ qua / thêm mới thì trạng thái và
 * chênh lệch tính lại ngay (cùng luật cộng dồn dòng trùng như máy chủ); máy chủ
 * vẫn lập lại kế hoạch lúc áp dụng.
 */
export default function BangKiemKe({
  id,
  dong,
  keHoach,
  coSua,
  coApDung,
}: {
  id: number;
  dong: DongKiemKe[];
  keHoach: DongKeHoach[];
  coSua: boolean;
  coApDung: boolean;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [sua, setSua] = useState<Sua[]>(() => dong.map((d) => ({ ton: so(d.ton), boQua: d.boQua, themMoi: d.themMoi })));
  const [loc, setLoc] = useState<Loc>("THAY_DOI");
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, startTransition] = useTransition();
  const dangSua = coSua || coApDung;

  // Trạng thái / chênh lệch theo ô đang gõ.
  const tinh = useMemo(() => {
    const ra = keHoach.map((k): DongKeHoach & { sai: boolean } => {
      const s = sua[k.i];
      const ton = soTonNhap(s.ton);
      const tonSo = ton === null || Number.isNaN(ton) ? null : ton;
      let trangThai: TrangThaiDongKK;
      if (s.boQua) trangThai = "BO_QUA";
      else if (tonSo === null) trangThai = "KHONG_SO";
      else if (k.materialId === null) trangThai = "MOI";
      else if (k.warehouseId === null) trangThai = "KHONG_KHO";
      else trangThai = "KHONG_DOI";
      return { ...k, trangThai, tonMoi: tonSo, chenhLech: null, gopVao: null, sai: Number.isNaN(ton) };
    });
    const dau = new Map<string, (typeof ra)[number]>();
    for (const r of ra) {
      if (r.trangThai !== "KHONG_DOI") continue;
      const khoa = `${r.materialId}|${r.warehouseId}`;
      const d = dau.get(khoa);
      if (!d) dau.set(khoa, r);
      else {
        d.tonMoi = tron((d.tonMoi ?? 0) + (r.tonMoi ?? 0));
        r.trangThai = "GOP";
        r.gopVao = d.i;
      }
    }
    for (const r of ra) {
      if (r.trangThai !== "KHONG_DOI") continue;
      r.chenhLech = tron((r.tonMoi ?? 0) - (r.tonHienTai ?? 0));
      if (r.chenhLech !== 0) r.trangThai = "THAY_DOI";
    }
    return ra;
  }, [keHoach, sua]);

  const dem = useMemo(() => {
    const c: Record<Loc, number> = { THAY_DOI: 0, MOI: 0, KHONG_DOI: 0, KHAC: 0, TAT_CA: tinh.length };
    for (const r of tinh) c[nhomLoc(r.trangThai)]++;
    return c;
  }, [tinh]);
  const thayDoi = tinh.filter((r) => r.trangThai === "THAY_DOI");
  const tang = thayDoi.filter((r) => (r.chenhLech ?? 0) > 0).length;
  const soThemMoi = tinh.filter((r) => r.trangThai === "MOI" && sua[r.i].themMoi).length;
  const hien = loc === "TAT_CA" ? tinh : tinh.filter((r) => nhomLoc(r.trangThai) === loc);

  const doi = (i: number, patch: Partial<Sua>) => setSua((ds) => ds.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const goiLen = (): SuaDongKiemKe[] => sua.map((s, i) => ({ i, ton: s.ton, boQua: s.boQua, themMoi: s.themMoi }));

  const luu = () =>
    startTransition(async () => {
      const r = await luuKiemKe(id, goiLen());
      setThongBao({ ok: Boolean(r.success), chu: r.message });
    });
  const apDung = () => {
    const moi = soThemMoi ? t("kiemKe.xacNhanApDungMoi", { n: soThemMoi }) : "";
    if (!window.confirm(t("kiemKe.xacNhanApDung", { doi: thayDoi.length, moi }))) return;
    startTransition(async () => {
      const r = await apDungKiemKe(id, goiLen());
      setThongBao({ ok: Boolean(r.success), chu: r.message });
    });
  };
  const xoa = () => {
    if (!window.confirm(t("kiemKe.xacNhanXoa"))) return;
    startTransition(async () => {
      const r = await xoaKiemKe(id);
      if (r.success) router.push("/inventory/kiem-ke");
      else setThongBao({ ok: false, chu: r.message });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["THAY_DOI", "MOI", "KHONG_DOI", "KHAC", "TAT_CA"] as Loc[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLoc(l)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              loc === l
                ? "border-brand-500 bg-brand-500/12 text-brand-700 dark:text-brand-300"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
            }`}
          >
            {tTuDo(`kiemKe.loc_${l}`)} <span className="tabular opacity-80">({dem[l]})</span>
          </button>
        ))}
        {thayDoi.length > 0 && <span className="text-sm text-[var(--text-secondary)]">{t("kiemKe.tangGiam", { tang, giam: thayDoi.length - tang })}</span>}
      </div>

      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}

      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              <Th className="w-10">{t("kiemKe.cot_dong")}</Th>
              <Th>{t("kiemKe.cot_tenFile")}</Th>
              <Th>{t("kiemKe.cot_khop")}</Th>
              <Th>{t("kiemKe.cot_kho")}</Th>
              <Th className="text-right">{t("kiemKe.cot_tonHienTai")}</Th>
              <Th className="text-right">{t("kiemKe.cot_tonDem")}</Th>
              <Th className="text-right">{t("kiemKe.cot_chenhLech")}</Th>
              {dangSua && <Th className="text-center">{t("kiemKe.cot_chon")}</Th>}
            </tr>
          </thead>
          <tbody>
            {hien.map((r) => {
              const d = dong[r.i];
              const s = sua[r.i];
              return (
                <Tr key={r.i} className={`align-top ${r.trangThai === "BO_QUA" ? "opacity-60" : ""}`}>
                  <Td className="tabular whitespace-nowrap text-[var(--text-muted)]">
                    {r.i + 1}
                    {d.trang ? <p className="text-xs">{t("kiemKe.trangTep", { n: d.trang })}</p> : null}
                  </Td>
                  <Td>
                    <p className="font-medium text-[var(--text-primary)]">{d.ten}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {[d.impa && `IMPA ${d.impa}`, d.partNo && `P/N ${d.partNo}`, d.donVi, d.thietBi ?? d.nhom, d.sheet].filter(Boolean).join(" · ")}
                    </p>
                    {d.canhBao && <p className="text-xs text-[var(--text-warning)]">⚠ {d.canhBao}</p>}
                  </Td>
                  <Td>
                    <Badge tone={TONE[r.trangThai]}>{tTuDo(`kiemKe.the_${r.trangThai}`)}</Badge>
                    {r.materialId !== null ? (
                      <>
                        <p className="mt-1 text-sm">
                          <span className="font-display text-xs tracking-wide text-[var(--text-brand)]">{r.maVatTu}</span> {r.tenVatTu}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {r.khopTheo ? tTuDo(`kiemKe.khopTheo_${r.khopTheo}`) : ""}
                          {r.ngoaiDanhMucTau ? ` · ${t("kiemKe.ngoaiDanhMucTau")}` : ""}
                          {r.gopVao !== null ? ` · ${t("kiemKe.gopVao", { n: r.gopVao + 1 })}` : ""}
                        </p>
                      </>
                    ) : (
                      dangSua &&
                      r.trangThai === "MOI" && (
                        <label className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                          <input type="checkbox" className="size-4 accent-brand-600" checked={s.themMoi} onChange={(e) => doi(r.i, { themMoi: e.target.checked })} />
                          {t("kiemKe.themMoi")}
                        </label>
                      )
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{r.maKho ?? ""}</Td>
                  <Td className="tabular text-right">{so(r.tonHienTai)}</Td>
                  <Td className="text-right">
                    {dangSua ? (
                      <input
                        value={s.ton}
                        onChange={(e) => doi(r.i, { ton: e.target.value })}
                        inputMode="decimal"
                        aria-label={`${t("kiemKe.cot_tonDem")} ${r.i + 1}`}
                        className={`tabular w-20 rounded-md border bg-[var(--surface-raised)] px-2 py-1 text-right text-sm ${
                          r.sai ? "border-rose-500" : "border-[var(--border-subtle)]"
                        }`}
                      />
                    ) : (
                      <span className="tabular">{s.ton}</span>
                    )}
                  </Td>
                  <Td
                    className={`tabular text-right font-semibold ${
                      (r.chenhLech ?? 0) > 0 ? "text-[var(--text-success)]" : (r.chenhLech ?? 0) < 0 ? "text-[var(--text-danger)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {r.chenhLech === null ? "" : r.chenhLech > 0 ? `+${r.chenhLech}` : String(r.chenhLech)}
                  </Td>
                  {dangSua && (
                    <Td className="text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={s.boQua}
                        onChange={(e) => doi(r.i, { boQua: e.target.checked })}
                        aria-label={`${t("kiemKe.cot_chon")} ${r.i + 1}`}
                      />
                    </Td>
                  )}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      {dangSua && (
        <div className="flex flex-wrap items-center gap-2">
          {coApDung && (
            <Button type="button" variant="primary" onClick={apDung} loading={dangGui} disabled={thayDoi.length === 0 && soThemMoi === 0} icon={<Check className="size-4" />}>
              {dangGui ? t("kiemKe.dangApDung") : `${t("kiemKe.apDung")} (${thayDoi.length}${soThemMoi ? ` + ${soThemMoi}` : ""})`}
            </Button>
          )}
          <Button type="button" onClick={luu} disabled={dangGui} icon={<Save className="size-4" />}>
            {t("kiemKe.luu")}
          </Button>
          <Button type="button" variant="ghost" onClick={xoa} disabled={dangGui} icon={<Trash2 className="size-4" />}>
            {t("kiemKe.xoa")}
          </Button>
        </div>
      )}
    </div>
  );
}
