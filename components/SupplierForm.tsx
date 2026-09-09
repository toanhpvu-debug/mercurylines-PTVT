"use client";

import { useActionState, useState } from "react";
import { Ban, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  createSupplier,
  deleteSupplier,
  setSupplierActive,
  updateSupplier,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Modal } from "@/components/ui-client";

export type SupplierData = {
  id: number;
  code: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function SupplierForm() {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createSupplier, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("purchasing.phMaNcc")}>
          <Input
            name="code"
            placeholder={t("purchasing.phMaNcc")}
            defaultValue={v.code ?? ""}
            required
          />
        </Field>
        <Field label={t("purchasing.tenNcc")}>
          <Input
            name="name"
            placeholder={t("purchasing.tenNcc")}
            defaultValue={v.name ?? ""}
            required
          />
        </Field>
      </div>
      <Field label={t("purchasing.nguoiLienHe")}>
        <Input
          name="contact"
          placeholder={t("purchasing.nguoiLienHe")}
          defaultValue={v.contact ?? ""}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input
            name="email"
            type="email"
            placeholder="Email"
            defaultValue={v.email ?? ""}
          />
        </Field>
        <Field label={t("purchasing.dienThoai")}>
          <Input
            name="phone"
            placeholder={t("purchasing.dienThoai")}
            defaultValue={v.phone ?? ""}
          />
        </Field>
      </div>
      <Field label={t("purchasing.diaChi")}>
        <Input
          name="address"
          placeholder={t("purchasing.diaChi")}
          defaultValue={v.address ?? ""}
        />
      </Field>
      <Button
        variant="primary"
        icon={<Plus className="size-4" />}
        loading={pending}
      >
        {pending ? t("chung.dangLuu") : t("purchasing.themNcc")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}

// Form sửa thông tin nhà cung cấp (ADMIN) — mở trong hộp thoại.
export function SupplierEditForm({ supplier }: { supplier: SupplierData }) {
  const { t } = useNgonNgu();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateSupplier, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Pencil className="size-4" />}
        onClick={() => setOpen(true)}
      >
        {t("purchasing.suaThongTinNcc")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          <>
            {t("purchasing.suaThongTinNcc")} ·{" "}
            <span className="font-display text-xs tracking-wide">
              {supplier.code}
            </span>
          </>
        }
      >
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={supplier.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("purchasing.phMaNcc")}>
              <Input
                name="code"
                defaultValue={v.code ?? supplier.code}
                required
              />
            </Field>
            <Field label={t("purchasing.tenNcc")}>
              <Input
                name="name"
                defaultValue={v.name ?? supplier.name}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("purchasing.nguoiLienHe")}>
              <Input
                name="contact"
                defaultValue={v.contact ?? supplier.contact ?? ""}
              />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                defaultValue={v.email ?? supplier.email ?? ""}
              />
            </Field>
            <Field label={t("purchasing.dienThoai")}>
              <Input
                name="phone"
                defaultValue={v.phone ?? supplier.phone ?? ""}
              />
            </Field>
          </div>
          <Field label={t("purchasing.diaChi")}>
            <Input
              name="address"
              defaultValue={v.address ?? supplier.address ?? ""}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              icon={<Save className="size-4" />}
              loading={pending}
            >
              {pending ? t("chung.dangLuu") : t("purchasing.luuThayDoi")}
            </Button>
            {state.message && (
              <Notice tone={state.success ? "success" : "danger"}>
                {state.message}
              </Notice>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

export function SupplierDeleteButton({ id }: { id: number }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(deleteSupplier, {
    message: "",
  });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("purchasing.xacNhanXoaNcc"))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        variant="danger"
        size="sm"
        icon={<Trash2 className="size-4" />}
        loading={pending}
      >
        {t("chung.xoa")}
      </Button>
      {state.message && (
        <p className="mt-1 max-w-52 text-xs text-[var(--text-danger)]">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SupplierActiveToggle({
  id,
  isActive,
}: {
  id: number;
  isActive: boolean;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(setSupplierActive, {
    message: "",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <Button
        variant="secondary"
        size="sm"
        icon={
          isActive ? (
            <Ban className="size-4" />
          ) : (
            <RotateCcw className="size-4" />
          )
        }
        loading={pending}
      >
        {isActive ? t("purchasing.nutNgungDung") : t("purchasing.nutDungLai")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
