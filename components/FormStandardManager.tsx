"use client";

import { useActionState } from "react";
import {
  createFormStandard,
  deleteFormStandard,
  setFormStandardActive,
  updateFormStandard,
} from "@/app/actions";

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
  const [state, formAction, pending] = useActionState(createFormStandard, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          name="code"
          placeholder="Mã (VD: OWNER)"
          className="rounded border p-2 uppercase"
          defaultValue={v.code ?? ""}
          required
        />
        <input
          name="label"
          placeholder="Nhãn hiển thị"
          className="rounded border p-2"
          defaultValue={v.label ?? ""}
        />
      </div>
      <input
        name="companyName"
        placeholder="Tên công ty (in trên chứng từ)"
        className="w-full rounded border p-2"
        defaultValue={v.companyName ?? ""}
        required
      />
      <input
        name="address"
        placeholder="Địa chỉ"
        className="w-full rounded border p-2"
        defaultValue={v.address ?? ""}
        required
      />
      <input
        name="repAddress"
        placeholder="Địa chỉ VP đại diện (tùy chọn)"
        className="w-full rounded border p-2"
        defaultValue={v.repAddress ?? ""}
      />
      <div className="grid grid-cols-3 gap-3">
        <input
          name="tel"
          placeholder="Điện thoại"
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
        {pending ? "Đang lưu..." : "Thêm biểu mẫu"}
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
            Mã (đổi mã sẽ tự cập nhật các tàu đang gán)
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
            Nhãn hiển thị
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
          Tên công ty (in trên chứng từ)
        </span>
        <input
          name="companyName"
          className="w-full rounded border p-2"
          defaultValue={v.companyName ?? standard.companyName}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">Địa chỉ</span>
        <input
          name="address"
          className="w-full rounded border p-2"
          defaultValue={v.address ?? standard.address}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">
          Địa chỉ VP đại diện (tùy chọn)
        </span>
        <input
          name="repAddress"
          className="w-full rounded border p-2"
          defaultValue={v.repAddress ?? standard.repAddress ?? ""}
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Điện thoại</span>
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
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
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
            {tPending ? "..." : isActive ? "Ngừng dùng" : "Dùng lại"}
          </button>
        </form>
        <form
          action={dAction}
          onSubmit={(e) => {
            if (!window.confirm("Xóa vĩnh viễn biểu mẫu này?")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            disabled={dPending}
            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            Xóa
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
