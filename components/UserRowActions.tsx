"use client";

import { useActionState } from "react";
import { Lock, Save, Trash2, Unlock } from "lucide-react";
import { deleteUser, toggleUserActive, updateUserRole } from "@/app/actions";
import { NHOM_CHUC_DANH } from "@/lib/roles";
import ChonChucDanhGiuVatTu from "@/components/ChonChucDanhGiuVatTu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Select } from "@/components/ui";

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
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(updateUserRole, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          name="role"
          defaultValue={v.role ?? role}
          disabled={disabled}
          className="max-w-44"
        >
          {/* Tên nhóm nằm trong lib/roles.ts (dữ liệu, không sửa) — tra từ
              điển theo chức danh đứng đầu nhóm. */}
          {NHOM_CHUC_DANH.map((g) => (
            <optgroup
              key={g.vaiTro[0]}
              label={tTuDo(`vessels.nhomChucDanh_${g.vaiTro[0]}`)}
            >
              {g.vaiTro.map((r) => (
                <option key={r} value={r}>
                  {tTuDo(`labels.role_${r}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Select
          name="vesselId"
          defaultValue={v.vesselId ?? vesselId ?? ""}
          disabled={disabled}
          className="max-w-44"
        >
          <option value="">{t("vessels.khongGanTau")}</option>
          {vessels.map((vessel) => (
            <option key={vessel.id} value={vessel.id}>
              {vessel.label}
            </option>
          ))}
        </Select>
        <ChonChucDanhGiuVatTu
          giaTri={v.rankCode ?? rankCode ?? ""}
          vaiTro={role}
          disabled={disabled}
          gonGang
        />
        {!disabled && (
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={pending}
            icon={<Save className="size-4" />}
          >
            {t("chung.luu")}
          </Button>
        )}
      </div>
      {state.message && (
        <p className="text-xs text-[var(--text-danger)]">{state.message}</p>
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
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(toggleUserActive, {
    message: "",
  });
  if (disabled) {
    return null;
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        loading={pending}
        icon={
          isActive ? <Lock className="size-4" /> : <Unlock className="size-4" />
        }
      >
        {isActive ? t("vessels.khoaTaiKhoan") : t("vessels.moKhoaTaiKhoan")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">
          {state.message}
        </p>
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
  const { t } = useNgonNgu();
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
        if (!window.confirm(t("vessels.xacNhanXoaTaiKhoan", { email }))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="danger"
        loading={pending}
        icon={<Trash2 className="size-4" />}
      >
        {pending ? t("vessels.dangXoa") : t("chung.xoa")}
      </Button>
      {state.message && !state.success && (
        <p className="mt-1 max-w-56 text-xs text-[var(--text-danger)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
