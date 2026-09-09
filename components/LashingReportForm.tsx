"use client";

import { useActionState } from "react";
import { Printer } from "lucide-react";
import { createLashingReport } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Input,
  Notice,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";

type GearInput = {
  id: number;
  name: string;
  partNo: string | null;
  minQty: number;
  standardQty: number;
  lastInOrder: number | null;
  lastOutOfOrder: number | null;
};

export default function LashingReportForm({
  vesselId,
  gears,
  defaultDate,
}: {
  vesselId: number;
  gears: GearInput[];
  defaultDate: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createLashingReport, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("vessels.ngayBaoCao")}>
          <Input
            name="reportDate"
            type="date"
            defaultValue={v.reportDate ?? defaultDate}
            required
          />
        </Field>
        <Field label={t("vessels.soChuyen")}>
          <Input
            name="voyageNo"
            placeholder={t("vessels.phSoChuyen")}
            defaultValue={v.voyageNo ?? ""}
          />
        </Field>
        <Field label={t("vessels.viTriBaoCao")}>
          <Input
            name="position"
            placeholder={t("vessels.phViTri")}
            defaultValue={v.position ?? ""}
          />
        </Field>
      </div>
      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              <Th>{t("vessels.dungCuChangBuoc")}</Th>
              <Th>Part No.</Th>
              <Th align="right">{t("vessels.slToiThieu")}</Th>
              <Th align="right">{t("vessels.trangBiChuan")}</Th>
              <Th>{t("vessels.conDungDuoc")}</Th>
              <Th>{t("vessels.biHong")}</Th>
            </tr>
          </thead>
          <tbody>
            {gears.map((gear) => (
              <Tr key={gear.id}>
                <Td className="font-medium">{gear.name}</Td>
                <Td className="font-display text-xs tracking-wide whitespace-nowrap text-[var(--text-secondary)]">
                  {gear.partNo}
                </Td>
                <Td align="right">{gear.minQty}</Td>
                <Td align="right">{gear.standardQty}</Td>
                <Td>
                  <Input
                    name={`inOrder_${gear.id}`}
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={
                      v[`inOrder_${gear.id}`] ?? gear.lastInOrder ?? 0
                    }
                    className="tabular w-28"
                    required
                  />
                </Td>
                <Td>
                  <Input
                    name={`outOfOrder_${gear.id}`}
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={
                      v[`outOfOrder_${gear.id}`] ?? gear.lastOutOfOrder ?? 0
                    }
                    className="tabular w-28"
                    required
                  />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<Printer className="size-4" />}
      >
        {pending ? t("chung.dangLuu") : t("vessels.lapBaoCaoVaIn")}
      </Button>
      {state.message && <Notice tone="danger">{state.message}</Notice>}
    </form>
  );
}
