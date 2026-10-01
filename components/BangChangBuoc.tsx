"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, Wand2 } from "lucide-react";
import { apDungChangBuoc, luuChangBuoc, xoaChangBuoc, type DauSuaChangBuoc } from "@/app/chang-buoc-actions";
import { ghepChangBuoc, soO, type DongChangBuocNhap, type GearCo } from "@/lib/changBuocNhap";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice } from "@/components/ui";

/** Dòng trên bảng soát: mọi ô số là chữ (người dùng gõ), đổi lại thành số khi lưu. */
type Dong = {
  ten: string;
  kyHieu: string;
  toiThieu: string;
  chuan: string;
  conDung: string;
  hong: string;
  yeuCau: string;
  canhBao: string;
  boQua: boolean;
};
const COT_SO = ["toiThieu", "chuan", "conDung", "hong", "yeuCau"] as const;
const sang = (d: DongChangBuocNhap): Dong => ({
  ten: d.ten,
  kyHieu: d.kyHieu ?? "",
  toiThieu: d.toiThieu === null ? "" : String(d.toiThieu),
  chuan: d.chuan === null ? "" : String(d.chuan),
  conDung: d.conDung === null ? "" : String(d.conDung),
  hong: d.hong === null ? "" : String(d.hong),
  yeuCau: d.yeuCau === null ? "" : String(d.yeuCau),
  canhBao: d.canhBao ?? "",
  boQua: d.boQua,
});
const O = "w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm";

