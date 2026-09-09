"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { setVesselFormStandard } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Input, Select } from "@/components/ui";

type StandardOption = { key: string; label: string };

export default function VesselFormStandardRow({
  id,
  formStandard,
  hullNo,
  standards,
}: {
  id: number;
  formStandard: string;
  hullNo: string | null;
  standards: StandardOption[];
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(setVesselFormStandard, {
    message: "",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="w-44">
        <Select name="formStandard" defaultValue={formStandard}>
          {standards.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-28">
        <Input
          name="hullNo"
          defaultValue={hullNo ?? ""}
          placeholder="Hull No."
        />
      </div>
      <Button
        size="sm"
        icon={<Save className="size-4" />}
        loading={pending}
      >
        {t("chung.luu")}
      </Button>
      {state.message && (
        <span
          className={`text-xs ${
            state.success
              ? "text-[var(--text-success)]"
              : "text-[var(--text-danger)]"
          }`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
