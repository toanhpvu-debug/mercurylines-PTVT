"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, ClipboardList, Pencil, Trash2, Unlink, X } from "lucide-react";
import { goVatTuKhoiTauHangLoat, suaVatTuHangLoat, xoaVatTuHangLoat, type PatchHangLoat } from "@/app/vat-tu-hang-loat-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal } from "@/components/ui-client";

/**
 * Thanh thao tác hàng loạt cho bảng danh mục (/materials).
 *
 * Bảng là server component với hàng trăm dòng — không biến cả bảng thành client
 * chỉ để có ô tick. Thay vào đó, các ô tick là <input> thường do server vẽ, mang
 * data-chon-vat-tu (từng dòng), data-chon-nhom (cả bộ phận), data-chon-tat-ca
 * (tất cả đang hiện); thành phần này lắng nghe sự kiện "change" ở cấp document,
 * giữ danh sách id đã chọn, đồng bộ trạng thái các ô "chọn cả" và hiện thanh
 * nổi dưới màn hình với các việc làm được trên số dòng đã chọn.
 */
type Chon = { loai: "STORE" | "SPARE"; ma: string };
type CategoryOption = { id: number; name: string };

const O_DONG = "input[data-chon-vat-tu]";

function docO(el: HTMLInputElement): { id: number; chon: Chon } | null {
  const id = Number(el.dataset.chonVatTu);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { id, chon: { loai: el.dataset.loai === "SPARE" ? "SPARE" : "STORE", ma: el.dataset.ma ?? "" } };
}

