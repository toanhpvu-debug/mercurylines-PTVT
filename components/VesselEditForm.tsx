"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateVessel } from "@/app/actions";
import ChonMayChinh from "@/components/ChonMayChinh";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

type VesselData = {
  id: number;
  code: string;
  name: string;
  imo: string | null;
  flag: string | null;
  vesselType: string | null;
  status: string;
  mainEngineGroup: string | null;
  mainEngineModel: string | null;
};

export default function VesselEditForm({ vessel }: { vessel: VesselData }) {
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(updateVessel, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={vessel.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("vessels.maTau")}>
          <Input name="code" defaultValue={v.code ?? vessel.code} required />
        </Field>
        <Field label={t("vessels.tenTau")}>
          <Input name="name" defaultValue={v.name ?? vessel.name} required />
        </Field>
        <Field label="IMO number">
          <Input name="imo" defaultValue={v.imo ?? vessel.imo ?? ""} />
        </Field>
        <Field label={t("vessels.coTau")}>
          <Input name="flag" defaultValue={v.flag ?? vessel.flag ?? ""} />
        </Field>
        <Field label={t("vessels.loaiTau")} className="sm:col-span-2">
          <Input
            name="vesselType"
            defaultValue={v.vesselType ?? vessel.vesselType ?? ""}
          />
        </Field>
      </div>
      <ChonMayChinh
        nhom={v.mainEngineGroup ?? vessel.mainEngineGroup ?? ""}
        model={v.mainEngineModel ?? vessel.mainEngineModel ?? ""}
      />
      <Field label={t("chung.trangThai")}>
        <Select name="status" defaultValue={v.status ?? vessel.status}>
          <option value="ACTIVE">{tTuDo("labels.vesselStatus_ACTIVE")}</option>
          <option value="MAINTENANCE">{t("vessels.trangThaiBaoDuong")}</option>
          <option value="INACTIVE">
            {tTuDo("labels.vesselStatus_INACTIVE")}
          </option>
        </Select>
      </Field>
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<Save className="size-4" />}
      >
        {pending ? t("chung.dangLuu") : t("vessels.luuThayDoi")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
