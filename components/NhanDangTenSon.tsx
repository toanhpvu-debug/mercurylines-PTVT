"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ScanText } from "lucide-react";
import { apDungNhanDangSon } from "@/app/ton-son-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import { deXuatThongTinSon } from "@/lib/tenSon";
import { Badge, Button, Notice } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import { baoTonSon } from "@/components/ThaoTacTonSon";

/*
 * "Nhận dạng tên sơn": loại sơn nhập từ phiếu giao thường mang nguyên chuỗi của
 * phiếu ("SON JOTAFIX PU TC RAL 5002 A 17.91L") — bảng tồn toàn "Khác", không màu,
 * bản in MLS-11-05 thì mô tả lộn xộn. Hộp này đề xuất tên chuẩn + hãng + hệ sơn +
 * màu / mã màu + dung tích thùng (lib/tenSon.ts), người dùng sửa / bỏ tick từng
 * dòng rồi áp dụng một lần (app/ton-son-actions.ts apDungNhanDangSon). Số tồn không đổi.
 */

export type LoaiSonNhanDang = {
  productId: number;
  name: string;
  maker: string | null;
  paintType: string;
  colorName: string | null;
  colorCode: string | null;
  packSize: number;
  uom: string;
  /** Được sửa: loại sơn chỉ dùng ở tàu này, hoặc người xem là thuyền trưởng / quản trị. */
  suaDuoc: boolean;
};

type Dong = {
  productId: number;
  goc: string;
  uom: string;
  suaDuoc: boolean;
  chon: boolean;
  name: string;
  maker: string;
  paintType: string;
  colorCode: string;
  colorName: string;
  packSize: string;
};

const O = "w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm disabled:opacity-60";

export default function NhanDangTenSon({ vesselId, ds }: { vesselId: number; ds: LoaiSonNhanDang[] }) {
  const { t, tTuDo } = useNgonNgu();
  const deXuat = useMemo(
    () =>
      ds
        .map((p) => ({ p, d: deXuatThongTinSon(p) }))
        .filter(({ d }) => d.coDoi)
        .map(
          ({ p, d }): Dong => ({
            productId: p.productId,
            goc: p.name,
            uom: p.uom,
            suaDuoc: p.suaDuoc,
            chon: p.suaDuoc,
            name: d.name,
            maker: d.maker ?? "",
            paintType: d.paintType,
            colorCode: d.colorCode ?? "",
            colorName: d.colorName ?? "",
            packSize: d.packSize > 0 ? String(d.packSize) : "",
          })
        ),
    [ds]
  );
  const [mo, setMo] = useState(false);
  const [dong, setDong] = useState<Dong[]>([]);
  const [loi, setLoi] = useState("");
  const [dang, chay] = useTransition();
  if (!deXuat.length) return null;

  const doi = (i: number, patch: Partial<Dong>) => setDong((x) => x.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const soChon = dong.filter((d) => d.chon && d.suaDuoc).length;
  const apDung = () =>
    chay(async () => {
      const r = await apDungNhanDangSon(
        vesselId,
        dong
          .filter((d) => d.chon && d.suaDuoc)
          .map((d) => ({
            productId: d.productId,
            name: d.name,
            maker: d.maker,
            paintType: d.paintType,
            colorCode: d.colorCode,
            colorName: d.colorName,
            uom: d.uom,
            packSize: d.packSize.trim() ? Number(d.packSize.replace(",", ".")) : 0,
          }))
      );
      if (r.success) {
        setMo(false);
        baoTonSon("ton", r.message);
      } else setLoi(r.message);
    });

  return (
    <>
      <Button
        type="button"
        size="sm"
        icon={<ScanText className="size-4" />}
        onClick={() => {
          setDong(deXuat);
          setLoi("");
          setMo(true);
        }}
      >
        {t("paint.ndNut")}
        <Badge tone="info">{deXuat.length}</Badge>
      </Button>
      {mo && (
        <Modal open onClose={() => setMo(false)} width="max-w-7xl" title={t("paint.ndTieuDe")}>
          <div className="space-y-4 text-left">
            <p className="text-sm text-[var(--text-secondary)]">{t("paint.ndMoTa")}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-secondary)]">
                    <th className="p-1">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={dong.filter((d) => d.suaDuoc).every((d) => d.chon)}
                        onChange={(e) => setDong((x) => x.map((d) => (d.suaDuoc ? { ...d, chon: e.target.checked } : d)))}
                        aria-label={t("paint.ndChonTatCa")}
                      />
                    </th>
                    <th className="p-1">{t("paint.ndCotTen")}</th>
                    <th className="p-1">{t("paint.hangSanXuat")}</th>
                    <th className="p-1">{t("paint.kieuSon")}</th>
                    <th className="p-1">{t("paint.maMau")}</th>
                    <th className="p-1">{t("paint.tenMau")}</th>
                    <th className="p-1">{t("paint.ndCotDungTich")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dong.map((d, i) => (
                    <tr key={d.productId} className={`border-t border-[var(--border-subtle)] align-top ${d.chon ? "" : "opacity-60"}`}>
                      <td className="p-1 pt-2">
                        <input type="checkbox" className="size-4 accent-brand-600" checked={d.chon} disabled={!d.suaDuoc} onChange={(e) => doi(i, { chon: e.target.checked })} aria-label={d.goc} />
                      </td>
                      <td className="min-w-72 p-1">
                        <input className={O} value={d.name} disabled={!d.suaDuoc} onChange={(e) => doi(i, { name: e.target.value })} aria-label={t("paint.ndCotTen")} />
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{t("paint.ndTenDangGhi", { ten: d.goc })}</span>
                        {!d.suaDuoc && <span className="mt-0.5 block text-xs text-[var(--text-warning)]">{t("paint.tsKhoaDungChung")}</span>}
                      </td>
                      <td className="w-32 p-1">
                        <input className={O} value={d.maker} disabled={!d.suaDuoc} onChange={(e) => doi(i, { maker: e.target.value })} aria-label={t("paint.hangSanXuat")} />
                      </td>
                      <td className="w-44 p-1">
                        <select className={O} value={d.paintType} disabled={!d.suaDuoc} onChange={(e) => doi(i, { paintType: e.target.value })} aria-label={t("paint.kieuSon")}>
                          {Object.keys(PAINT_TYPE_LABEL).map((v) => (
                            <option key={v} value={v}>
                              {tTuDo(`paint.loaiSon_${v}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="w-28 p-1">
                        <input className={O} value={d.colorCode} disabled={!d.suaDuoc} onChange={(e) => doi(i, { colorCode: e.target.value })} aria-label={t("paint.maMau")} />
                      </td>
                      <td className="w-28 p-1">
                        <input className={O} value={d.colorName} disabled={!d.suaDuoc} onChange={(e) => doi(i, { colorName: e.target.value })} aria-label={t("paint.tenMau")} />
                      </td>
                      <td className="w-24 p-1">
                        <input
                          className={`${O} tabular text-right`}
                          value={d.packSize}
                          inputMode="decimal"
                          disabled={!d.suaDuoc}
                          onChange={(e) => doi(i, { packSize: e.target.value })}
                          aria-label={t("paint.ndCotDungTich")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loi && <Notice tone="danger">{loi}</Notice>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
              <Button type="button" variant="ghost" onClick={() => setMo(false)}>
                {t("chung.huy")}
              </Button>
              <Button type="button" variant="primary" loading={dang} disabled={soChon === 0} icon={<Check className="size-4" />} onClick={apDung}>
                {t("paint.ndNutApDung", { n: soChon })}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
