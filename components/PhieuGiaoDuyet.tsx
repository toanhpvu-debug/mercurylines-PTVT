"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, Save, Sparkles, Trash2, XCircle } from "lucide-react";
import {
  docLaiPhieuGiaoBangAi,
  duyetPhieuGiao,
  luuDongPhieuGiao,
  tuChoiPhieuGiao,
  xoaPhieuGiao,
} from "@/app/phieu-giao-actions";
import type { DongNhap, ThongTinPhieuNhap } from "@/lib/phieuGiao";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, FIELD, Field, Input, Notice, Select, TableWrap, Textarea } from "@/components/ui";

export type DongHienThi = DongNhap & { materialLabel: string | null };

export type PhieuHienThi = {
  id: number;
  fileName: string;
  nhaCungCap: string;
  soPhieu: string;
  ngayGiao: string;
  ghiChu: string;
  status: string;
  nguonChu: string;
  chuDoc: string | null;
  approvedBy: string | null;
  approvedAtChuoi: string | null;
  lyDoTuChoi: string | null;
};

/**
 * Trang đối chiếu: bảng dòng hàng sửa được (trái) cạnh bản scan (phải). Mọi nút
 * ghi đều gọi server action; server kiểm quyền lại — giao diện chỉ ẩn/hiện nút
 * cho khỏi rối, không phải hàng rào.
 */
