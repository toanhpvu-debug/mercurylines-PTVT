"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createVessel } from "@/app/actions";
import ChonMayChinh from "@/components/ChonMayChinh";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice } from "@/components/ui";

export default function VesselForm() {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createVessel, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <Field label={t("vessels.maTau")}>
        <Input
          name="code"
          placeholder={t("vessels.phMaTau")}
          defaultValue={v.code ?? ""}
          required
        />
      </Field>
      <Field label={t("vessels.tenTau")}>
        <Input
          name="name"
          placeholder={t("vessels.phTenTau")}
          defaultValue={v.name ?? ""}
          required
        />
      </Field>
      <Field label="IMO">
        <Input
          name="imo"
          placeholder="IMO number"
          defaultValue={v.imo ?? ""}
        />
      </Field>
      <Field label={t("vessels.coTau")}>
        <Input
          name="flag"
          placeholder={t("vessels.coTau")}
          defaultValue={v.flag ?? ""}
        />
      </Field>
      <Field label={t("vessels.loaiTau")}>
        <Input
          name="vesselType"
          placeholder={t("vessels.loaiTau")}
          defaultValue={v.vesselType ?? ""}
        />
      </Field>
      <ChonMayChinh
        nhom={v.mainEngineGroup ?? ""}
        model={v.mainEngineModel ?? ""}
      />
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<Plus className="size-4" />}
      >
        {pending ? t("chung.dangLuu") : t("vessels.themTau")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
