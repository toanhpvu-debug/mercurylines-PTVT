"use client";

import { useActionState, useEffect, useEffectEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { duongDanSauSua } from "@/lib/viTriSauSua";
import { deleteMaterial, setMaterialActive, unassignMaterialFromVessel, updateMaterial } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal } from "@/components/ui-client";
import ChonNguoiGiu from "@/components/ChonNguoiGiu";

export type EditableMaterial = {
  id: number;
  code: string;
  nameVn: string;
  nameEn: string | null;
  impa: string | null;
  partNumber: string | null;
  manufacturer: string | null;
  materialType: string;
  equipment: string | null;
  uom: string;
  categoryId: number | null;
  minStock: number;
  maxStock: number;
  isCritical: boolean;
  isActive: boolean;
  /** Người giữ đã gán (cột "Giữ bởi"); null = app tự suy theo nhóm. */
  responsibleRank: string | null;
};

type CategoryOption = { id: number; name: string };
type KetQua = { message: string; success?: boolean };

/**
 * Nút thao tác TỪNG DÒNG của bảng danh mục (/materials) — Sửa · Ngừng sử dụng / Dùng lại · Xóa
 * (danh mục gốc), Sửa · Gỡ khỏi tàu (theo tàu) — là <button> thường do SERVER vẽ, mang
 * data-thao-tac="sua|ngung|dung|xoa|go-tau" + data-id (+ data-ma để hỏi lại). Thành phần này,
 * MỘT cái cho cả bảng, nghe "click" ở cấp document và làm việc: mở hộp Sửa, gọi action, báo kết
 * quả ở góc trên — như ChonHangLoat với ô tick.
 *
 * Trước đây mỗi dòng là một MaterialRowActions (3 useActionState + 2 form + ô ẩn + biểu tượng
 * lucide là thành phần client): đo 2026-10-17 trên bản sao dữ liệu thật, cột Thao tác chiếm 33
 * nút DOM / dòng — 6.600 trên 12.457 nút của trang quản trị — và hàng trăm thành phần phải hydrate.
 * Bấm trước khi trang nạp xong JS thì chưa có gì xảy ra (nút type="button").
 */
export default function ThaoTacDongDanhMuc({
  vatTu,
  categories,
  vesselId,
}: {
  /** Mặt hàng ĐANG HIỆN trên trang (dữ liệu cho hộp Sửa), kèm người giữ app đang tự suy. */
  vatTu: (EditableMaterial & { nguoiGiuSuyRa: string | null })[];
  categories: CategoryOption[];
  /** Tàu đang xem (chế độ theo tàu) — cho "Gỡ khỏi tàu". */
  vesselId: number | null;
}) {
  const { t } = useNgonNgu();
  const [dangSua, setDangSua] = useState<number | null>(null);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [, startTransition] = useTransition();
  const theoId = useMemo(() => new Map(vatTu.map((m) => [m.id, m])), [vatTu]);

  /** Chạy một action của dòng: khóa nút trong lúc chờ (nút là HTML máy chủ — mở khóa tay khi xong). */
  const chay = (nut: HTMLButtonElement, viec: () => Promise<KetQua>) => {
    nut.disabled = true;
    nut.setAttribute("aria-busy", "true");
    setThongBao(null);
    startTransition(async () => {
      try {
        const r = await viec();
        if (r.message) setThongBao({ ok: Boolean(r.success), chu: r.message });
      } catch {
        setThongBao({ ok: false, chu: t("materials.thaoTacLoi") });
      } finally {
        nut.disabled = false;
        nut.removeAttribute("aria-busy");
      }
    });
  };

  const bam = useEffectEvent((nut: HTMLButtonElement) => {
    const id = Number(nut.dataset.id);
    if (!Number.isInteger(id) || id <= 0) return;
    const ma = nut.dataset.ma ?? "";
    const fd = new FormData();
    switch (nut.dataset.thaoTac) {
      case "sua":
        if (!theoId.has(id)) return;
        setThongBao(null);
        setDangSua(id);
        return;
      case "ngung":
      case "dung":
        fd.set("id", String(id));
        fd.set("active", nut.dataset.thaoTac === "dung" ? "true" : "false");
        chay(nut, () => setMaterialActive({ message: "" }, fd));
        return;
      case "xoa":
        if (!window.confirm(t("materials.xacNhanXoa", { ma }))) return;
        fd.set("id", String(id));
        chay(nut, () => deleteMaterial({ message: "" }, fd));
        return;
      case "go-tau":
        if (vesselId === null || !window.confirm(t("materials.xacNhanGo", { ma }))) return;
        fd.set("vesselId", String(vesselId));
        fd.set("materialId", String(id));
        chay(nut, () => unassignMaterialFromVessel({ message: "" }, fd));
        return;
    }
  });
  useEffect(() => {
    const nghe = (e: MouseEvent) => {
      const nut = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-thao-tac]") : null;
      if (nut && !nut.disabled) bam(nut);
    };
    document.addEventListener("click", nghe);
    return () => document.removeEventListener("click", nghe);
  }, []);

  // Thông báo tự tắt sau 8 giây (vẫn đóng tay được).
  useEffect(() => {
    if (!thongBao) return;
    const id = window.setTimeout(() => setThongBao(null), 8000);
    return () => window.clearTimeout(id);
  }, [thongBao]);

  const mon = dangSua === null ? undefined : theoId.get(dangSua);
  return (
    <>
      {mon && (
        <HopSuaVatTu
          // Mỗi lần mở là một hộp mới: thông báo lỗi của lần trước / dòng khác không còn lại.
          key={mon.id}
          material={mon}
          categories={categories}
          nguoiGiuSuyRa={mon.nguoiGiuSuyRa}
          onClose={() => setDangSua(null)}
          onXong={(chu) => {
            setDangSua(null);
            if (chu) setThongBao({ ok: true, chu });
          }}
        />
      )}
      {thongBao && (
        <div role="status" className="no-print fixed top-20 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] shadow-lg">
          <Notice tone={thongBao.ok ? "success" : "danger"} className="flex items-start justify-between gap-2">
            <span>{thongBao.chu}</span>
            <button type="button" onClick={() => setThongBao(null)} aria-label={t("chung.dong")} className="shrink-0 rounded p-0.5 hover:bg-black/10">
              <X className="size-4" />
            </button>
          </Notice>
        </div>
      )}
    </>
  );
}