export default function PhieuGiaoDuyet({
  phieu,
  dongBanDau,
  warehouses,
  coQuyenDuyet,
  coQuyenSua,
  thongBaoDoc,
  aiBat,
}: {
  phieu: PhieuHienThi;
  dongBanDau: DongHienThi[];
  warehouses: { id: number; label: string }[];
  coQuyenDuyet: boolean;
  coQuyenSua: boolean;
  thongBaoDoc: { tone: "info" | "warning" | "success"; text: string } | null;
  /** Máy chủ đã có khóa Claude API — hiện nút "Đọc lại bằng AI". */
  aiBat: boolean;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dong, setDong] = useState<DongHienThi[]>(dongBanDau);
  const [thongTin, setThongTin] = useState<ThongTinPhieuNhap>({
    nhaCungCap: phieu.nhaCungCap,
    soPhieu: phieu.soPhieu,
    ngayGiao: phieu.ngayGiao,
    ghiChu: phieu.ghiChu,
  });
  const [warehouseId, setWarehouseId] = useState<string>(warehouses.length === 1 ? String(warehouses[0].id) : "");
  const [thongBao, setThongBao] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  /** Trang bản scan đang mở trong khung xem — bấm "tr.N" ở dòng để nhảy tới. */
  const [trangXem, setTrangXem] = useState<number | null>(null);
  const daXuLy = phieu.status !== "CHO_DUYET";
  const khoaSua = daXuLy || !coQuyenSua || pending;
  const tenPhieu = phieu.soPhieu || phieu.fileName;
  const soCanKiem = dong.filter((d) => d.canhBao).length;

  // Sửa một ô nội dung là người duyệt đã nhìn dòng đó → gỡ cảnh báo.
  const O_NOI_DUNG = ["ten", "partNo", "impa", "soLuong", "donVi", "loai", "thietBi"];
  const capNhat = (i: number, patch: Partial<DongHienThi>) =>
    setDong((ds) =>
      ds.map((d, j) =>
        j === i ? { ...d, ...patch, ...(Object.keys(patch).some((k) => O_NOI_DUNG.includes(k)) ? { canhBao: null } : {}) } : d
      )
    );
  const themDong = () =>
    setDong((ds) => [
      ...ds,
      {
        chon: true,
        ten: "",
        partNo: "",
        impa: "",
        soLuong: "1",
        donVi: "PCS",
        loai: "SPARE",
        thietBi: "",
        materialId: null,
        materialLabel: null,
        tenEn: null,
        trang: null,
        canhBao: null,
      },
    ]);
  const xoaDong = (i: number) => setDong((ds) => ds.filter((_, j) => j !== i));
  const goiDong = (): DongNhap[] =>
    dong.map((d) => ({
      id: d.id,
      chon: d.chon,
      ten: d.ten,
      partNo: d.partNo,
      impa: d.impa,
      soLuong: d.soLuong,
      donVi: d.donVi,
      loai: d.loai,
      thietBi: d.thietBi,
      materialId: d.materialId,
      chuGoc: d.chuGoc,
      tenEn: d.tenEn ?? null,
      trang: d.trang ?? null,
      canhBao: d.canhBao ?? null,
    }));

  const chay = (viec: () => Promise<{ message: string; success?: boolean }>, sauKhiXong?: () => void) =>
    startTransition(async () => {
      setThongBao(null);
      try {
        const r = await viec();
        setThongBao({ tone: r.success ? "success" : "danger", text: r.message });
        if (r.success) {
          sauKhiXong?.();
          router.refresh();
        }
      } catch (e) {
        // redirect() của server action ném NEXT_REDIRECT — để Next xử lý.
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
        setThongBao({ tone: "danger", text: String((e as Error)?.message ?? e) });
      }
    });

  const luu = () => chay(() => luuDongPhieuGiao(phieu.id, thongTin, goiDong()));
  const duyet = () => {
    const chon = dong.filter((d) => d.chon);
    const coSo = chon.filter((d) => Number(String(d.soLuong).replace(",", ".")) > 0).length;
    const kho = warehouses.find((w) => String(w.id) === warehouseId);
    const ok = window.confirm(
      t("phieuGiao.xacNhanDuyet", {
        n: chon.length,
        phieu: tenPhieu,
        kho: kho ? t("phieuGiao.xacNhanDuyetCoKho", { so: coSo, kho: kho.label }) : "",
      })
    );
    if (!ok) return;
    chay(() => duyetPhieuGiao(phieu.id, thongTin, goiDong(), warehouseId ? Number(warehouseId) : null));
  };
  const tuChoi = () => {
    const lyDo = window.prompt(t("phieuGiao.lyDoTuChoi"), "");
    if (lyDo === null) return;
    chay(() => tuChoiPhieuGiao(phieu.id, lyDo));
  };
  const xoaPhieu = () => {
    if (!window.confirm(t("phieuGiao.xacNhanXoaPhieu", { phieu: tenPhieu }))) return;
    chay(() => xoaPhieuGiao(phieu.id));
  };
  const docLaiAi = () => {
    if (!window.confirm(t("phieuGiao.xacNhanDocLaiAi", { phieu: tenPhieu }))) return;
    startTransition(async () => {
      // AI đọc bản scan nhiều trang mất tới cả phút — báo để người dùng không bấm lại.
      setThongBao({ tone: "info", text: t("phieuGiao.aiDangDoc") });
      try {
        const r = await docLaiPhieuGiaoBangAi(phieu.id);
        setThongBao({ tone: r.success ? "success" : "danger", text: r.message });
        if (r.success && r.dong) {
          setDong(r.dong);
          if (r.thongTin) setThongTin(r.thongTin);
          router.refresh();
        }
      } catch (e) {
        setThongBao({ tone: "danger", text: String((e as Error)?.message ?? e) });
      }
    });
  };

  const oNho = `${FIELD} px-2 py-1 text-sm`;
  const duongDanTep = `/api/phieu-giao/${phieu.id}/file`;

  return (
    <div className="space-y-4">
      {thongBaoDoc && !daXuLy && <Notice tone={thongBaoDoc.tone}>{thongBaoDoc.text}</Notice>}
      {daXuLy && (
        <Notice tone={phieu.status === "DA_DUYET" ? "success" : "warning"}>
          {t("phieuGiao.phieuDaXuLy", { trangThai: tTuDo(`phieuGiao.trangThai_${phieu.status}`) })}{" "}
          {phieu.status === "DA_DUYET" && phieu.approvedBy
            ? t("phieuGiao.duyetBoi", { nguoi: phieu.approvedBy, luc: phieu.approvedAtChuoi ?? "" })
            : null}
          {phieu.status === "TU_CHOI" ? t("phieuGiao.tuChoiBoi", { lyDo: phieu.lyDoTuChoi ?? "—" }) : null}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t("phieuGiao.oNhaCungCap")}>
              <Input value={thongTin.nhaCungCap} disabled={khoaSua} maxLength={200}
                onChange={(e) => setThongTin({ ...thongTin, nhaCungCap: e.target.value })} />
            </Field>
            <Field label={t("phieuGiao.oSoPhieu")}>
              <Input value={thongTin.soPhieu} disabled={khoaSua} maxLength={80}
                onChange={(e) => setThongTin({ ...thongTin, soPhieu: e.target.value })} />
            </Field>
            <Field label={t("phieuGiao.oNgayGiao")}>
              <Input type="date" value={thongTin.ngayGiao} disabled={khoaSua}
                onChange={(e) => setThongTin({ ...thongTin, ngayGiao: e.target.value })} />
            </Field>
          </div>
          <Field label={t("phieuGiao.oGhiChu")}>
            <Textarea rows={2} value={thongTin.ghiChu} disabled={khoaSua} maxLength={1000}
              onChange={(e) => setThongTin({ ...thongTin, ghiChu: e.target.value })} />
          </Field>

          {!daXuLy && soCanKiem > 0 && (
            <Notice tone="warning">
              {t("phieuGiao.soDongCanKiem", { k: soCanKiem })} {t("phieuGiao.canhBaoGoiY")}
            </Notice>
          )}
          <TableWrap>
            <table className="w-full min-w-[880px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-2 py-2">{t("phieuGiao.cotChon")}</th>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2 w-[26%]">{t("phieuGiao.cotTen")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotPartNo")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotImpa")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotSoLuong")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotDonVi")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotLoai")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotThietBi")}</th>
                  <th className="px-2 py-2">{t("phieuGiao.cotKhop")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {dong.map((d, i) => (
                  <tr
                    key={d.id ?? `moi-${i}`}
                    title={d.chuGoc ?? undefined}
                    className={`border-t border-[var(--border-subtle)] align-top ${d.chon ? "" : "opacity-50"} ${
                      d.canhBao ? "bg-amber-500/10" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={d.chon} disabled={khoaSua}
                        onChange={(e) => capNhat(i, { chon: e.target.checked })} className="size-4" />
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[var(--text-muted)]">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="inline-flex items-center gap-1">
                          {i + 1}
                          {d.canhBao && (
                            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" aria-label={d.canhBao} />
                          )}
                        </span>
                        {d.trang ? (
                          <button
                            type="button"
                            onClick={() => setTrangXem(d.trang ?? null)}
                            className="text-[11px] text-brand-700 hover:underline dark:text-brand-300"
                            title={t("phieuGiao.nhayTrang", { n: d.trang })}
                          >
                            tr.{d.trang}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={oNho} value={d.ten} disabled={khoaSua} maxLength={200}
                        onChange={(e) => capNhat(i, { ten: e.target.value })} />
                      {d.tenEn && d.tenEn !== d.ten && (
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]" title={d.tenEn}>
                          {d.tenEn}
                        </div>
                      )}
                      {d.canhBao && (
                        <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">{d.canhBao}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={oNho} value={d.partNo} disabled={khoaSua} maxLength={80}
                        onChange={(e) => capNhat(i, { partNo: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${oNho} w-24`} value={d.impa} disabled={khoaSua} maxLength={20}
                        onChange={(e) => capNhat(i, { impa: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${oNho} w-20 text-right tabular-nums`} inputMode="decimal" value={String(d.soLuong)}
                        disabled={khoaSua} onChange={(e) => capNhat(i, { soLuong: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${oNho} w-20 uppercase`} value={d.donVi} disabled={khoaSua} maxLength={20}
                        onChange={(e) => capNhat(i, { donVi: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className={`${oNho} w-28`} value={d.loai} disabled={khoaSua}
                        onChange={(e) => capNhat(i, { loai: e.target.value === "STORE" ? "STORE" : "SPARE" })}>
                        <option value="SPARE">{tTuDo("labels.typeLong_SPARE")}</option>
                        <option value="STORE">{tTuDo("labels.typeLong_STORE")}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={oNho} value={d.thietBi} disabled={khoaSua} maxLength={120}
                        onChange={(e) => capNhat(i, { thietBi: e.target.value })} />
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {d.materialId && d.materialLabel ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300" title={d.materialLabel}>
                          <CheckCircle2 className="size-3.5" />
                          {t("phieuGiao.khopCoSan")}
                          <span className="font-mono">{d.materialLabel.split(" — ")[0]}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">{t("phieuGiao.khopMoi")}</span>
                      )}
                    </td>
                    <td className="px-1 py-1.5">
                      {!khoaSua && (
                        <button type="button" onClick={() => xoaDong(i)} title={t("phieuGiao.nutXoaDong")}
                          className="rounded-md p-1 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-600">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {!daXuLy && coQuyenSua && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={themDong} disabled={pending} icon={<Plus className="size-4" />}>
                {t("phieuGiao.nutThemDong")}
              </Button>
              <Button type="button" onClick={luu} loading={pending} icon={<Save className="size-4" />}>
                {t("phieuGiao.nutLuuDong")}
              </Button>
              {aiBat && (
                <Button type="button" onClick={docLaiAi} loading={pending} icon={<Sparkles className="size-4" />}>
                  {t("phieuGiao.nutDocLaiAi")}
                </Button>
              )}
              <Button type="button" onClick={xoaPhieu} disabled={pending} variant="ghost" icon={<Trash2 className="size-4" />}>
                {t("phieuGiao.nutXoaPhieu")}
              </Button>
            </div>
          )}

          {!daXuLy && coQuyenDuyet && (
            <div className="rounded-xl border border-brand-500/30 bg-brand-500/8 p-4 space-y-3">
              <Field label={t("phieuGiao.khoNhap")} hint={t("phieuGiao.khoNhapMoTa")}>
                <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={pending}>
                  <option value="">{t("phieuGiao.khongGhiTon")}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" onClick={duyet} loading={pending} icon={<CheckCircle2 className="size-4" />}>
                  {t("phieuGiao.nutDuyet")}
                </Button>
                <Button type="button" variant="danger" onClick={tuChoi} disabled={pending} icon={<XCircle className="size-4" />}>
                  {t("phieuGiao.nutTuChoi")}
                </Button>
              </div>
            </div>
          )}
          {thongBao && <Notice tone={thongBao.tone}>{thongBao.text}</Notice>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("phieuGiao.xemPdf")}</p>
            <a href={duongDanTep} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300">
              <ExternalLink className="size-4" />
              {phieu.fileName}
            </a>
          </div>
          <iframe
            key={trangXem ?? 0}
            src={trangXem ? `${duongDanTep}#page=${trangXem}` : duongDanTep}
            title={phieu.fileName}
            className="h-[70vh] w-full rounded-xl border border-[var(--border-subtle)] bg-white"
          />
          {phieu.chuDoc && (
            <details className="rounded-xl border border-[var(--border-subtle)] p-3">
              <summary className="cursor-pointer text-sm font-medium text-[var(--text-secondary)]">
                {t("phieuGiao.chuDocDuoc")} · {tTuDo(`phieuGiao.nguon_${phieu.nguonChu}`)}
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{phieu.chuDoc}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
