"use client";

import { useActionState } from "react";
import { createUser } from "@/app/actions";
import ChonChucDanhGiuVatTu from "@/components/ChonChucDanhGiuVatTu";
import { NHOM_CHUC_DANH } from "@/lib/roles";
import { useNgonNgu } from "@/lib/i18n/client";

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
      <input
        name="name"
        placeholder={t("vessels.cotHoTen")}
        className="w-full rounded border p-2"
        defaultValue={v.name ?? ""}
        required
      />
      <input
        name="email"
        type="email"
        placeholder={t("vessels.phEmailDangNhap")}
        className="w-full rounded border p-2"
        defaultValue={v.email ?? ""}
        required
      />
      <input
        name="password"
        type="password"
        placeholder={t("vessels.phMatKhau")}
        className="w-full rounded border p-2"
        minLength={8}
        required
      />
      <select
        name="role"
        className="w-full rounded border p-2"
        defaultValue={v.role ?? "CREW"}
      >
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
      </select>
      <select
        name="vesselId"
        className="w-full rounded border p-2"
        defaultValue={v.vesselId ?? ""}
      >
        <option value="">{t("vessels.khongGanTauDayDu")}</option>
        {vessels.map((vessel) => (
          <option key={vessel.id} value={vessel.id}>
            {vessel.label}
          </option>
        ))}
      </select>
      <ChonChucDanhGiuVatTu giaTri="" />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("vessels.dangTao") : t("vessels.taoNguoiDung")}
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