/** Hộp Sửa của một mặt hàng: lưu xong thì ĐI THEO mặt hàng tới chỗ mới (lib/viTriSauSua.ts). */
function HopSuaVatTu({
  material,
  categories,
  nguoiGiuSuyRa,
  onClose,
  onXong,
}: {
  material: EditableMaterial;
  categories: CategoryOption[];
  nguoiGiuSuyRa: string | null;
  onClose: () => void;
  onXong: (chu: string) => void;
}) {
  const router = useRouter();
  const [saveState, saveAction, savePending] = useActionState(
    async (truoc: Awaited<ReturnType<typeof updateMaterial>>, formData: FormData) => {
      const kq = await updateMaterial(truoc, formData);
      // Đổi người giữ là mặt hàng sang bộ phận khác (có khi trang 3 của mục đó, hoặc ra ngoài bộ
      // lọc đang chọn) — đóng hộp, mở đúng chỗ, tô sáng dòng.
      if (kq.success && kq.viTri) {
        onXong(kq.message);
        router.push(duongDanSauSua(window.location.search, kq.viTri));
      }
      return kq;
    },
    { message: "" }
  );
  return (
    <EditDialog
      material={material}
      categories={categories}
      nguoiGiuSuyRa={nguoiGiuSuyRa}
      action={saveAction}
      pending={savePending}
      message={saveState.message}
      success={saveState.success}
      onClose={onClose}
    />
  );
}