/** Bảng soát file MLS-11-13: sửa dòng, xem dòng nào thêm mới / cập nhật dụng cụ đã có, rồi áp dụng. */
export default function BangChangBuoc({
  id,
  dong: dongGoc,
  dau: dauGoc,
  gears,
  coSua,
}: {
  id: number;
  dong: DongChangBuocNhap[];
  dau: DauSuaChangBuoc;
  gears: GearCo[];
  coSua: boolean;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [dong, setDong] = useState<Dong[]>(() => dongGoc.map(sang));
  const [dau, setDau] = useState(dauGoc);
  const [capNhatSo, setCapNhatSo] = useState(true);
  const [taoBaoCao, setTaoBaoCao] = useState(() => dongGoc.some((d) => d.conDung !== null || d.hong !== null));
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, startT] = useTransition();

  // Xem trước: cùng bộ ghép với máy chủ (lib/changBuocNhap.ts).
  const ghep = useMemo(
    () =>
      ghepChangBuoc(
        dong.map((d) => ({
          ten: d.ten.trim(),
          kyHieu: d.kyHieu.trim() || null,
          toiThieu: soO(d.toiThieu),
          chuan: soO(d.chuan),
          conDung: soO(d.conDung),
          hong: soO(d.hong),
          yeuCau: soO(d.yeuCau),
          canhBao: null,
          trang: null,
          boQua: d.boQua || !d.ten.trim(),
        })),
        gears,
        capNhatSo
      ),
    [dong, gears, capNhatSo]
  );
  const dem = { MOI: 0, CAP_NHAT: 0, GIONG: 0, TRUNG: 0, BO_QUA: 0 };
  for (const g of ghep) dem[g.trangThai]++;
  const doi = (i: number, patch: Partial<Dong>) => setDong((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const chay = (fn: () => Promise<{ message: string; success?: boolean } | undefined>) =>
    startT(async () => {
      const r = await fn();
      if (!r) return; // đã chuyển trang (redirect)
      setThongBao({ ok: Boolean(r.success), chu: r.message });
      if (r.success) router.refresh();
    });
  const soSai = (s: string) => s.trim() !== "" && soO(s) === null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("changBuoc.cang")}>
          <Input value={dau.cang} disabled={!coSua} onChange={(e) => setDau({ ...dau, cang: e.target.value })} />
        </Field>
        <Field label={t("changBuoc.ngay")}>
          <Input type="date" value={dau.ngay} disabled={!coSua} onChange={(e) => setDau({ ...dau, ngay: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="success">{t("changBuoc.demMoi", { n: dem.MOI })}</Badge>
        <Badge tone="info">{t("changBuoc.demCapNhat", { n: dem.CAP_NHAT })}</Badge>
        <Badge tone="muted">{t("changBuoc.demGiong", { n: dem.GIONG })}</Badge>
        {dem.TRUNG > 0 && <Badge tone="warning">{t("changBuoc.demTrung", { n: dem.TRUNG })}</Badge>}
        {dem.BO_QUA > 0 && <Badge tone="muted">{t("changBuoc.demBoQua", { n: dem.BO_QUA })}</Badge>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-secondary)]">
              <th className="p-1">#</th>
              <th className="p-1">{t("changBuoc.cotDungCu")}</th>
              <th className="p-1">{t("changBuoc.cotKyHieu")}</th>
              <th className="p-1 text-right">{t("changBuoc.cotToiThieu")}</th>
              <th className="p-1 text-right">{t("changBuoc.cotChuan")}</th>
              <th className="p-1 text-right">{t("changBuoc.cotConDung")}</th>
              <th className="p-1 text-right">{t("changBuoc.cotHong")}</th>
              <th className="p-1 text-right">{t("changBuoc.cotYeuCau")}</th>
              <th className="p-1">{t("changBuoc.cotDanhMuc")}</th>
              <th className="p-1 text-center">{t("changBuoc.cotBoQua")}</th>
            </tr>
          </thead>
          <tbody>
            {dong.map((d, i) => {
              const g = ghep[i];
              return (
                <tr key={i} className={`align-top ${d.boQua ? "opacity-50" : ""}`}>
                  <td className="p-1 text-xs text-[var(--text-muted)]">{i + 1}</td>
                  <td className="p-1">
                    <input className={O} value={d.ten} disabled={!coSua} onChange={(e) => doi(i, { ten: e.target.value })} aria-label={`${t("changBuoc.cotDungCu")} ${i + 1}`} />
                    {d.canhBao && <p className="mt-0.5 text-xs text-[var(--text-warning)]">⚠ {d.canhBao}</p>}
                  </td>
                  <td className="w-32 p-1">
                    <input className={O} value={d.kyHieu} disabled={!coSua} onChange={(e) => doi(i, { kyHieu: e.target.value })} aria-label={`${t("changBuoc.cotKyHieu")} ${i + 1}`} />
                  </td>
                  {COT_SO.map((k) => (
                    <td key={k} className="w-20 p-1">
                      <input
                        className={`${O} text-right ${soSai(d[k]) ? "border-rose-500" : ""}`}
                        value={d[k]}
                        disabled={!coSua}
                        inputMode="decimal"
                        onChange={(e) => doi(i, { [k]: e.target.value } as Partial<Dong>)}
                        aria-label={`${tTuDo(`changBuoc.cot${k.charAt(0).toUpperCase()}${k.slice(1)}`)} ${i + 1}`}
                      />
                    </td>
                  ))}
                  <td className="w-52 p-1 text-xs">
                    {g.trangThai === "MOI" && <span className="text-[var(--text-success)]">{t("changBuoc.ghepMoi")}</span>}
                    {g.trangThai === "CAP_NHAT" && (
                      <span className="text-[var(--text-info)]">
                        {t("changBuoc.ghepCapNhat", { ten: g.gearName ?? "" })}
                        <span className="block text-[var(--text-muted)]">{g.thayDoi.join(" · ")}</span>
                      </span>
                    )}
                    {g.trangThai === "GIONG" && <span className="text-[var(--text-muted)]">{t("changBuoc.ghepGiong", { ten: g.gearName ?? "" })}</span>}
                    {g.trangThai === "TRUNG" && <span className="text-[var(--text-warning)]">{t("changBuoc.ghepTrung")}</span>}
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={d.boQua}
                      disabled={!coSua}
                      onChange={(e) => doi(i, { boQua: e.target.checked })}
                      aria-label={`${t("changBuoc.cotBoQua")} ${i + 1}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {coSua && (
        <Button
          type="button"
          size="sm"
          icon={<Plus className="size-4" />}
          onClick={() => setDong((ds) => [...ds, { ten: "", kyHieu: "", toiThieu: "", chuan: "", conDung: "", hong: "", yeuCau: "", canhBao: "", boQua: false }])}
        >
          {t("changBuoc.themDong")}
        </Button>
      )}

      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}

      {coSua && (
        <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
          <div className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={capNhatSo} onChange={(e) => setCapNhatSo(e.target.checked)} />
              {t("changBuoc.tuyChonCapNhatSo")}
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={taoBaoCao} onChange={(e) => setTaoBaoCao(e.target.checked)} />
              {t("changBuoc.tuyChonBaoCao")}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              loading={dang}
              icon={<Wand2 className="size-4" />}
              onClick={() => {
                if (window.confirm(t("changBuoc.xacNhanApDung", { moi: dem.MOI, capNhat: dem.CAP_NHAT })))
                  chay(() => apDungChangBuoc(id, dong, dau, { capNhatSo, taoBaoCao }));
              }}
            >
              {t("changBuoc.nutApDung")}
            </Button>
            <Button type="button" disabled={dang} icon={<Save className="size-4" />} onClick={() => chay(() => luuChangBuoc(id, dong, dau))}>
              {t("changBuoc.nutLuu")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={dang}
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (window.confirm(t("changBuoc.xacNhanXoa"))) chay(() => xoaChangBuoc(id));
              }}
            >
              {t("changBuoc.nutXoa")}
            </Button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{t("changBuoc.goiYApDung")}</p>
        </div>
      )}
    </div>
  );
}
