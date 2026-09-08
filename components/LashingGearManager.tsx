"use client";

import { useActionState } from "react";
import {
  createLashingGear,
  deleteLashingGear,
  updateLashingGear,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

type Gear = {
  id: number;
  name: string;
  partNo: string | null;
  minQty: number;
  standardQty: number;
};

export function LashingGearRow({ gear }: { gear: Gear }) {
  const { t } = useNgonNgu();
  const [uState, uAction, uPending] = useActionState(updateLashingGear, {
    message: "",
  });
  const [dState, dAction, dPending] = useActionState(deleteLashingGear, {
    message: "",
  });
  const v = uState.values ?? {};
  return (
    <div className="border-b py-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={uAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={gear.id} />
          <input
            name="name"
            defaultValue={v.name ?? gear.name}
            className="w-64 rounded border p-1 text-sm"
            required
          />
          <input
            name="partNo"
            defaultValue={v.partNo ?? gear.partNo ?? ""}
            placeholder="Part No."
            className="w-40 rounded border p-1 text-sm"
          />
          <input
            name="minQty"
            type="number"
            step="1"
            min="0"
            defaultValue={v.minQty ?? gear.minQty}
            className="w-24 rounded border p-1 text-sm"
            title={t("vessels.slToiThieuFullLoad")}
          />
          <input
            name="standardQty"
            type="number"
            step="1"
            min="0"
            defaultValue={v.standardQty ?? gear.standardQty}
            className="w-24 rounded border p-1 text-sm"
            title={t("vessels.trangBiChuan")}
          />
          <button
            disabled={uPending}
            className="rounded border px-2 py-1 text-sm hover:bg-blue-50 disabled:opacity-50"
          >
            {uPending ? "..." : t("chung.luu")}
          </button>
          {uState.message && (
            <span
              className={`text-xs ${
                uState.success ? "text-green-700" : "text-red-600"
              }`}
            >
              {uState.message}
            </span>
          )}
        </form>
        <form
          action={dAction}
          onSubmit={(e) => {
            if (
              !window.confirm(
                t("vessels.xacNhanXoaDungCu", { ten: gear.name })
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={gear.id} />
          <button
            disabled={dPending}
            className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {t("chung.xoa")}
          </button>
        </form>
      </div>
      {dState.message && (
        <p className="mt-1 text-xs text-red-600">
          {t("chung.xoa")}: {dState.message}
        </p>
      )}
    </div>
  );
}

export function LashingGearAddForm({ vesselId }: { vesselId: number }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createLashingGear, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input
        name="name"
        placeholder={t("vessels.phTenDungCuMoi")}
        defaultValue={v.name ?? ""}
        className="w-64 rounded border p-1 text-sm"
        required
      />
      <input
        name="partNo"
        placeholder="Part No."
        defaultValue={v.partNo ?? ""}
        className="w-40 rounded border p-1 text-sm"
      />
      <input
        name="minQty"
        type="number"
        step="1"
        min="0"
        placeholder={t("vessels.slToiThieu")}
        className="w-24 rounded border p-1 text-sm"
        defaultValue={v.minQty ?? 0}
      />
      <input
        name="standardQty"
        type="number"
        step="1"
        min="0"
        placeholder={t("vessels.chuan")}
        className="w-24 rounded border p-1 text-sm"
        defaultValue={v.standardQty ?? 0}
      />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "..." : t("vessels.themDungCu")}
      </button>
      {state.message && (
        <p
          className={`text-xs ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
