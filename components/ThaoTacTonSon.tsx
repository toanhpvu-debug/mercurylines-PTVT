"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { goDongTonSon, suaDongTonSon, xoaGiaoDichSon, type KetQuaTonSon } from "@/app/ton-son-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import { soIn } from "@/lib/tonSon";
import { cn } from "@/lib/cn";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal } from "@/components/ui-client";

/*
 * Sửa / gỡ sơn ĐÃ NHẬP ngay trên trang sơn của tàu:
 *   - bảng Tồn sơn: Sửa (số đang có + lý do, tối thiểu, tên/hãng/màu/ĐVT) và Gỡ
 *     (giữ lịch sử, hoặc xóa hẳn khi nhập nhầm);
 *   - Lịch sử nhập/xuất: xóa một dòng nhập/xuất tay nhầm, tồn được hoàn lại.
 * Server action ở app/ton-son-actions.ts.
 */

const BAO = "mercury:ton-son-bao";
type Kenh = "ton" | "lich-su";

/** Báo kết quả lên đầu bảng (ThongBaoTonSon cùng kênh) — dùng chung cho các hộp thoại sửa tồn sơn. */
export function baoTonSon(kenh: Kenh, chu: string) {
  bao(kenh, chu);
}

function bao(kenh: Kenh, chu: string) {
  window.dispatchEvent(new CustomEvent(BAO, { detail: { kenh, chu } }));
}

/**
 * Câu báo kết quả của thao tác sửa/gỡ. Dòng vừa gỡ biến khỏi bảng (cả nút lẫn hộp
 * thoại của nó) nên câu báo phải nằm ở chỗ khác dòng — đây: đầu bảng.
 */
export function ThongBaoTonSon({ kenh }: { kenh: Kenh }) {
  const [chu, setChu] = useState("");
  useEffect(() => {
    let hen: number | undefined;
    const nghe = (e: Event) => {
      const d = (e as CustomEvent<{ kenh: Kenh; chu: string }>).detail;
      if (d?.kenh !== kenh) return;
      setChu(d.chu);
      window.clearTimeout(hen);
      hen = window.setTimeout(() => setChu(""), 10000);
    };
    window.addEventListener(BAO, nghe);
    return () => {
      window.removeEventListener(BAO, nghe);
      window.clearTimeout(hen);
    };
  }, [kenh]);
  if (!chu) return null;
  return (
    <div role="status" aria-live="polite" className="mb-3 print:hidden">
      <Notice tone="success" className="flex items-start gap-2">
        <span className="flex-1">{chu}</span>
        <button type="button" onClick={() => setChu("")} aria-label="close" className="rounded p-0.5 opacity-70 hover:opacity-100">
          <X className="size-4" />
        </button>
      </Notice>
    </div>
  );
}

export type DongTonSonSua = {
  vesselId: number;
  productId: number;
  ten: string;
  hang: string | null;
  loai: string;
  mau: string | null;
  maMau: string | null;
  dvt: string;
  dungTich: number;
  soLuong: number;
  minQty: number;
  /** Được sửa tên/hãng/màu: loại sơn chỉ dùng ở tàu này, hoặc người xem là thuyền trưởng/quản trị. */
  suaSanPham: boolean;
  /** Loại sơn đang dùng ở tàu khác — sửa thông tin là đổi cho cả tàu đó. */
  dungChung: boolean;
  /** Số lần thi công trên tàu đã dùng sơn này — có thì không xóa hẳn được. */
  soThiCong: number;
};

/** Nút Sửa · Gỡ của một dòng trong bảng Tồn sơn. */
export default function ThaoTacTonSon({ dong }: { dong: DongTonSonSua }) {
  const { t } = useNgonNgu();
  const [mo, setMo] = useState<"sua" | "go" | null>(null);
  const [loi, setLoi] = useState("");
  const chay =
    (fn: (p: KetQuaTonSon, fd: FormData) => Promise<KetQuaTonSon>) =>
    async (prev: KetQuaTonSon, fd: FormData) => {
      const r = await fn(prev, fd);
      if (r.success) {
        setMo(null);
        bao("ton", r.message);
      } else setLoi(r.message);
      return r;
    };
  const [, suaAction, suaPending] = useActionState(chay(suaDongTonSon), { message: "" });
  const [, goAction, goPending] = useActionState(chay(goDongTonSon), { message: "" });
  const moHop = (h: "sua" | "go") => {
    setLoi("");
    setMo(h);
  };

  return (
    <div className="flex justify-end gap-1 print:hidden">
      <Button type="button" size="sm" variant="ghost" onClick={() => moHop("sua")} icon={<Pencil className="size-4" />} title={t("paint.tsTieuDeSua", { ten: dong.ten })}>
        {t("chung.sua")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => moHop("go")} icon={<Trash2 className="size-4" />} title={t("paint.tsTieuDeGo", { ten: dong.ten })}>
        {t("paint.tsNutGo")}
      </Button>
      {mo === "sua" && <HopSua dong={dong} action={suaAction} pending={suaPending} loi={loi} onClose={() => setMo(null)} />}
      {mo === "go" && <HopGo dong={dong} action={goAction} pending={goPending} loi={loi} onClose={() => setMo(null)} />}
    </div>
  );
}

