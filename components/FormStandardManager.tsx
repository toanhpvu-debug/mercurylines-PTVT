"use client";

import { useActionState, useState } from "react";
import { Ban, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  createFormStandard,
  deleteFormStandard,
  setFormStandardActive,
  updateFormStandard,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Modal } from "@/components/ui-client";

export type FormStandardData = {
  id: number;
  code: string;
  label: string;
  companyName: string;
  address: string;
  repAddress: string | null;
  tel: string | null;
  email: string | null;
  website: string | null;
};

export function FormStandardAddForm() {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createFormStandard, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("purchasing.phMaBieuMau")}>
          <Input
            name="code"
            placeholder={t("purchasing.phMaBieuMau")}
            className="uppercase"
            defaultValue={v.code ?? ""}
            required
          />
        </Field>
        <Field label={t("purchasing.nhanHienThi")}>
          <Input
            name="label"
            placeholder={t("purchasing.nhanHienThi")}
            defaultValue={v.label ?? ""}
          />
        </Field>
      </div>
      <Field label={t("purchasing.tenCongTy")}>
        <Input
          name="companyName"
          placeholder={t("purchasing.tenCongTy")}
          defaultValue={v.companyName ?? ""}
          required
        />
      </Field>
      <Field label={t("purchasing.diaChi")}>
        <Input
          name="address"
          placeholder={t("purchasing.diaChi")}
          defaultValue={v.address ?? ""}
          required
        />
      </Field>
      <Field label={t("purchasing.diaChiVpDaiDien")}>
        <Input
          name="repAddress"
          placeholder={t("purchasing.diaChiVpDaiDien")}
          defaultValue={v.repAddress ?? ""}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("purchasing.dienThoai")}>
          <Input
            name="tel"
            placeholder={t("purchasing.dienThoai")}
            defaultValue={v.tel ?? ""}
          />
        </Field>
        <Field label="Email">
          <Input name="email" placeholder="Email" defaultValue={v.email ?? ""} />
        </Field>
        <Field label="Website">
          <Input
            name="website"
            placeholder="Website"
            defaultValue={v.website ?? ""}
          />
        </Field>
      </div>
      <Button
        variant="primary"
        icon={<Plus className="size-4" />}
        loading={pending}
      >
        {pending ? t("chung.dangLuu") : t("purchasing.nutThemBieuMau")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}

// Form sửa/hiệu chỉnh thông tin một biểu mẫu (ADMIN) — mở trong hộp thoại.
export function FormStandardEditForm({
  standard,
}: {
  standard: FormStandardData;
}) {
  const { t } = useNgonNgu();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateFormStandard, {
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
        {t("purchasing.suaThongTinBieuMau")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          <>
            {t("purchasing.suaThongTinBieuMau")} ·{" "}
            <span className="font-display text-xs tracking-wide">
              {standard.code}
            </span>
          </>
        }
      >
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={standard.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("purchasing.maBieuMauGhiChu")}>
              <Input
                name="code"
                className="uppercase"
                defaultValue={v.code ?? standard.code}
                required
              />
            </Field>
            <Field label={t("purchasing.nhanHienThi")}>
              <Input name="label" defaultValue={v.label ?? standard.label} />
            </Field>
          </div>
          <Field label={t("purchasing.tenCongTy")}>
            <Input
              name="companyName"
              defaultValue={v.companyName ?? standard.companyName}
              required
            />
          </Field>
          <Field label={t("purchasing.diaChi")}>
            <Input
              name="address"
              defaultValue={v.address ?? standard.address}
              required
            />
          </Field>
          <Field label={t("purchasing.diaChiVpDaiDien")}>
            <Input
              name="repAddress"
              defaultValue={v.repAddress ?? standard.repAddress ?? ""}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("purchasing.dienThoai")}>
              <Input name="tel" defaultValue={v.tel ?? standard.tel ?? ""} />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                defaultValue={v.email ?? standard.email ?? ""}
              />
            </Field>
            <Field label="Website">
              <Input
                name="website"
                defaultValue={v.website ?? standard.website ?? ""}
              />
            </Field>
          </div>
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

export function FormStandardRowActions({
  id,
  isActive,
}: {
  id: number;
  isActive: boolean;
}) {
  const { t } = useNgonNgu();
  const [tState, tAction, tPending] = useActionState(setFormStandardActive, {
    message: "",
  });
  const [dState, dAction, dPending] = useActionState(deleteFormStandard, {
    message: "",
  });
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <form action={tAction}>
          <input type="hidden" name="id" value={id} />
          <input
            type="hidden"
            name="active"
            value={isActive ? "false" : "true"}
          />
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
            loading={tPending}
          >
            {isActive
              ? t("purchasing.nutNgungDung")
              : t("purchasing.nutDungLai")}
          </Button>
        </form>
        <form
          action={dAction}
          onSubmit={(e) => {
            if (!window.confirm(t("purchasing.xacNhanXoaBieuMau"))) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="size-4" />}
            loading={dPending}
          >
            {t("chung.xoa")}
          </Button>
        </form>
      </div>
      {(tState.message || dState.message) && (
        <p className="text-xs text-[var(--text-danger)]">
          {tState.message || dState.message}
        </p>
      )}
    </div>
  );
}
