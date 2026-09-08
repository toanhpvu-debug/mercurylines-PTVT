"use client";

import { useActionState } from "react";
import {
  createFormStandard,
  deleteFormStandard,
  setFormStandardActive,
  updateFormStandard,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

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
        <input
          name="code"
          placeholder={t("purchasing.phMaBieuMau")}
          className="rounded border p-2 uppercase"
          defaultValue={v.code ?? ""}
          required
        />
        <input
          name="label"
          placeholder={t("purchasing.nhanHienThi")}
          className="rounded border p-2"
          defaultValue={v.label ?? ""}
        />
      </div>
      <input
        name="companyName"
        placeholder={t("purchasing.tenCongTy")}
        className="w-full rounded border p-2"
        defaultValue={v.companyName ?? ""}
        required
      />
      <input
        name="address"
        placeholder={t("purchasing.diaChi")}
        className="w-full rounded border p-2"
        defaultValue={v.address ?? ""}
        required
      />
      <input
        name="repAddress"
        placeholder={t("purchasing.diaChiVpDaiDien")}
        className="w-full rounded border p-2"
        defaultValue={v.repAddress ?? ""}
      />
      <div className="grid grid-cols-3 gap-3">
        <input
          name="tel"
          placeholder={t("purchasing.dienThoai")}
          className="rounded border p-2"
          defaultValue={v.tel ?? ""}
        />
        <input
          name="email"
          placeholder="Email"
          className="rounded border p-2"
          defaultValue={v.email ?? ""}
        />
        <input
          name="website"
          placeholder="Website"
          className="rounded border p-2"
          defaultValue={v.website ?? ""}
        />
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("chung.dangLuu") : t("purchasing.nutThemBieuMau")}
      </button>
      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

// Form sửa/hiệu chỉnh thông tin một biểu mẫu (ADMIN).
export function FormStandardEditForm({
  standard,
}: {
  standard: FormStandardData;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(updateFormStandard, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
      <input type="hidden" name="id" value={standard.id} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            {t("purchasing.maBieuMauGhiChu")}
          </span>
          <input
            name="code"
            className="w-full rounded border p-2 uppercase"
            defaultValue={v.code ?? standard.code}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            {t("purchasing.nhanHienThi")}
          </span>
          <input
            name="label"
            className="w-full rounded border p-2"
            defaultValue={v.label ?? standard.label}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">
          {t("purchasing.tenCongTy")}
        </span>
        <input
          name="companyName"
          className="w-full rounded border p-2"
          defaultValue={v.companyName ?? standard.companyName}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">
          {t("purchasing.diaChi")}
        </span>
        <input
          name="address"
          className="w-full rounded border p-2"
          defaultValue={v.address ?? standard.address}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">
          {t("purchasing.diaChiVpDaiDien")}
        </span>
        <input
          name="repAddress"
          className="w-full rounded border p-2"
          defaultValue={v.repAddress ?? standard.repAddress ?? ""}
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            {t("purchasing.dienThoai")}
          </span>
          <input
            name="tel"
            className="w-full rounded border p-2"
            defaultValue={v.tel ?? standard.tel ?? ""}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Email</span>
          <input
            name="email"
            className="w-full rounded border p-2"
            defaultValue={v.email ?? standard.email ?? ""}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Website</span>
          <input
            name="website"
            className="w-full rounded border p-2"
            defaultValue={v.website ?? standard.website ?? ""}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("chung.dangLuu") : t("purchasing.luuThayDoi")}
        </button>
        {state.message && (
          <p
            className={`text-sm ${
              state.success ? "text-green-700" : "text-red-600"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
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
          <button
            disabled={tPending}
            className={`rounded px-2 py-1 text-xs disabled:opacity-50 ${
              isActive
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {tPending
              ? "..."
              : isActive
                ? t("purchasing.nutNgungDung")
                : t("purchasing.nutDungLai")}
          </button>
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
          <button
            disabled={dPending}
            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {t("chung.xoa")}
          </button>
        </form>
      </div>
      {(tState.message || dState.message) && (
        <p className="text-xs text-red-600">
          {tState.message || dState.message}
        </p>
      )}
    </div>
  );
}
