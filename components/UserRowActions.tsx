"use client";

import { useActionState } from "react";
import { deleteUser, toggleUserActive, updateUserRole } from "@/app/actions";
import { NHOM_CHUC_DANH, ROLE_LABEL } from "@/lib/roles";
import ChonChucDanhGiuVatTu from "@/components/ChonChucDanhGiuVatTu";

type VesselOption = {
  id: number;
  label: string;
};

export function UserRoleForm({
  id,
  role,
  rankCode,
  vesselId,
  vessels,
  disabled,
}: {
  id: number;
  role: string;
  rankCode: string | null;
  vesselId: number | null;
  vessels: VesselOption[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserRole, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        <select
          name="role"
          defaultValue={v.role ?? role}
          disabled={disabled}
          className="rounded border p-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          {NHOM_CHUC_DANH.map((g) => (
            <optgroup key={g.nhom} label={g.nhom}>
              {g.vaiTro.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          name="vesselId"
          defaultValue={v.vesselId ?? vesselId ?? ""}
          disabled={disabled}
          className="max-w-44 rounded border p-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">Không gán tàu</option>
          {vessels.map((vessel) => (
            <option key={vessel.id} value={vessel.id}>
              {vessel.label}
            </option>
          ))}
        </select>
        <ChonChucDanhGiuVatTu
          giaTri={v.rankCode ?? rankCode ?? ""}
          vaiTro={role}
          disabled={disabled}
          gonGang
        />
        {!disabled && (
          <button
            disabled={pending}
            className="rounded border px-2 py-1 text-sm hover:bg-blue-50 disabled:opacity-50"
          >
            {pending ? "..." : "Lưu"}
          </button>
        )}
      </div>
      {state.message && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}

export function UserActiveToggle({
  id,
  isActive,
  disabled,
}: {
  id: number;
  isActive: boolean;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleUserActive, {
    message: "",
  });
  if (disabled) {
    return null;
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className={`rounded px-3 py-1 text-sm disabled:opacity-50 ${
          isActive
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-green-100 text-green-700 hover:bg-green-200"
        }`}
      >
        {pending ? "..." : isActive ? "Khóa" : "Mở khóa"}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}

/**
 * Xóa hẳn một tài khoản — chỉ quản trị, và không tự xóa mình.
 *
 * Hỏi lại bằng hộp thoại xác nhận, có nêu rõ email: bảng người dùng xếp sát
 * nhau nên bấm nhầm dòng là chuyện thường, mà đây là thao tác không hoàn tác
 * được. Nhắc luôn rằng KHÓA mới là cách nên dùng cho thuyền viên rời tàu.
 */
export function UserDeleteButton({
  id,
  email,
  disabled,
}: {
  id: number;
  email: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(deleteUser, {
    message: "",
  });
  if (disabled) {
    return null;
  }
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Xóa hẳn tài khoản "${email}"?\n\n` +
              "Thao tác này KHÔNG hoàn tác được. Ủy quyền và phân công đội tàu của " +
              "người này bị xóa theo; yêu cầu vật tư họ đã lập vẫn giữ nguyên.\n\n" +
              "Thuyền viên rời tàu thì nên KHÓA thay vì xóa — khóa xong vẫn tra lại được."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded px-3 py-1 text-sm text-red-700 underline decoration-dotted hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Đang xóa..." : "Xóa"}
      </button>
      {state.message && !state.success && (
        <p className="mt-1 max-w-56 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
