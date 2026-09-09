"use client";

import { useActionState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  createLashingGear,
  deleteLashingGear,
  updateLashingGear,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Input } from "@/components/ui";

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
    <div className="border-b border-[var(--border-subtle)] py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <form action={uAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={gear.id} />
          <Input
            name="name"
            defaultValue={v.name ?? gear.name}
            className="w-64"
            required
          />
          <Input
            name="partNo"
            defaultValue={v.partNo ?? gear.partNo ?? ""}
            placeholder="Part No."
            className="w-40 font-display text-xs tracking-wide"
          />
          <Input
            name="minQty"
            type="number"
            step="1"
            min="0"
            defaultValue={v.minQty ?? gear.minQty}
            className="tabular w-24"
            title={t("vessels.slToiThieuFullLoad")}
          />
          <Input
            name="standardQty"
            type="number"
            step="1"
            min="0"
            defaultValue={v.standardQty ?? gear.standardQty}
            className="tabular w-24"
            title={t("vessels.trangBiChuan")}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={uPending}
            icon={<Save className="size-4" />}
          >
            {t("chung.luu")}
          </Button>
          {uState.message && (
            <span
              className={`text-xs ${
                uState.success
                  ? "text-[var(--text-success)]"
                  : "text-[var(--text-danger)]"
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
          <Button
            type="submit"
            size="sm"
            variant="danger"
            loading={dPending}
            icon={<Trash2 className="size-4" />}
          >
            {t("chung.xoa")}
          </Button>
        </form>
      </div>
      {dState.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">
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
      <Input
        name="name"
        placeholder={t("vessels.phTenDungCuMoi")}
        defaultValue={v.name ?? ""}
        className="w-64"
        required
      />
      <Input
        name="partNo"
        placeholder="Part No."
        defaultValue={v.partNo ?? ""}
        className="w-40 font-display text-xs tracking-wide"
      />
      <Input
        name="minQty"
        type="number"
        step="1"
        min="0"
        placeholder={t("vessels.slToiThieu")}
        className="tabular w-24"
        defaultValue={v.minQty ?? 0}
      />
      <Input
        name="standardQty"
        type="number"
        step="1"
        min="0"
        placeholder={t("vessels.chuan")}
        className="tabular w-24"
        defaultValue={v.standardQty ?? 0}
      />
      <Button
        type="submit"
        variant="primary"
        size="sm"
        loading={pending}
        icon={<Plus className="size-4" />}
      >
        {t("vessels.themDungCu")}
      </Button>
      {state.message && (
        <p
          className={`text-xs ${
            state.success
              ? "text-[var(--text-success)]"
              : "text-[var(--text-danger)]"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
