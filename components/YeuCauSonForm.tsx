"use client";

import { useMemo, useState, useTransition } from "react";
import { ListPlus, Paintbrush, Plus, Send, Trash2 } from "lucide-react";
import { guiYeuCauSon } from "@/app/yeu-cau-son-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { soThieuDinhMuc, type DongFormSon } from "@/lib/yeuCauSon";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Table, TableWrap, Td, Th, Tr } from "@/components/ui";

/** Một loại sơn trong danh mục, kèm tồn và định mức của tàu đang lập. */
export type SonChon = { id: number; label: string; code: string; uom: string; ton: number; minQty: number };

/** Điền sẵn từ phiếu MLS-11-05 đã tải (?tuTep=<id>). */
export type DienSonTuFile = {
  tepId: number;
  ten: string;
  dong: DongFormSon[];
  purpose: string;
  requiredDate: string;
  khop: number;
  moi: number;
  thieuSo: number;
  canhBao: number;
};

type Dong = DongFormSon & { k: number };

const dongTrong = (k: number): Dong => ({ k, paintProductId: "", ten: "", ma: "", dvt: "", soLuong: "", ghiChu: "", robFile: "" });

/**
 * Lập yêu cầu cấp sơn của một tàu: thêm dòng từ danh mục sơn (đề xuất sẵn phần
 * thiếu so với định mức), gõ thêm sơn ngoài danh mục, hoặc soát các dòng điền
 * sẵn từ phiếu MLS-11-05. Gửi là trình luôn lên người duyệt cấp tàu.
 */
