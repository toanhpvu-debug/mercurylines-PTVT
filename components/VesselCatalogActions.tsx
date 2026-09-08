"use client";

import { useActionState } from "react";
import { Plus, Unlink } from "lucide-react";
import {
  assignMaterialToVessel,
  unassignMaterialFromVessel,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice, Select } from "@/components/ui";

type MaterialOption = {
  id: number;
  code: string;
  nameVn: string;
  materialType: string;
};

export function VesselMaterialAddForm({
  vesselId,
  available,
}: {
  vesselId: number;
  available: MaterialOption[];
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(assignMaterialToVessel, {
    message: "",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="min-w-64 flex-1 sm:max-w-lg">
        <Select name="materialId" defaultValue="" required>
          <option value="">{t("materials.optChonTuGoc")}</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} - {m.nameVn}
              {m.materialType === "SPARE" ? ` (${t("chung.phuTung")})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        disabled={available.length === 0}
        icon={<Plus className="size-4" />}
      >
        {t("materials.nutThemVaoTau")}
      </Button>
      {available.length === 0 && (
        <span className="text-xs text-[var(--text-muted)]">
          {t("materials.tauDaCoDu")}
        </span>
      )}
      {state.message && (
        <Notice tone="danger" className="basis-full">
          {state.message}
        </Notice>
      )}
    </form>
  );
}

export function VesselMaterialRemoveButton({
  vesselId,
  materialId,
  code,
}: {
  vesselId: number;
  materialId: number;
  code: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(
    unassignMaterialFromVessel,
    { message: "" }
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("materials.xacNhanGo", { ma: code }))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="materialId" value={materialId} />
      <Button
        type="submit"
        size="sm"
        variant="danger"
        loading={pending}
        icon={<Unlink className="size-4" />}
      >
        {t("materials.nutGoKhoiTau")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
