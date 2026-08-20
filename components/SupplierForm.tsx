"use client";

import { useActionState } from "react";
import {
  createSupplier,
  deleteSupplier,
  setSupplierActive,
  updateSupplier,
} from "@/app/actions";

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
  const [state, formAction, pending] = useActionState(createSupplier, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          name="code"
          placeholder="Mã NCC"
          className="rounded border p-2"
          defaultValue={v.code ?? ""}
          required
        />
        <input
          name="name"
          placeholder="Tên nhà cung cấp"
          className="rounded border p-2"
          defaultValue={v.name ?? ""}
          required
        />
      </div>
      <input
        name="contact"
        placeholder="Người liên hệ"
        className="w-full rounded border p-2"
        defaultValue={v.contact ?? ""}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded border p-2"
          defaultValue={v.email ?? ""}
        />
        <input
          name="phone"
          placeholder="Điện thoại"
          className="rounded border p-2"
          defaultValue={v.phone ?? ""}
        />
      </div>
      <input
        name="address"
        placeholder="Địa chỉ"
        className="w-full rounded border p-2"
        defaultValue={v.address ?? ""}
      />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Thêm nhà cung cấp"}
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

// Form sửa thông tin nhà cung cấp (ADMIN).
export function SupplierEditForm({ supplier }: { supplier: SupplierData }) {
  const [state, formAction, pending] = useActionState(updateSupplier, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3"
    >
      <input type="hidden" name="id" value={supplier.id} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Mã NCC</span>
          <input
            name="code"
            className="w-full rounded border p-2"
            defaultValue={v.code ?? supplier.code}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Tên nhà cung cấp
          </span>
          <input
            name="name"
            className="w-full rounded border p-2"
            defaultValue={v.name ?? supplier.name}
            required
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Người liên hệ
          </span>
          <input
            name="contact"
            className="w-full rounded border p-2"
            defaultValue={v.contact ?? supplier.contact ?? ""}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Email</span>
          <input
            name="email"
            type="email"
            className="w-full rounded border p-2"
            defaultValue={v.email ?? supplier.email ?? ""}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Điện thoại</span>
          <input
            name="phone"
            className="w-full rounded border p-2"
            defaultValue={v.phone ?? supplier.phone ?? ""}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">Địa chỉ</span>
        <input
          name="address"
          className="w-full rounded border p-2"
          defaultValue={v.address ?? supplier.address ?? ""}
        />
      </label>
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

export function SupplierDeleteButton({ id }: { id: number }) {
  const [state, formAction, pending] = useActionState(deleteSupplier, {
    message: "",
  });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Xóa vĩnh viễn nhà cung cấp này?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {pending ? "..." : "Xóa"}
      </button>
      {state.message && (
        <p className="mt-1 max-w-52 text-xs text-red-600">{state.message}</p>
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
  const [state, formAction, pending] = useActionState(setSupplierActive, {
    message: "",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button
        disabled={pending}
        className={`rounded px-2 py-1 text-xs disabled:opacity-50 ${
          isActive
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
            : "bg-green-100 text-green-700 hover:bg-green-200"
        }`}
      >
        {pending ? "..." : isActive ? "Ngừng dùng" : "Dùng lại"}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