export default function ChonHangLoat({
  quyen,
  categories,
  vesselId,
}: {
  /**
   * yeuCau: lập được yêu cầu · sua: sửa hàng loạt bản ghi dùng chung (ADMIN) ·
   * xoa: xóa khỏi danh mục dùng chung (ADMIN + bản văn phòng) ·
   * goKhoiTau: gỡ khỏi danh mục tàu đang xem (người quản lý danh mục tàu).
   */
  quyen: { yeuCau: boolean; sua: boolean; xoa: boolean; goKhoiTau: boolean };
  categories: CategoryOption[];
  /** Tàu đang xem (chế độ theo tàu) — cần cho "Gỡ khỏi tàu". */
  vesselId: number | null;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [chon, setChon] = useState<Map<number, Chon>>(() => new Map());
  const [moSua, setMoSua] = useState(false);
  const [thongBao, setThongBao] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Đọc lại toàn bộ ô tick trên trang → state, và chỉnh ô "chọn cả" theo đó. */
  const dongBo = () => {
    const moi = new Map<number, Chon>();
    const theoNhom = new Map<string, { tong: number; chon: number }>();
    let tong = 0;
    let daChon = 0;
    document.querySelectorAll<HTMLInputElement>(O_DONG).forEach((el) => {
      const o = docO(el);
      if (!o) return;
      tong++;
      const nhom = el.dataset.nhom ?? "";
      const tk = theoNhom.get(nhom) ?? { tong: 0, chon: 0 };
      tk.tong++;
      if (el.checked) {
        moi.set(o.id, o.chon);
        tk.chon++;
        daChon++;
      }
      theoNhom.set(nhom, tk);
    });
    document.querySelectorAll<HTMLInputElement>("input[data-chon-nhom]").forEach((el) => {
      const tk = theoNhom.get(el.dataset.chonNhom ?? "") ?? { tong: 0, chon: 0 };
      el.checked = tk.tong > 0 && tk.chon === tk.tong;
      el.indeterminate = tk.chon > 0 && tk.chon < tk.tong;
    });
    document.querySelectorAll<HTMLInputElement>("input[data-chon-tat-ca]").forEach((el) => {
      el.checked = tong > 0 && daChon === tong;
      el.indeterminate = daChon > 0 && daChon < tong;
    });
    setChon(moi);
  };

  useEffect(() => {
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.tagName !== "INPUT" || el.type !== "checkbox") return;
      if (el.dataset.chonNhom !== undefined) {
        document
          .querySelectorAll<HTMLInputElement>(`${O_DONG}[data-nhom="${CSS.escape(el.dataset.chonNhom)}"]`)
          .forEach((o) => (o.checked = el.checked));
      } else if (el.dataset.chonTatCa !== undefined) {
        document.querySelectorAll<HTMLInputElement>(O_DONG).forEach((o) => (o.checked = el.checked));
      } else if (el.dataset.chonVatTu === undefined) {
        return;
      }
      dongBo();
    };
    document.addEventListener("change", onChange);
    // Trang tải lại (điều hướng, refresh sau khi lưu) thì đọc lại trạng thái ô.
    const id = window.setTimeout(dongBo, 0);
    return () => {
      document.removeEventListener("change", onChange);
      window.clearTimeout(id);
    };
  }, []);

  const boChon = () => {
    document.querySelectorAll<HTMLInputElement>(`${O_DONG}, input[data-chon-nhom], input[data-chon-tat-ca]`).forEach((o) => {
      o.checked = false;
      o.indeterminate = false;
    });
    setChon(new Map());
  };

  const ids = [...chon.keys()];
  const n = ids.length;
  const soSpare = [...chon.values()].filter((c) => c.loai === "SPARE").length;
  const soStore = n - soSpare;

  const yeuCauNhanh = (loai: "STORE" | "SPARE" | null) => {
    const chonIds = ids.filter((id) => loai === null || chon.get(id)?.loai === loai);
    if (!chonIds.length) return;
    router.push(`/requests?vatTu=${chonIds.join(",")}`);
  };

  const xoa = () => {
    if (!window.confirm(t("materials.xacNhanXoaHangLoat", { n }))) return;
    startTransition(async () => {
      setThongBao(null);
      const r = await xoaVatTuHangLoat(ids);
      setThongBao({ tone: r.success ? (r.boQua.length ? "info" : "success") : "danger", text: r.message });
      if (r.daXoa > 0) {
        boChon();
        router.refresh();
      }
    });
  };

  const goKhoiTau = () => {
    if (!vesselId || !window.confirm(t("materials.xacNhanGoKhoiTauHangLoat", { n }))) return;
    startTransition(async () => {
      setThongBao(null);
      const r = await goVatTuKhoiTauHangLoat(vesselId, ids);
      setThongBao({ tone: r.success ? "success" : "danger", text: r.message });
      if (r.success) {
        boChon();
        router.refresh();
      }
    });
  };

  const sua = (patch: PatchHangLoat) => {
    startTransition(async () => {
      setThongBao(null);
      const r = await suaVatTuHangLoat(ids, patch);
      setThongBao({ tone: r.success ? "success" : "danger", text: r.message });
      if (r.success) {
        setMoSua(false);
        boChon();
        router.refresh();
      }
    });
  };

  if (n === 0 && !thongBao) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div className="pointer-events-auto surface flex max-w-full flex-wrap items-center gap-2 rounded-2xl border px-4 py-2.5 shadow-2xl">
          {n > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                <CheckSquare className="size-4 text-brand-700 dark:text-brand-300" />
                {t("materials.daChonN", { n })}
              </span>
              {quyen.yeuCau &&
                (soSpare > 0 && soStore > 0 ? (
                  <>
                    <Button type="button" size="sm" variant="primary" onClick={() => yeuCauNhanh("STORE")} icon={<ClipboardList className="size-4" />}>
                      {t("materials.nutYeuCauNhanhLoai", { loai: tTuDo("labels.typeLong_STORE"), n: soStore })}
                    </Button>
                    <Button type="button" size="sm" variant="primary" onClick={() => yeuCauNhanh("SPARE")} icon={<ClipboardList className="size-4" />}>
                      {t("materials.nutYeuCauNhanhLoai", { loai: tTuDo("labels.typeLong_SPARE"), n: soSpare })}
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="primary" onClick={() => yeuCauNhanh(null)} icon={<ClipboardList className="size-4" />}>
                    {t("materials.nutYeuCauNhanh")}
                  </Button>
                ))}
              {quyen.sua && (
                <Button type="button" size="sm" onClick={() => setMoSua(true)} disabled={pending} icon={<Pencil className="size-4" />}>
                  {t("materials.nutSuaHangLoat")}
                </Button>
              )}
              {quyen.goKhoiTau && vesselId && (
                <Button type="button" size="sm" onClick={goKhoiTau} loading={pending} icon={<Unlink className="size-4" />}>
                  {t("materials.nutGoKhoiTauHangLoat")}
                </Button>
              )}
              {quyen.xoa && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={xoa}
                  loading={pending}
                  icon={<Trash2 className="size-4" />}
                  title={t("materials.xoaChiVanPhongGoiY")}
                >
                  {t("materials.nutXoaHangLoat")}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={boChon} icon={<X className="size-4" />}>
                {t("materials.boChon")}
              </Button>
            </>
          ) : null}
          {thongBao && (
            <div className="basis-full">
              <Notice tone={thongBao.tone} className="flex items-start justify-between gap-2">
                <span>{thongBao.text}</span>
                <button type="button" onClick={() => setThongBao(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t("chung.dong")}>
                  <X className="size-4" />
                </button>
              </Notice>
            </div>
          )}
        </div>
      </div>
      {moSua && <SuaHangLoatDialog n={n} categories={categories} pending={pending} onSubmit={sua} onClose={() => setMoSua(false)} />}
    </>
  );
}

