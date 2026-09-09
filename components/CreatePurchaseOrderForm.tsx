"use client";

import { useActionState, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { createPurchaseOrder } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Badge,
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

type PendingLine = {
  id: number;
  requestNo: string;
  kind: string;
  description: string;
  partNo: string | null;
  uom: string;
  remaining: number;
};

type SupplierOption = { id: number; code: string; name: string };

export default function CreatePurchaseOrderForm({
  vesselId,
  suppliers,
  lines,
  defaultDate,
}: {
  vesselId: number;
  suppliers: SupplierOption[];
  lines: PendingLine[];
  defaultDate: string;
}) {
  const { t, tTuDo, so } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createPurchaseOrder, {
    message: "",
  });
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [prices, setPrices] = useState<Record<number, string>>({});
  const selectedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("purchasing.nhaCungCap")}>
          <Select name="supplierId" defaultValue="" required>
            <option value="">{t("purchasing.chonNcc")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("purchasing.tienTe")}>
          <Select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="VND">VND</option>
            <option value="SGD">SGD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label={t("purchasing.ngayCanHang")}>
          <Input name="expectedDate" type="date" defaultValue={defaultDate} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("purchasing.labelSubject")}>
          <Input name="subject" placeholder={t("purchasing.phSubject")} />
        </Field>
        <Field label={t("purchasing.labelYref")}>
          <Input name="supplierRef" placeholder={t("purchasing.phYref")} />
        </Field>
      </div>
      <Field label={t("chung.ghiChu")}>
        <Input name="notes" placeholder={t("purchasing.phGhiChuDon")} />
      </Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("purchasing.chietKhau")}>
          <Input
            name="discountPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={0}
            className="tabular"
          />
        </Field>
        <Field label={t("purchasing.phiVanChuyen")}>
          <Input
            name="transportFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="tabular"
          />
        </Field>
        <Field label={t("purchasing.phiGiaoLenTau")}>
          <Input
            name="deliveryFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="tabular"
          />
        </Field>
      </div>

      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              <Th>{t("chung.chon")}</Th>
              <Th>{t("purchasing.cotSoYeuCau")}</Th>
              <Th>{t("chung.moTa")}</Th>
              <Th>Part No.</Th>
              <Th>{t("chung.donVi")}</Th>
              <Th>{t("purchasing.cotSlCanMua")}</Th>
              <Th>{t("purchasing.cotDonGia")}</Th>
              <Th align="right">{t("purchasing.cotThanhTien")}</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const isChecked = !!checked[l.id];
              const price = Number(prices[l.id] ?? 0);
              const amount = (Number.isFinite(price) ? price : 0) * l.remaining;
              return (
                <Tr
                  key={l.id}
                  className={
                    isChecked
                      ? "bg-brand-500/5"
                      : "transition-colors hover:bg-[var(--surface-sunken)]/50"
                  }
                >
                  <Td>
                    <input
                      type="checkbox"
                      name={`chk_${l.id}`}
                      checked={isChecked}
                      onChange={(e) =>
                        setChecked({ ...checked, [l.id]: e.target.checked })
                      }
                      className="size-4 rounded accent-brand-600"
                    />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="font-display text-xs tracking-wide">
                      {l.requestNo}
                    </span>{" "}
                    <Badge tone={l.kind === "SPARE" ? "brand" : "neutral"}>
                      {tTuDo(`labels.type_${l.kind === "SPARE" ? "SPARE" : "STORE"}`)}
                    </Badge>
                  </Td>
                  <Td>{l.description}</Td>
                  <Td className="font-display text-xs tracking-wide">
                    {l.partNo}
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {l.uom}
                    </span>
                  </Td>
                  <Td>
                    <div className="w-24">
                      <Input
                        name={`qty_${l.id}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={l.remaining}
                        className="tabular"
                      />
                    </div>
                  </Td>
                  <Td>
                    <div className="w-28">
                      <Input
                        name={`price_${l.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={prices[l.id] ?? ""}
                        onChange={(e) =>
                          setPrices({ ...prices, [l.id]: e.target.value })
                        }
                        placeholder="0.00"
                        className="tabular"
                      />
                    </div>
                  </Td>
                  <Td align="right" className="text-[var(--text-secondary)]">
                    {amount ? so(amount) : ""}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      <Button
        variant="primary"
        icon={<ShoppingCart className="size-4" />}
        loading={pending}
        disabled={selectedCount === 0}
      >
        {pending
          ? t("purchasing.dangTao")
          : t("purchasing.nutTaoDonSoDong", { n: selectedCount })}
      </Button>
      {state.message && <Notice tone="danger">{state.message}</Notice>}
    </form>
  );
}
