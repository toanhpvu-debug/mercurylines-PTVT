"use client";

import { useActionState, type ReactNode } from "react";
import { PackageCheck } from "lucide-react";
import {
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export function POStatusButton({
  id,
  status,
  label,
  variant = "secondary",
  icon,
  className,
}: {
  id: number;
  status: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  className?: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(
    updatePurchaseOrderStatus,
    { message: "" }
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          status === "CANCELLED" &&
          !window.confirm(t("purchasing.xacNhanHuyDon"))
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button
        variant={variant}
        icon={icon}
        loading={pending}
        className={className}
      >
        {label}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}

type ReceiveLine = {
  id: number;
  description: string;
  partNo: string | null;
  uom: string;
  quantity: number;
  quantityReceived: number;
  hasMaterial: boolean;
};

type WarehouseOption = { id: number; code: string; name: string };

export function ReceiveGoodsForm({
  poId,
  lines,
  warehouses,
}: {
  poId: number;
  lines: ReceiveLine[];
  warehouses: WarehouseOption[];
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(receivePurchaseOrder, {
    message: "",
  });
  const anyMaterial = lines.some((l) => l.hasMaterial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={poId} />
      {anyMaterial && (
        <Field label={t("purchasing.khoNhanVao")} className="max-w-sm">
          <Select name="warehouseId" defaultValue="" required>
            <option value="">{t("purchasing.chonKho")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              <Th>{t("chung.moTa")}</Th>
              <Th>Part No.</Th>
              <Th>{t("chung.donVi")}</Th>
              <Th align="right">{t("purchasing.cotSlDat")}</Th>
              <Th align="right">{t("purchasing.cotDaNhan")}</Th>
              <Th>{t("purchasing.cotNhanLanNay")}</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const remaining = Math.max(0, l.quantity - l.quantityReceived);
              return (
                <Tr key={l.id}>
                  <Td>
                    {l.description}
                    {!l.hasMaterial && (
                      <span className="ml-1 text-xs text-[var(--text-muted)]">
                        {t("purchasing.ngoaiDanhMuc")}
                      </span>
                    )}
                  </Td>
                  <Td className="font-display text-xs tracking-wide">
                    {l.partNo}
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {l.uom}
                    </span>
                  </Td>
                  <Td align="right">{l.quantity}</Td>
                  <Td align="right">
                    <span
                      className={
                        remaining <= 0
                          ? "font-semibold text-[var(--text-success)]"
                          : undefined
                      }
                    >
                      {l.quantityReceived}
                    </span>
                  </Td>
                  <Td>
                    <div className="w-24">
                      <Input
                        name={`recv_${l.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max={remaining}
                        defaultValue={0}
                        disabled={remaining <= 0}
                        className="tabular"
                      />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
      <Button
        variant="primary"
        icon={<PackageCheck className="size-4" />}
        loading={pending}
      >
        {pending
          ? t("purchasing.dangGhiNhan")
          : t("purchasing.nutGhiNhanNhanHang")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