/** Hộp sửa hàng loạt: ô nào để trống / "Giữ nguyên" thì không đụng tới. */
function SuaHangLoatDialog({
  n,
  categories,
  pending,
  onSubmit,
  onClose,
}: {
  n: number;
  categories: CategoryOption[];
  pending: boolean;
  onSubmit: (patch: PatchHangLoat) => void;
  onClose: () => void;
}) {
  const { t } = useNgonNgu();
  const [equipment, setEquipment] = useState("");
  const [doiThietBi, setDoiThietBi] = useState(false);
  const [categoryId, setCategoryId] = useState("__giu");
  const [uom, setUom] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [isCritical, setIsCritical] = useState("__giu");
  const [isActive, setIsActive] = useState("__giu");

  const gui = () => {
    const patch: PatchHangLoat = {};
    if (doiThietBi) patch.equipment = equipment;
    if (categoryId !== "__giu") patch.categoryId = categoryId === "" ? null : Number(categoryId);
    if (uom.trim()) patch.uom = uom.trim();
    if (minStock.trim()) patch.minStock = Number(minStock);
    if (maxStock.trim()) patch.maxStock = Number(maxStock);
    if (isCritical !== "__giu") patch.isCritical = isCritical === "1";
    if (isActive !== "__giu") patch.isActive = isActive === "1";
    onSubmit(patch);
  };

  return (
    <Modal open onClose={onClose} width="max-w-2xl" title={t("materials.suaHangLoatTieuDe", { n })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          gui();
        }}
        className="space-y-4 text-left"
      >
        <p className="text-sm text-[var(--text-secondary)]">{t("materials.suaHangLoatMoTa")}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t("chung.thietBi")} className="md:col-span-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={doiThietBi} onChange={(e) => setDoiThietBi(e.target.checked)} className="size-4 accent-brand-600" />
              <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} disabled={!doiThietBi} placeholder={t("materials.suaHangLoatThietBiGoiY")} maxLength={120} />
            </div>
          </Field>
          <Field label={t("chung.nhom")}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="__giu">{t("materials.giuNguyen")}</option>
              <option value="">{t("materials.optKhongThuocNhom")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("chung.donVi")}>
            <Input value={uom} onChange={(e) => setUom(e.target.value)} placeholder={t("materials.giuNguyen")} maxLength={20} />
          </Field>
          <Field label={t("materials.tonToiThieu")}>
            <Input type="number" min="0" step="0.01" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder={t("materials.giuNguyen")} />
          </Field>
          <Field label={t("materials.tonToiDa")}>
            <Input type="number" min="0" step="0.01" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} placeholder={t("materials.giuNguyen")} />
          </Field>
          <Field label={t("materials.phuTungThietYeu")}>
            <Select value={isCritical} onChange={(e) => setIsCritical(e.target.value)}>
              <option value="__giu">{t("materials.giuNguyen")}</option>
              <option value="1">{t("chung.co")}</option>
              <option value="0">{t("chung.khong")}</option>
            </Select>
          </Field>
          <Field label={t("chung.trangThai")}>
            <Select value={isActive} onChange={(e) => setIsActive(e.target.value)}>
              <option value="__giu">{t("materials.giuNguyen")}</option>
              <option value="1">{t("materials.nutDungLai")}</option>
              <option value="0">{t("materials.nutNgungDung")}</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button type="submit" variant="primary" loading={pending} icon={<Pencil className="size-4" />}>
            {t("materials.nutApDungHangLoat", { n })}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("chung.huy")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
