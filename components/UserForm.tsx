"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createUser } from "@/app/actions";
import ChonChucDanhGiuVatTu from "@/components/ChonChucDanhGiuVatTu";
import { NHOM_CHUC_DANH } from "@/lib/roles";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { PasswordInput } from "@/components/ui-client";

type VesselOption = {
  id: number;
  label: string;
};

export default function UserForm({ vessels }: { vessels: VesselOption[] }) {
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createUser, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <Field label={t("vessels.cotHoTen")}>
        <Input
          name="name"
          placeholder={t("vessels.cotHoTen")}
          defaultValue={v.name ?? ""}
          required
        />
      </Field>
      <Field label={t("login.email")}>
        <Input
          name="email"
          type="email"
          placeholder={t("vessels.phEmailDangNhap")}
          defaultValue={v.email ?? ""}
          required
        />
      </Field>
      <Field label={t("login.matKhau")} hint={t("vessels.phMatKhau")}>
        <PasswordInput
          name="password"
          placeholder="••••••••"
          minLength={8}
          required
          labels={{ show: t("login.hienMatKhau"), hide: t("login.anMatKhau") }}
        />
      </Field>
      <Field label={t("vessels.nhanVaiTro")}>
        <Select name="role" defaultValue={v.role ?? "CREW"}>
          {/* Tên nhóm nằm trong lib/roles.ts (dữ liệu, không sửa) — tra từ điển
              theo chức danh đứng đầu nhóm. */}
          {NHOM_CHUC_DANH.map((g) => (
            <optgroup
              key={g.vaiTro[0]}
              label={tTuDo(`vessels.nhomChucDanh_${g.vaiTro[0]}`)}
            >
              {g.vaiTro.map((r) => (
                <option key={r} value={r}>
                  {tTuDo(`labels.role_${r}`)} ({r})
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field label={t("chung.tau")}>
        <Select name="vesselId" defaultValue={v.vesselId ?? ""}>
          <option value="">{t("vessels.khongGanTauDayDu")}</option>
          {vessels.map((vessel) => (
            <option key={vessel.id} value={vessel.id}>
              {vessel.label}
            </option>
          ))}
        </Select>
      </Field>
      <ChonChucDanhGiuVatTu giaTri="" />
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<UserPlus className="size-4" />}
      >
        {pending ? t("vessels.dangTao") : t("vessels.taoNguoiDung")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
