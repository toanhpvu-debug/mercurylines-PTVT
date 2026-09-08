"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { approveRequestQuantities } from "@/app/actions";
import {
  Button,
  Input,
  Notice,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

type ItemInput = {
  id: number;
  code: string;
  name: string;
  quantity: number;
  rob: number;
  /** SL tàu đã duyệt ở bước trước — trần cho bước duyệt của công ty. */
  tauDuyet: number;
};

export default function RequestApprovalForm({
  requestId,
  items,
  capDuyet,
}: {
  requestId: number;
  items: ItemInput[];
  capDuyet: "TAU" | "CONG_TY";
}) {
  const { t } = useNgonNgu();
  const laCongTy = capDuyet === "CONG_TY";
  // Cấp công ty không được duyệt vượt số tàu đã duyệt — trần là số của bước trước.
  const tran = (item: ItemInput) =>
    laCongTy ? Math.min(item.quantity, item.tauDuyet) : item.quantity;
  const [state, formAction, pending] = useActionState(
    approveRequestQuantities,
    { message: "" }
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={requestId} />
      <p className="text-sm text-[var(--text-secondary)]">
        {laCongTy
          ? t("requests.huongDanDuyetCongTy")
          : t("requests.huongDanDuyetTau")}
      </p>
      <TableWrap className="shadow-none">
        <Table dense>
          <thead>
            <tr>
              <Th>{t("chung.ma")}</Th>
              <Th>{t("chung.ten")}</Th>
              <Th align="right">{t("requests.cotRob")}</Th>
              <Th align="right">{t("requests.slYeuCau")}</Th>
              {laCongTy && <Th align="right">{t("requests.slTauDuyet")}</Th>}
              <Th>
                {laCongTy ? t("requests.slCongTyDuyet") : t("requests.slDuyet")}
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.code}</Td>
                <Td>{item.name}</Td>
                <Td align="right">{item.rob}</Td>
                <Td align="right">{item.quantity}</Td>
                {laCongTy && <Td align="right">{item.tauDuyet}</Td>}
                <Td>
                  <div className="w-24">
                    <Input
                      name={`approved_${item.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max={tran(item)}
                      defaultValue={tran(item)}
                      className="tabular"
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <Button
        variant="primary"
        loading={pending}
        icon={<Check className="size-4" />}
      >
        {pending
          ? t("requests.dangDuyet")
          : laCongTy
            ? t("requests.nutCongTyDuyet")
            : t("requests.nutTauDuyetVaChuyen")}
      </Button>
      {state.message && <Notice tone="danger">{state.message}</Notice>}
    </form>
  );
}
