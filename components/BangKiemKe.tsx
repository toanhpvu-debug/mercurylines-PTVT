"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Trash2 } from "lucide-react";
import { apDungKiemKe, luuKiemKe, xoaKiemKe } from "@/app/kiem-ke-actions";
import { keHoachNhomKiemKe, soTonNhap, type DongKiemKe, type SuaDongKiemKe } from "@/lib/kiemKe";
import type { ButToanBaoCao } from "@/lib/kyQuy";
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
  NHIEU_KHO: "warning",
  AM: "danger",
};
const nhomLoc = (s: TrangThaiDongKK): Exclude<Loc, "TAT_CA"> => (s === "THAY_DOI" || s === "AM" ? "THAY_DOI" : s === "MOI" || s === "KHONG_DOI" ? s : "KHAC");
const tron = (n: number) => Math.round(n * 1000) / 1000;
const so = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(tron(n)));
/** Ô số người đối chiếu gõ: trống → null, sai → NaN. */
const soO = (s: string) => soTonNhap(s);
const coSo = (n: number | null) => (n === null || Number.isNaN(n) ? null : n);

type Sua = { ton: string; tonDau: string; nhan: string; tieuThu: string; boQua: boolean; themMoi: boolean };

/**
 * Bảng đối chiếu một lần kiểm kê: dòng trong file ↔ mặt hàng đã có; số đếm so với
 * tồn của app HẾT NGÀY KIỂM KÊ (nhập / xuất sau ngày đó giữ nguyên), file có kỳ thì
 * cả ba cột Còn tồn đợt trước / Nhận / Tiêu thụ; cột "Sẽ ghi" là các dòng app thêm
 * vào thẻ kho (lib/kiemKe.ts keHoachNhomKiemKe — tính lại ngay khi sửa số, cùng luật
 * cộng dồn dòng trùng như máy chủ). Máy chủ vẫn lập lại kế hoạch lúc áp dụng.
 */