export default function YeuCauSonForm({
  vesselId,
  son,
  nguoiDuyet,
  banDau,
}: {
  vesselId: number;
  son: SonChon[];
  /** Tên chức danh duyệt kế tiếp (Thuyền trưởng / Công ty) — hiện trên nút gửi. */
  nguoiDuyet: string;
  banDau?: DienSonTuFile;
}) {
  const { t } = useNgonNgu();
  const [dem, setDem] = useState(() => (banDau?.dong.length ?? 0) + 1);
  const [dong, setDong] = useState<Dong[]>(() => (banDau?.dong ?? []).map((d, i) => ({ ...d, k: i + 1 })));
  const [purpose, setPurpose] = useState(banDau?.purpose ?? "");
  const [priority, setPriority] = useState("NORMAL");
  const [requiredDate, setRequiredDate] = useState(banDau?.requiredDate ?? "");
  const [chiThieu, setChiThieu] = useState(() => son.some((s) => soThieuDinhMuc(s.ton, s.minQty) > 0));
  const [loi, setLoi] = useState("");
  const [dang, chuyen] = useTransition();

  const sonTheoId = useMemo(() => new Map(son.map((s) => [String(s.id), s])), [son]);
  const daChon = new Set(dong.map((d) => d.paintProductId).filter(Boolean));
  const hienThi = chiThieu ? son.filter((s) => soThieuDinhMuc(s.ton, s.minQty) > 0) : son;

  const them = (ds: SonChon[]) => {
    const moi = ds.filter((s) => !daChon.has(String(s.id)));
    if (!moi.length) return;
    setDong((cu) => [
      ...cu,
      ...moi.map((s, i) => {
        const goiY = soThieuDinhMuc(s.ton, s.minQty);
        return { ...dongTrong(dem + i), paintProductId: String(s.id), soLuong: goiY > 0 ? String(goiY) : "" };
      }),
    ]);
    setDem((n) => n + moi.length);
  };
  const sua = (k: number, truong: keyof DongFormSon, giaTri: string) => setDong((cu) => cu.map((d) => (d.k === k ? { ...d, [truong]: giaTri } : d)));

  const gui = () => {
    setLoi("");
    chuyen(async () => {
      const kq = await guiYeuCauSon({ vesselId, tuTep: banDau?.tepId ?? null, purpose, priority, requiredDate, dong });
      // Thành công thì server chuyển trang (redirect); về tới đây là có lỗi.
      if (kq?.message) setLoi(kq.message);
    });
  };

  return (
    <div className="space-y-4">
      {banDau && (
        <Notice tone={banDau.thieuSo || banDau.canhBao ? "warning" : "info"}>
          <p>{t("paint.ycDaDien", { ten: banDau.ten, n: banDau.dong.length, khop: banDau.khop, moi: banDau.moi })}</p>
          {banDau.thieuSo > 0 && <p>{t("requests.tepThieuSo", { n: banDau.thieuSo })}</p>}
          {banDau.canhBao > 0 && <p>{t("requests.tepCanhBao", { n: banDau.canhBao })}</p>}
        </Notice>
      )}

      <Card>
        <details open={!banDau} className="group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <CardHeader icon={<ListPlus className="size-4" />} title={t("paint.ycChonTuDanhMuc")} subtitle={t("paint.ycChonTuDanhMucMoTa")} />
          </summary>
          {son.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t("paint.ycChuaCoDanhMuc")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={chiThieu} onChange={(e) => setChiThieu(e.target.checked)} className="size-4 accent-brand-600" />
                  {t("paint.chiHienDuoiDinhMuc")}
                </label>
                <Button type="button" size="sm" icon={<Plus className="size-4" />} disabled={!hienThi.some((s) => !daChon.has(String(s.id)))} onClick={() => them(hienThi)}>
                  {t("paint.ycThemTatCa", { n: hienThi.filter((s) => !daChon.has(String(s.id))).length })}
                </Button>
              </div>
              {hienThi.length === 0 ? (
                <Notice tone="success">{t("paint.khongCoLoaiDuoiDinhMuc")}</Notice>
              ) : (
                <TableWrap>
                  <Table dense>
                    <thead>
                      <tr>
                        <Th>{t("paint.loaiSon")}</Th>
                        <Th>{t("chung.donVi")}</Th>
                        <Th align="right">{t("paint.cotTon")}</Th>
                        <Th align="right">{t("paint.cotDinhMuc")}</Th>
                        <Th align="right">{t("paint.ycDeXuat")}</Th>
                        <Th>{""}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {hienThi.map((s) => {
                        const goiY = soThieuDinhMuc(s.ton, s.minQty);
                        const co = daChon.has(String(s.id));
                        return (
                          <Tr key={s.id}>
                            <Td>
                              {s.label}
                              <span className="ml-2 font-display text-xs text-[var(--text-muted)]">{s.code}</span>
                            </Td>
                            <Td>
                              <span className="text-xs text-[var(--text-secondary)]">{s.uom}</span>
                            </Td>
                            <Td align="right">
                              <span className={goiY > 0 ? "font-medium text-[var(--text-warning)]" : undefined}>{s.ton}</span>
                            </Td>
                            <Td align="right">
                              <span className="text-[var(--text-muted)]">{s.minQty > 0 ? s.minQty : "—"}</span>
                            </Td>
                            <Td align="right">{goiY > 0 ? goiY : "—"}</Td>
                            <Td>
                              <Button type="button" size="sm" variant={co ? "ghost" : "secondary"} disabled={co} onClick={() => them([s])}>
                                {co ? t("paint.ycDaThem") : t("paint.ycThem")}
                              </Button>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </div>
          )}
        </details>
      </Card>

      <Card>
        <CardHeader icon={<Paintbrush className="size-4" />} title={t("paint.ycDanhSachXin", { n: dong.length })} />
        <div className="space-y-3">
          {dong.length === 0 && <p className="text-sm text-[var(--text-secondary)]">{t("paint.ycChuaCoDong")}</p>}
          {dong.map((d, i) => {
            const s = d.paintProductId ? sonTheoId.get(d.paintProductId) : undefined;
            return (
              <div key={d.k} className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">{t("requests.dongThu", { n: i + 1 })}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {s ? t("paint.ycTonTau", { n: s.ton, dvt: s.uom }) : d.robFile ? t("requests.tepRobFile", { n: d.robFile }) : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="size-4" />}
                    className="ml-auto text-[var(--text-danger)]"
                    onClick={() => setDong((cu) => cu.filter((x) => x.k !== d.k))}
                  >
                    {t("requests.xoaDong")}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <Select value={d.paintProductId} onChange={(e) => sua(d.k, "paintProductId", e.target.value)} className="md:col-span-3" aria-label={t("paint.loaiSon")}>
                    <option value="">{t("paint.ycNgoaiDanhMuc")}</option>
                    {son.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} — {x.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={d.soLuong}
                    onChange={(e) => sua(d.k, "soLuong", e.target.value)}
                    placeholder={`${t("requests.slYeuCau")}${s ? ` (${s.uom})` : ""}`}
                    className="tabular"
                    aria-label={t("requests.slYeuCau")}
                  />
                  <Input value={d.ghiChu} onChange={(e) => sua(d.k, "ghiChu", e.target.value)} placeholder={t("chung.ghiChu")} className="md:col-span-2" />
                </div>
                {!d.paintProductId && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                    <Input value={d.ten} onChange={(e) => sua(d.k, "ten", e.target.value)} placeholder={t("paint.ycTenSon")} className="md:col-span-3" />
                    <Input value={d.ma} onChange={(e) => sua(d.k, "ma", e.target.value)} placeholder={t("paint.ycMaSon")} />
                    <Input value={d.dvt} onChange={(e) => sua(d.k, "dvt", e.target.value)} placeholder={t("requests.phDvt")} />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={d.robFile}
                      onChange={(e) => sua(d.k, "robFile", e.target.value)}
                      placeholder="R.O.B"
                      className="tabular"
                      aria-label="R.O.B"
                    />
                  </div>
                )}
                {d.goiY && <p className="text-xs text-[var(--text-muted)]">{d.goiY}</p>}
              </div>
            );
          })}
          <Button
            type="button"
            icon={<Plus className="size-4" />}
            onClick={() => {
              setDong((cu) => [...cu, dongTrong(dem)]);
              setDem((n) => n + 1);
            }}
          >
            {t("paint.ycThemNgoaiDanhMuc")}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={t("paint.lyDoMucDich")} className="md:col-span-2">
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("paint.phLyDo")} />
          </Field>
          <Field label={t("paint.mucUuTien")}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["NORMAL", "HIGH", "URGENT", "LOW"].map((p) => (
                <option key={p} value={p}>
                  {t(`labels.priority_${p as "NORMAL" | "HIGH" | "URGENT" | "LOW"}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("chung.ngay")}>
            <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" loading={dang} disabled={!dong.length} icon={<Send className="size-4" />} onClick={gui}>
            {dang ? t("paint.dangGui") : t("paint.ycNutGui", { nguoi: nguoiDuyet })}
          </Button>
          {loi && <Notice tone="danger">{loi}</Notice>}
        </div>
      </Card>
    </div>
  );
}
