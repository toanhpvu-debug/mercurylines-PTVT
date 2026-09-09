"use client";

import { startTransition, useActionState, useState } from "react";
import { Pencil, Plus, Power, PowerOff, Save, Trash2 } from "lucide-react";
import {
  deletePaintProduct,
  savePaintProduct,
  togglePaintProduct,
} from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal } from "@/components/ui-client";

export type PaintProductRow = {
  id: number;
  code: string;
  name: string;
  maker: string | null;
  paintType: string;
  colorCode: string | null;
  colorName: string | null;
  uom: string;
  packSize: number;
  coverage: number;
  dftPerCoat: number;
  thinner: string | null;
  notes: string | null;
  isActive: boolean;
};

type TypeOption = { value: string; label: string };

const num = (v: number) => (v ? String(v) : "");

function ProductFields({
  product,
  types,
}: {
  product?: PaintProductRow;
  types: readonly TypeOption[];
}) {
  const { t, tTuDo } = useNgonNgu();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Field label={`${t("paint.tenSon")} *`}>
        <Input
          name="name"
          defaultValue={product?.name ?? ""}
          required
          placeholder={t("paint.phVdMarathon")}
        />
      </Field>
      <Field label={t("paint.hang")}>
        <Input
          name="maker"
          defaultValue={product?.maker ?? ""}
          placeholder="Jotun / International / Chugoku..."
        />
      </Field>
      <Field label={`${t("paint.kieuSon")} *`}>
        <Select name="paintType" defaultValue={product?.paintType ?? "OTHER"}>
          {types.map((loai) => (
            <option key={loai.value} value={loai.value}>
              {tTuDo(`paint.loaiSon_${loai.value}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("paint.maMau")}>
        <Input
          name="colorCode"
          defaultValue={product?.colorCode ?? ""}
          placeholder="RAL 7035..."
        />
      </Field>
      <Field label={t("paint.tenMau")}>
        <Input
          name="colorName"
          defaultValue={product?.colorName ?? ""}
          placeholder={t("paint.phTenMau")}
        />
      </Field>
      <Field label={t("chung.donVi")}>
        <Input
          name="uom"
          defaultValue={product?.uom ?? "L"}
          placeholder={t("paint.phDonViSon")}
        />
      </Field>
      <Field label={t("paint.dungTichLon")}>
        <Input
          name="packSize"
          type="number"
          step="0.01"
          min="0"
          defaultValue={num(product?.packSize ?? 0)}
          placeholder="20"
          className="tabular"
        />
      </Field>
      <Field label={t("paint.doPhuLyThuyet")}>
        <Input
          name="coverage"
          type="number"
          step="0.01"
          min="0"
          defaultValue={num(product?.coverage ?? 0)}
          placeholder="7.5"
          className="tabular"
        />
      </Field>
      <Field label={t("paint.dftMoiLop")}>
        <Input
          name="dftPerCoat"
          type="number"
          step="1"
          min="0"
          defaultValue={num(product?.dftPerCoat ?? 0)}
          placeholder="100"
          className="tabular"
        />
      </Field>
      <Field label={t("paint.dungMoi")} className="md:col-span-1">
        <Input
          name="thinner"
          defaultValue={product?.thinner ?? ""}
          placeholder="Thinner No.7"
        />
      </Field>
      <Field label={t("chung.ghiChu")} className="md:col-span-2">
        <Input name="notes" defaultValue={product?.notes ?? ""} />
      </Field>
    </div>
  );
}

export function PaintProductAddForm({ types }: { types: readonly TypeOption[] }) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(savePaintProduct, {
    message: "",
  });
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={() => setOpen(true)}
        icon={<Plus className="size-4" />}
      >
        {t("paint.themLoaiSon")}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          width="max-w-3xl"
          title={t("paint.themLoaiSon")}
        >
          <form action={action} className="space-y-4 text-left">
            <ProductFields types={types} />
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
              <Button
                type="submit"
                variant="primary"
                loading={pending}
                icon={<Save className="size-4" />}
              >
                {pending ? t("chung.dangLuu") : t("chung.luu")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                {t("chung.dong")}
              </Button>
              {state.message && (
                <Notice
                  tone={state.success ? "success" : "danger"}
                  className="basis-full"
                >
                  {state.message}
                </Notice>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function PaintProductRowActions({
  product,
  types,
  canDelete,
}: {
  product: PaintProductRow;
  types: readonly TypeOption[];
  canDelete: boolean;
}) {
  const { t } = useNgonNgu();
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(
    savePaintProduct,
    { message: "" }
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    togglePaintProduct,
    { message: "" }
  );
  const [delState, delAction, delPending] = useActionState(deletePaintProduct, {
    message: "",
  });

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
        <form action={toggleAction}>
          <input type="hidden" name="id" value={product.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            loading={togglePending}
            icon={
              product.isActive ? (
                <PowerOff className="size-4" />
              ) : (
                <Power className="size-4" />
              )
            }
          >
            {product.isActive
              ? t("paint.nutNgungDung")
              : t("paint.nutDungLai")}
          </Button>
        </form>
        {canDelete && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !confirm(
                  t("paint.xacNhanXoaLoaiSon", { ten: product.name })
                )
              )
                return;
              const fd = new FormData(e.currentTarget);
              startTransition(() => delAction(fd));
            }}
          >
            <input type="hidden" name="id" value={product.id} />
            <Button
              type="submit"
              size="sm"
              variant="danger"
              loading={delPending}
              icon={<Trash2 className="size-4" />}
            >
              {t("chung.xoa")}
            </Button>
          </form>
        )}
      </div>
      {(toggleState.message || delState.message) && (
        <p
          className={`text-xs ${
            toggleState.success || delState.success
              ? "text-[var(--text-success)]"
              : "text-[var(--text-danger)]"
          }`}
        >
          {toggleState.message || delState.message}
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

      {/* Bảng danh mục có 9 cột — nhồi form sửa vào ô thao tác sẽ vỡ bố cục,
          nên mở dạng hộp thoại như danh mục vật tư. */}
      {editing && (
        <Modal
          open
          onClose={() => setEditing(false)}
          width="max-w-3xl"
          title={
            <span className="inline-flex flex-wrap items-baseline gap-2">
              {t("chung.sua")}
              <span className="font-display text-xs tracking-wide text-[var(--text-muted)]">
                {product.code}
              </span>
            </span>
          }
        >
          <form action={saveAction} className="space-y-4 text-left">
            <input type="hidden" name="id" value={product.id} />
            <Field label={t("paint.maSon")} className="max-w-xs">
              <Input
                name="code"
                defaultValue={product.code}
                className="font-display text-xs tracking-wide"
              />
            </Field>
            <ProductFields product={product} types={types} />
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
              <Button
                type="submit"
                variant="primary"
                loading={savePending}
                icon={<Save className="size-4" />}
              >
                {savePending ? t("chung.dangLuu") : t("paint.luuThayDoi")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                {t("chung.huy")}
              </Button>
              {saveState.message && (
                <Notice
                  tone={saveState.success ? "success" : "danger"}
                  className="basis-full"
                >
                  {saveState.message}
                </Notice>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