export default function BangKiemKe({
  id,
  dong,
  keHoach,
  coKy,
  coSua,
  coApDung,
}: {
  id: number;
  dong: DongKiemKe[];
  keHoach: DongKeHoach[];
  /** File có kỳ (đầu kỳ đã đặt): đối chiếu cả ba cột kỳ. */
  coKy: boolean;
  coSua: boolean;
  coApDung: boolean;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [sua, setSua] = useState<Sua[]>(() =>
    dong.map((d) => ({ ton: so(d.ton), tonDau: so(d.bc?.tonDau), nhan: so(d.bc?.nhan), tieuThu: so(d.bc?.tieuThu), boQua: d.boQua, themMoi: d.themMoi }))
  );
  const [loc, setLoc] = useState<Loc>("THAY_DOI");
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, startTransition] = useTransition();
  const dangSua = coSua || coApDung;
  const coCotKy = coKy && dong.some((d) => d.bc);

  // Trạng thái / kế hoạch theo ô đang gõ.
  const tinh = useMemo(() => {
    const ra = keHoach.map((k) => {
      const s = sua[k.i];
      const ton = soO(s.ton);
      const tonSo = coSo(ton);
      const bc = { tonDau: soO(s.tonDau), nhan: soO(s.nhan), tieuThu: soO(s.tieuThu) };
      let trangThai: TrangThaiDongKK;
      if (s.boQua) trangThai = "BO_QUA";
      else if (tonSo === null) trangThai = "KHONG_SO";
      else if (k.materialId === null) trangThai = "MOI";
      else if (k.warehouseId === null) trangThai = "KHONG_KHO";
      else if (k.nhieuKho) trangThai = "NHIEU_KHO";
      else trangThai = "KHONG_DOI";
      return {
        ...k,
        trangThai: trangThai as TrangThaiDongKK,
        tonMoi: tonSo,
        chenhLech: null as number | null,
        gopVao: null as number | null,
        soFile: tonSo === null ? null : { tonDau: coSo(bc.tonDau), nhan: coSo(bc.nhan), tieuThu: coSo(bc.tieuThu), tonCuoi: tonSo },
        buToan: [] as ButToanBaoCao[],
        tonSau: null as number | null,
        sai: Number.isNaN(ton) || Number.isNaN(bc.tonDau) || Number.isNaN(bc.nhan) || Number.isNaN(bc.tieuThu),
      };
    });
    const dau = new Map<string, (typeof ra)[number]>();
    for (const r of ra) {
      if (r.trangThai !== "KHONG_DOI" || !r.soFile) continue;
      const khoa = `${r.materialId}|${r.warehouseId}`;
      const d = dau.get(khoa);
      if (!d) {
        dau.set(khoa, r);
        continue;
      }
      const cong = (a: number | null, b: number | null) => (a === null && b === null ? null : tron((a ?? 0) + (b ?? 0)));
      d.tonMoi = tron((d.tonMoi ?? 0) + (r.tonMoi ?? 0));
      d.soFile = { tonDau: cong(d.soFile!.tonDau, r.soFile.tonDau), nhan: cong(d.soFile!.nhan, r.soFile.nhan), tieuThu: cong(d.soFile!.tieuThu, r.soFile.tieuThu), tonCuoi: d.tonMoi };
      r.trangThai = "GOP";
      r.gopVao = d.i;
    }
    for (const r of ra) {
      if (r.trangThai !== "KHONG_DOI" || !r.ht || !r.soFile) continue;
      const kh = keHoachNhomKiemKe(r.soFile, r.ht, coKy);
      r.buToan = kh.buToan;
      r.tonSau = kh.hienTaiMoi;
      r.chenhLech = tron((r.tonMoi ?? 0) - r.ht.cuoiKy);
      r.trangThai = kh.hienTaiMoi < -1e-6 ? "AM" : kh.khop ? "KHONG_DOI" : "THAY_DOI";
    }
    return ra;
  }, [keHoach, sua, coKy]);

  const dem = useMemo(() => {
    const c: Record<Loc, number> = { THAY_DOI: 0, MOI: 0, KHONG_DOI: 0, KHAC: 0, TAT_CA: tinh.length };
    for (const r of tinh) c[nhomLoc(r.trangThai)]++;
    return c;
  }, [tinh]);
  const thayDoi = tinh.filter((r) => r.trangThai === "THAY_DOI");
  const am = tinh.filter((r) => r.trangThai === "AM");
  const tang = thayDoi.filter((r) => (r.tonSau ?? 0) > (r.tonHienTai ?? 0)).length;
  const giam = thayDoi.filter((r) => (r.tonSau ?? 0) < (r.tonHienTai ?? 0)).length;
  const soThemMoi = tinh.filter((r) => r.trangThai === "MOI" && sua[r.i].themMoi).length;
  const hien = loc === "TAT_CA" ? tinh : tinh.filter((r) => nhomLoc(r.trangThai) === loc);

  const doi = (i: number, patch: Partial<Sua>) => setSua((ds) => ds.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const goiLen = (): SuaDongKiemKe[] =>
    sua.map((s, i) => ({ i, ton: s.ton, boQua: s.boQua, themMoi: s.themMoi, ...(dong[i].bc || s.tonDau || s.nhan || s.tieuThu ? { bc: { tonDau: s.tonDau, nhan: s.nhan, tieuThu: s.tieuThu } } : {}) }));

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
  const chuButToan = (b: ButToanBaoCao) => {
    switch (b.cot) {
      case "tonDau":
        return t("kiemKe.ghiDau", { truoc: so(b.truoc), sau: so(b.sau) });
      case "nhan":
        return b.loai === "NHAN" ? t("kiemKe.ghiNhan", { so: so(b.so) }) : t("kiemKe.ghiBotNhan", { so: so(-b.so) });
      case "tieuThu":
        return b.loai === "TIEU_THU" ? t("kiemKe.ghiTieu", { so: so(b.so) }) : t("kiemKe.ghiBotTieu", { so: so(b.so) });
      case "tonCuoi":
        return t("kiemKe.ghiCuoi", { truoc: so(b.truoc), sau: so(b.sau) });
    }
  };
  const oSo = (gt: string, sai: boolean, nhan: string, onChange: (v: string) => void, rong = "w-20") => (
    <input
      value={gt}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      aria-label={nhan}
      className={`tabular ${rong} rounded-md border bg-[var(--surface-raised)] px-2 py-1 text-right text-sm ${sai ? "border-rose-500" : "border-[var(--border-subtle)]"}`}
    />
  );

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
        {thayDoi.length > 0 && <span className="text-sm text-[var(--text-secondary)]">{t("kiemKe.tangGiam", { tang, giam })}</span>}
      </div>

      {am.length > 0 && (
        <Notice tone="danger">
          {am
            .slice(0, 3)
            .map((r) => t("kiemKe.loiAm", { dong: r.i + 1, ma: r.maVatTu ?? "", ten: r.tenVatTu ?? "", so: so(r.tonSau) }))
            .join(" ")}
        </Notice>
      )}
      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}

      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              <Th className="w-10">{t("kiemKe.cot_dong")}</Th>
              <Th>{t("kiemKe.cot_tenFile")}</Th>
              <Th>{t("kiemKe.cot_khop")}</Th>
              <Th>{t("kiemKe.cot_kho")}</Th>
              {coCotKy && <Th className="text-right">{t("kiemKe.cot_kyFile")}</Th>}
              <Th className="text-right">{t("kiemKe.cot_tonDem")}</Th>
              <Th className="text-right">{t("kiemKe.cot_tonNgay")}</Th>
              <Th className="text-right">{t("kiemKe.cot_chenhLech")}</Th>
              <Th>{t("kiemKe.cot_seGhi")}</Th>
              <Th className="text-right">{t("kiemKe.cot_tonSau")}</Th>
              {dangSua && <Th align="center">{t("kiemKe.cot_chon")}</Th>}
            </tr>
          </thead>
          <tbody>
            {hien.map((r) => {
              const d = dong[r.i];
              const s = sua[r.i];
              const doiTon = r.tonSau !== null && r.tonHienTai !== null && tron(r.tonSau - r.tonHienTai) !== 0;
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
                        {r.nhieuKho && r.trangThai === "NHIEU_KHO" && (
                          <p className="text-xs text-[var(--text-warning)]">{t("kiemKe.nhieuKhoGoiY", { ds: r.nhieuKho.map((x) => `${x.maKho} ${so(x.so)}`).join(", ") })}</p>
                        )}
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
                  {coCotKy && (
                    <Td className="whitespace-nowrap text-right">
                      {dangSua ? (
                        <span className="inline-flex gap-1">
                          {oSo(s.tonDau, Number.isNaN(soO(s.tonDau)), `${t("kiemKe.cot_kyFile")} 1 · ${r.i + 1}`, (v) => doi(r.i, { tonDau: v }), "w-16")}
                          {oSo(s.nhan, Number.isNaN(soO(s.nhan)), `${t("kiemKe.cot_kyFile")} 2 · ${r.i + 1}`, (v) => doi(r.i, { nhan: v }), "w-16")}
                          {oSo(s.tieuThu, Number.isNaN(soO(s.tieuThu)), `${t("kiemKe.cot_kyFile")} 3 · ${r.i + 1}`, (v) => doi(r.i, { tieuThu: v }), "w-16")}
                        </span>
                      ) : (
                        <span className="tabular text-sm">{[s.tonDau || "—", s.nhan || "—", s.tieuThu || "—"].join(" · ")}</span>
                      )}
                    </Td>
                  )}
                  <Td className="text-right">
                    {dangSua ? oSo(s.ton, Number.isNaN(soO(s.ton)), `${t("kiemKe.cot_tonDem")} ${r.i + 1}`, (v) => doi(r.i, { ton: v })) : <span className="tabular">{s.ton}</span>}
                  </Td>
                  <Td className="tabular text-right text-[var(--text-secondary)]">{so(r.tonNgay)}</Td>
                  <Td
                    className={`tabular text-right font-semibold ${
                      (r.chenhLech ?? 0) > 0 ? "text-[var(--text-success)]" : (r.chenhLech ?? 0) < 0 ? "text-[var(--text-danger)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {r.chenhLech === null ? "" : r.chenhLech > 0 ? `+${so(r.chenhLech)}` : so(r.chenhLech)}
                  </Td>
                  <Td className="text-xs">
                    {r.trangThai === "THAY_DOI" || r.trangThai === "AM" ? (
                      <ul className="space-y-0.5">
                        {r.buToan.map((b, j) => (
                          <li key={j}>{chuButToan(b)}</li>
                        ))}
                      </ul>
                    ) : r.trangThai === "KHONG_DOI" && r.ht ? (
                      <span className="text-[var(--text-success)]">{t("kiemKe.khop")}</span>
                    ) : null}
                  </Td>
                  <Td className="tabular whitespace-nowrap text-right">
                    {r.tonHienTai === null ? "" : doiTon ? (
                      <>
                        {so(r.tonHienTai)} → <span className={(r.tonSau ?? 0) < 0 ? "font-semibold text-[var(--text-danger)]" : "font-semibold"}>{so(r.tonSau)}</span>
                      </>
                    ) : (
                      so(r.tonHienTai)
                    )}
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
            <Button
              type="button"
              variant="primary"
              onClick={apDung}
              loading={dangGui}
              disabled={(thayDoi.length === 0 && soThemMoi === 0) || am.length > 0}
              icon={<Check className="size-4" />}
            >
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