function HopSua({
  dong,
  action,
  pending,
  loi,
  onClose,
}: {
  dong: DongTonSonSua;
  action: (fd: FormData) => void;
  pending: boolean;
  loi: string;
  onClose: () => void;
}) {
  const { t, tTuDo } = useNgonNgu();
  const [soMoi, setSoMoi] = useState(String(dong.soLuong));
  const n = Number(soMoi.replace(",", "."));
  const doiSo = soMoi.trim() !== "" && Number.isFinite(n) && Math.abs(n - dong.soLuong) > 1e-9;
  const khoa = !dong.suaSanPham;

  return (
    <Modal open onClose={onClose} width="max-w-2xl" title={t("paint.tsTieuDeSua", { ten: dong.ten })}>
      <form action={action} className="space-y-5 text-left">
        <input type="hidden" name="vesselId" value={dong.vesselId} />
        <input type="hidden" name="productId" value={dong.productId} />
        {/* Số đúng như đang lưu (không làm tròn) — server chỉ ghi khi số trên tàu chưa đổi. */}
        <input type="hidden" name="soLuongCu" value={String(dong.soLuong)} />
        <input type="hidden" name="suaSanPham" value={khoa ? "0" : "1"} />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("paint.tsSoLuongTrenTau")}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={`${t("paint.tsSoLuongDangCo")} (${dong.dvt}) *`} hint={t("paint.tsDangGhi", { so: soIn(dong.soLuong), dv: dong.dvt })}>
              <Input name="soLuong" type="number" step="any" min="0" required value={soMoi} onChange={(e) => setSoMoi(e.target.value)} className="tabular" />
            </Field>
            <Field label={`${t("paint.cotToiThieu")} (${dong.dvt})`}>
              <Input name="minQty" type="number" step="any" min="0" defaultValue={dong.minQty || ""} className="tabular" />
            </Field>
            <Field label={`${t("paint.tsLyDo")}${doiSo ? " *" : ""}`} className="md:col-span-2" hint={t("paint.tsGhiChuDieuChinh")}>
              <Input name="lyDo" required={doiSo} maxLength={200} placeholder={t("paint.tsLyDoGoiY")} />
            </Field>
          </div>
        </section>

        <section className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("paint.tsThongTinSon")}</h3>
          {khoa ? (
            <Notice tone="info">{t("paint.tsKhoaDungChung")}</Notice>
          ) : (
            dong.dungChung && <Notice tone="warning">{t("paint.tsCanhBaoDungChung")}</Notice>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={`${t("paint.tenSon")} *`} className="md:col-span-2">
              <Input name="name" required defaultValue={dong.ten} maxLength={200} disabled={khoa} />
            </Field>
            <Field label={t("paint.hangSanXuat")}>
              <Input name="maker" defaultValue={dong.hang ?? ""} maxLength={100} disabled={khoa} />
            </Field>
            <Field label={t("paint.kieuSon")}>
              <Select name="paintType" defaultValue={dong.loai in PAINT_TYPE_LABEL ? dong.loai : "OTHER"} disabled={khoa}>
                {Object.keys(PAINT_TYPE_LABEL).map((v) => (
                  <option key={v} value={v}>
                    {tTuDo(`paint.loaiSon_${v}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("paint.tenMau")}>
              <Input name="colorName" defaultValue={dong.mau ?? ""} maxLength={100} disabled={khoa} placeholder={t("paint.phTenMau")} />
            </Field>
            <Field label={t("paint.maMau")}>
              <Input name="colorCode" defaultValue={dong.maMau ?? ""} maxLength={60} disabled={khoa} />
            </Field>
            <Field label={t("chung.donVi")}>
              <Input name="uom" defaultValue={dong.dvt} maxLength={20} disabled={khoa} placeholder={t("paint.phDonViSon")} />
            </Field>
            <Field label={t("paint.dungTichLon")}>
              <Input name="packSize" type="number" step="any" min="0" defaultValue={dong.dungTich || ""} disabled={khoa} className="tabular" />
            </Field>
          </div>
        </section>

        {loi && <Notice tone="danger">{loi}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("chung.huy")}
          </Button>
          <Button type="submit" variant="primary" loading={pending} icon={<Save className="size-4" />}>
            {t("chung.luu")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function HopGo({
  dong,
  action,
  pending,
  loi,
  onClose,
}: {
  dong: DongTonSonSua;
  action: (fd: FormData) => void;
  pending: boolean;
  loi: string;
  onClose: () => void;
}) {
  const { t } = useNgonNgu();
  const [cach, setCach] = useState<"GIU" | "XOA">("GIU");
  const khoaXoa = dong.soThiCong > 0;
  const o = (chon: boolean, tat = false) =>
    cn(
      "flex gap-3 rounded-lg border p-3 text-sm",
      chon ? "border-brand-500 bg-[var(--surface-sunken)]" : "border-[var(--border-subtle)]",
      tat ? "cursor-not-allowed opacity-60" : "cursor-pointer"
    );

  return (
    <Modal open onClose={onClose} width="max-w-xl" title={t("paint.tsTieuDeGo", { ten: dong.ten })}>
      <form action={action} className="space-y-4 text-left">
        <input type="hidden" name="vesselId" value={dong.vesselId} />
        <input type="hidden" name="productId" value={dong.productId} />
        <p className="text-sm text-[var(--text-secondary)]">{t("paint.tsDangGhi", { so: soIn(dong.soLuong), dv: dong.dvt })}</p>
        <fieldset className="space-y-2">
          <label className={o(cach === "GIU")}>
            <input type="radio" name="cach" value="GIU" checked={cach === "GIU"} onChange={() => setCach("GIU")} className="mt-0.5" />
            <span>
              <span className="font-medium text-[var(--text-primary)]">{t("paint.tsCachGiu")}</span>
              <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{t("paint.tsCachGiuMoTa")}</span>
            </span>
          </label>
          <label className={o(cach === "XOA", khoaXoa)}>
            <input type="radio" name="cach" value="XOA" checked={cach === "XOA"} disabled={khoaXoa} onChange={() => setCach("XOA")} className="mt-0.5" />
            <span>
              <span className="font-medium text-[var(--text-primary)]">{t("paint.tsCachXoa")}</span>
              <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">
                {khoaXoa ? t("paint.tsCachXoaKhoa", { n: dong.soThiCong }) : t("paint.tsCachXoaMoTa")}
              </span>
            </span>
          </label>
        </fieldset>
        <Field label={`${t("paint.tsLyDoGo")} *`}>
          <Input name="lyDo" required maxLength={200} placeholder={t("paint.tsLyDoGoGoiY")} />
        </Field>
        {loi && <Notice tone="danger">{loi}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("chung.huy")}
          </Button>
          <Button type="submit" variant="danger" loading={pending} icon={<Trash2 className="size-4" />}>
            {cach === "XOA" ? t("paint.tsNutXoaHan") : t("paint.tsNutXacNhanGo")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export type GiaoDichSonXoa = {
  id: number;
  ten: string;
  type: string;
  soLuong: number;
  dvt: string;
  luc: string;
  note: string | null;
};

/** Nút xóa một dòng nhập/xuất tay nhầm trong Lịch sử nhập/xuất (tồn được hoàn lại). */
export function NutXoaGiaoDichSon({ vesselId, giaoDich }: { vesselId: number; giaoDich: GiaoDichSonXoa }) {
  const { t } = useNgonNgu();
  const [mo, setMo] = useState(false);
  const [loi, setLoi] = useState("");
  const [, action, pending] = useActionState(async (prev: KetQuaTonSon, fd: FormData) => {
    const r = await xoaGiaoDichSon(prev, fd);
    if (r.success) {
      setMo(false);
      bao("lich-su", r.message);
    } else setLoi(r.message);
    return r;
  }, { message: "" });
  const nhap = giaoDich.type === "IN";
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setLoi("");
          setMo(true);
        }}
        icon={<Trash2 className="size-4" />}
        title={t("paint.gdTieuDeXoa", { ten: giaoDich.ten })}
        aria-label={t("paint.gdTieuDeXoa", { ten: giaoDich.ten })}
      />
      {mo && (
        <Modal open onClose={() => setMo(false)} width="max-w-lg" title={t("paint.gdTieuDeXoa", { ten: giaoDich.ten })}>
          <form action={action} className="space-y-4 text-left">
            <input type="hidden" name="vesselId" value={vesselId} />
            <input type="hidden" name="giaoDichId" value={giaoDich.id} />
            <p className="text-sm text-[var(--text-primary)]">
              {nhap
                ? t("paint.gdXoaMoTaNhap", { so: soIn(giaoDich.soLuong), dv: giaoDich.dvt })
                : t("paint.gdXoaMoTaXuat", { so: soIn(giaoDich.soLuong), dv: giaoDich.dvt })}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {giaoDich.luc}
              {giaoDich.note ? ` · ${giaoDich.note}` : ""}
            </p>
            <Field label={`${t("paint.gdLyDoXoa")} *`}>
              <Input name="lyDo" required maxLength={200} placeholder={t("paint.tsLyDoGoGoiY")} />
            </Field>
            {loi && <Notice tone="danger">{loi}</Notice>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
              <Button type="button" variant="ghost" onClick={() => setMo(false)}>
                {t("chung.huy")}
              </Button>
              <Button type="submit" variant="danger" loading={pending} icon={<Trash2 className="size-4" />}>
                {t("paint.gdNutXoa")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