// Form sửa mở dạng hộp thoại phủ màn hình — bảng danh mục có tới 11 cột nên
// nhồi form vào trong ô thao tác sẽ vỡ bố cục. Chỉ gắn vào cây khi đang mở
// để ô "Loại" lấy lại giá trị của dòng mỗi lần mở.
function EditDialog({
  material,
  categories,
  nguoiGiuSuyRa,
  action,
  pending,
  message,
  success,
  onClose,
}: {
  material: EditableMaterial;
  categories: CategoryOption[];
  nguoiGiuSuyRa: string | null;
  action: (formData: FormData) => void;
  pending: boolean;
  message: string;
  success?: boolean;
  onClose: () => void;
}) {
  const { t, tTuDo, tenChucDanh } = useNgonNgu();
  const [type, setType] = useState(material.materialType);

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title={
        <span className="inline-flex flex-wrap items-baseline gap-2">
          {t("materials.suaVatTu")}
          <span className="font-display text-xs tracking-wide text-[var(--text-muted)]">
            {material.code}
          </span>
        </span>
      }
    >
      <form action={action} className="space-y-4 text-left">
        <input type="hidden" name="id" value={material.id} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label={`${t("chung.ma")} *`}>
            <Input name="code" defaultValue={material.code} required />
          </Field>
          <Field label={`${t("materials.tenTiengViet")} *`} className="md:col-span-2">
            <Input name="nameVn" defaultValue={material.nameVn} required />
          </Field>
          <Field label={t("materials.tenTiengAnh")} className="md:col-span-3">
            <Input name="nameEn" defaultValue={material.nameEn ?? ""} />
          </Field>

          <Field label={t("materials.loai")}>
            <Select
              name="materialType"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="STORE">{tTuDo("labels.typeLong_STORE")}</option>
              <option value="SPARE">{tTuDo("labels.typeLong_SPARE")}</option>
            </Select>
          </Field>
          <Field
            className="md:col-span-2"
            label={
              <>
                {t("chung.thietBi")}
                {type !== "SPARE" ? ` ${t("materials.chiDungChoPhuTung")}` : ""}
              </>
            }
          >
            <Input
              name="equipment"
              defaultValue={material.equipment ?? ""}
              disabled={type !== "SPARE"}
              placeholder="Main Engine, Air Compressor..."
            />
          </Field>

          <Field label={t("materials.impaSauChuSo")}>
            <Input
              name="impa"
              defaultValue={material.impa ?? ""}
              placeholder="190115"
            />
          </Field>
          <Field label={t("materials.partNoMaNhaSanXuat")}>
            <Input
              name="partNumber"
              defaultValue={material.partNumber ?? ""}
              placeholder="VLH-53.06.01"
            />
          </Field>
          <Field label="Maker">
            <Input
              name="manufacturer"
              defaultValue={material.manufacturer ?? ""}
            />
          </Field>

          <Field label={t("chung.nhom")}>
            <Select name="categoryId" defaultValue={material.categoryId ?? ""}>
              <option value="">{t("materials.optKhongThuocNhom")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("chung.donVi")}>
            <Input name="uom" defaultValue={material.uom} />
          </Field>
          <div className="flex gap-3">
            <Field label={t("materials.tonToiThieu")} className="flex-1">
              <Input
                name="minStock"
                type="number"
                min="0"
                step="0.01"
                defaultValue={material.minStock}
              />
            </Field>
            <Field label={t("materials.tonToiDa")} className="flex-1">
              <Input
                name="maxStock"
                type="number"
                min="0"
                step="0.01"
                defaultValue={material.maxStock}
              />
            </Field>
          </div>

          {/* Cột "Giữ bởi": gán tay thì thắng mọi suy luận và mặt hàng về nhóm bộ phận của người
              giữ (trừ hàng an toàn); để "tự suy" thì app suy từ nhóm như trước. */}
          <Field label={t("materials.nguoiGiu")} hint={t("materials.nguoiGiuGoiY")} className="md:col-span-3">
            <ChonNguoiGiu
              name="responsibleRank"
              defaultValue={material.responsibleRank ?? ""}
              dau={[
                {
                  value: "",
                  label: nguoiGiuSuyRa
                    ? t("materials.nguoiGiuTuSuyHien", { ten: `${tenChucDanh(nguoiGiuSuyRa)} (${nguoiGiuSuyRa})` })
                    : t("materials.nguoiGiuTuSuy"),
                },
              ]}
            />
          </Field>

          <label className="flex items-center gap-2 md:col-span-3">
            <input
              type="checkbox"
              name="isCritical"
              defaultChecked={material.isCritical}
              className="size-4 accent-brand-600"
            />
            <span className="text-sm text-[var(--text-primary)]">
              {t("materials.phuTungThietYeu")}
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={pending}
            icon={<Save className="size-4" />}
          >
            {pending ? t("chung.dangLuu") : t("materials.luuThayDoi")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("chung.huy")}
          </Button>
          {message && (
            <Notice tone={success ? "success" : "danger"} className="basis-full">
              {message}
            </Notice>
          )}
        </div>
      </form>
    </Modal>
  );
}
