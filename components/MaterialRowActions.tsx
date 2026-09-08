"use client";

import { useActionState, useState } from "react";
import { Pencil, Power, PowerOff, Save, Trash2 } from "lucide-react";
import {
  deleteMaterial,
  setMaterialActive,
  updateMaterial,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal } from "@/components/ui-client";

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
};

type CategoryOption = { id: number; name: string };

export default function MaterialRowActions({
  material,
  categories,
  onlyEdit = false,
}: {
  material: EditableMaterial;
  categories: CategoryOption[];
  /**
   * Chỉ hiện nút Sửa. Dùng ở chế độ xem theo tàu: ngừng dùng / xóa là thao tác
   * trên bản ghi dùng chung toàn đội, làm từ danh mục gốc mới đúng ngữ cảnh.
   */
  onlyEdit?: boolean;
}) {
  const { t } = useNgonNgu();
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(updateMaterial, {
    message: "",
  });
  const [toggleState, toggleAction, togglePending] = useActionState(
    setMaterialActive,
    { message: "" }
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMaterial,
    { message: "" }
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setEditing(true)}
          icon={<Pencil className="size-4" />}
        >
          {t("chung.sua")}
        </Button>
        {!onlyEdit && (
        <form action={toggleAction}>
          <input type="hidden" name="id" value={material.id} />
          <input
            type="hidden"
            name="active"
            value={material.isActive ? "false" : "true"}
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            loading={togglePending}
            icon={
              material.isActive ? (
                <PowerOff className="size-4" />
              ) : (
                <Power className="size-4" />
              )
            }
          >
            {material.isActive
              ? t("materials.nutNgungDung")
              : t("materials.nutDungLai")}
          </Button>
        </form>
        )}
        {!onlyEdit && (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            const ok = window.confirm(
              t("materials.xacNhanXoa", { ma: material.code })
            );
            if (!ok) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={material.id} />
          <Button
            type="submit"
            size="sm"
            variant="danger"
            loading={deletePending}
            icon={<Trash2 className="size-4" />}
          >
            {t("chung.xoa")}
          </Button>
        </form>
        )}
      </div>

      {(toggleState.message || deleteState.message) && (
        <p className="text-xs text-[var(--text-danger)]">
          {toggleState.message || deleteState.message}
        </p>
      )}
      {saveState.message && !editing && (
        <p
          className={`text-xs ${
            saveState.success
              ? "text-[var(--text-success)]"
              : "text-[var(--text-danger)]"
          }`}
        >
          {saveState.message}
        </p>
      )}

      {editing && (
        <EditDialog
          material={material}
          categories={categories}
          action={saveAction}
          pending={savePending}
          message={saveState.message}
          success={saveState.success}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// Form sửa mở dạng hộp thoại phủ màn hình — bảng danh mục có tới 11 cột nên
// nhồi form vào trong ô thao tác sẽ vỡ bố cục. Chỉ gắn vào cây khi đang mở
// (xem `editing &&` ở trên) để ô "Loại" lấy lại giá trị của dòng mỗi lần mở.
function EditDialog({
  material,
  categories,
  action,
  pending,
  message,
  success,
  onClose,
}: {
  material: EditableMaterial;
  categories: CategoryOption[];
  action: (formData: FormData) => void;
  pending: boolean;
  message: string;
  success?: boolean;
  onClose: () => void;
}) {
  const { t, tTuDo } = useNgonNgu();
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
