"use client";

import { startTransition, useActionState, useState } from "react";
import { Layers, Pencil, Plus, Ruler, Save, Trash2 } from "lucide-react";
import {
  deletePaintArea,
  deletePaintSchemeLayer,
  savePaintArea,
  savePaintSchemeLayer,
} from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Badge,
  Button,
  Card,
  CardHeader,
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

export type ProductOption = {
  id: number;
  label: string;
  coverage: number;
  dftPerCoat: number;
  uom: string;
};

export type AreaRow = {
  id: number;
  name: string;
  areaM2: number;
  sortOrder: number;
  notes: string | null;
};

export type LayerRow = {
  id: number;
  layerNo: number;
  coats: number;
  dft: number;
  notes: string | null;
  productId: number;
  productLabel: string;
  coverage: number;
  uom: string;
};

// Lượng sơn lý thuyết cần cho một lớp: diện tích × số lớp ÷ độ phủ.
// Không có độ phủ thì không đoán bừa — trả null để hiển thị "—".
export function estimateLitres(
  areaM2: number,
  coats: number,
  coverage: number
): number | null {
  if (!areaM2 || !coverage) return null;
  return Math.round(((areaM2 * coats) / coverage) * 10) / 10;
}

// Một dòng lớp sơn trong sơ đồ — xem, sửa tại chỗ, hoặc xóa.
function SchemeLayerRow({
  vesselId,
  areaId,
  areaM2,
  layer,
  products,
  canEdit,
  onDelete,
}: {
  vesselId: number;
  areaId: number;
  areaM2: number;
  layer: LayerRow;
  products: ProductOption[];
  canEdit: boolean;
  onDelete: (formData: FormData) => void;
}) {
  const { t, so } = useNgonNgu();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(savePaintSchemeLayer, {
    message: "",
  });
  const est = estimateLitres(areaM2, layer.coats, layer.coverage);

  if (editing && canEdit) {
    return (
      <Tr className="bg-[var(--surface-sunken)]">
        <Td colSpan={7}>
          <form action={action} className="space-y-3">
            <input type="hidden" name="vesselId" value={vesselId} />
            <input type="hidden" name="areaId" value={areaId} />
            <input type="hidden" name="id" value={layer.id} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Field label={t("paint.son")} className="md:col-span-2">
                <Select
                  name="productId"
                  defaultValue={layer.productId}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("paint.lopThu")}>
                <Input
                  name="layerNo"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={layer.layerNo}
                  className="tabular"
                />
              </Field>
              <Field label={t("paint.soLopPhu")}>
                <Input
                  name="coats"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={layer.coats}
                  className="tabular"
                />
              </Field>
              <Field label="DFT (µm)">
                <Input
                  name="dft"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={layer.dft || ""}
                  className="tabular"
                />
              </Field>
              <Field label={t("chung.ghiChu")} className="md:col-span-5">
                <Input name="notes" defaultValue={layer.notes ?? ""} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                loading={pending}
                icon={<Save className="size-4" />}
              >
                {pending ? t("chung.dangLuu") : t("paint.luuLop")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                {t("chung.huy")}
              </Button>
              {state.message && (
                <Notice
                  tone={state.success ? "success" : "danger"}
                  className="basis-full"
                >
                  {state.message}
                </Notice>
              )}
            </div>
          </form>
        </Td>
      </Tr>
    );
  }

  return (
    <Tr>
      <Td>
        <Badge tone="muted">{layer.layerNo}</Badge>
      </Td>
      <Td>{layer.productLabel}</Td>
      <Td align="right">{layer.coats}</Td>
      <Td align="right">{layer.dft || "—"}</Td>
      <Td align="right">
        {est === null ? (
          <span
            className="text-[var(--text-muted)]"
            title={t("paint.goiYThieuDuLieuUocTinh")}
          >
            —
          </span>
        ) : (
          `${so(est)} ${layer.uom}`
        )}
      </Td>
      <Td>
        <span className="text-[var(--text-secondary)]">
          {layer.notes ?? ""}
        </span>
      </Td>
      {canEdit && (
        <Td align="right" className="whitespace-nowrap print:hidden">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              icon={<Pencil className="size-4" />}
            >
              {t("chung.sua")}
            </Button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!confirm(t("paint.xacNhanXoaLop"))) return;
                const fd = new FormData(e.currentTarget);
                startTransition(() => onDelete(fd));
              }}
            >
              <input type="hidden" name="vesselId" value={vesselId} />
              <input type="hidden" name="id" value={layer.id} />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="size-4" />}
              >
                {t("chung.xoa")}
              </Button>
            </form>
          </div>
        </Td>
      )}
    </Tr>
  );
}

export function PaintAreaAddForm({ vesselId }: { vesselId: number }) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(savePaintArea, {
    message: "",
  });
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="primary"
        onClick={() => setOpen(true)}
        icon={<Plus className="size-4" />}
      >
        {t("paint.themKhuVuc")}
      </Button>
    );
  }
  return (
    <div className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Ruler className="size-4 text-[var(--text-muted)]" />
        {t("paint.themKhuVuc")}
      </p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="vesselId" value={vesselId} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field
            label={`${t("paint.tenKhuVuc")} *`}
            className="md:col-span-2"
          >
            <Input
              name="name"
              required
              placeholder={t("paint.phTenKhuVuc")}
            />
          </Field>
          <Field label={t("paint.dienTich")}>
            <Input
              name="areaM2"
              type="number"
              step="0.1"
              min="0"
              className="tabular"
            />
          </Field>
          <Field label={t("paint.thuTu")}>
            <Input
              name="sortOrder"
              type="number"
              step="1"
              defaultValue={0}
              className="tabular"
            />
          </Field>
          <Field label={t("chung.ghiChu")} className="md:col-span-4">
            <Input name="notes" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            loading={pending}
            icon={<Save className="size-4" />}
          >
            {pending ? t("chung.dangLuu") : t("paint.luuKhuVuc")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("chung.dong")}
          </Button>
          {state.message && (
            <Notice
              tone={state.success ? "success" : "danger"}
              className="basis-full"
            >
              {state.message}
            </Notice>
          )}
        </div>
      </form>
    </div>
  );
}

export function PaintAreaCard({
  vesselId,
  area,
  layers,
  products,
  canEdit,
}: {
  vesselId: number;
  area: AreaRow;
  layers: LayerRow[];
  products: ProductOption[];
  canEdit: boolean;
}) {
  const { t, so } = useNgonNgu();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [areaState, areaAction, areaPending] = useActionState(savePaintArea, {
    message: "",
  });
  const [delState, delAction, delPending] = useActionState(deletePaintArea, {
    message: "",
  });
  const [layerState, layerAction, layerPending] = useActionState(
    savePaintSchemeLayer,
    { message: "" }
  );
  const [layerDelState, layerDelAction] = useActionState(
    deletePaintSchemeLayer,
    { message: "" }
  );

  const totalLitres = layers.reduce((sum, l) => {
    const est = estimateLitres(area.areaM2, l.coats, l.coverage);
    return sum + (est ?? 0);
  }, 0);

  return (
    <Card>
      <CardHeader
        icon={<Layers className="size-4" />}
        title={area.name}
        subtitle={
          <>
            {area.areaM2
              ? t("paint.nM2", { n: so(area.areaM2) })
              : t("paint.chuaNhapDienTich")}
            {" · "}
            {t("paint.nLopSoDo", { n: layers.length })}
            {totalLitres > 0 && (
              <>
                {" · "}
                <span className="text-brand-700 dark:text-brand-300">
                  {t("paint.uocTinhTronSoDo", { n: so(totalLitres) })}
                </span>
              </>
            )}
          </>
        }
        action={
          canEdit && (
            <div className="flex items-center gap-1.5 print:hidden">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setEditing((v) => !v)}
                icon={<Pencil className="size-4" />}
              >
                {editing ? t("chung.dong") : t("paint.suaKhuVuc")}
              </Button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !confirm(t("paint.xacNhanXoaKhuVuc", { ten: area.name }))
                  )
                    return;
                  const fd = new FormData(e.currentTarget);
                  startTransition(() => delAction(fd));
                }}
              >
                <input type="hidden" name="vesselId" value={vesselId} />
                <input type="hidden" name="id" value={area.id} />
                <Button
                  size="sm"
                  variant="danger"
                  loading={delPending}
                  icon={<Trash2 className="size-4" />}
                >
                  {t("chung.xoa")}
                </Button>
              </form>
            </div>
          )
        }
      />
      {area.notes && (
        <p className="-mt-2 mb-3 text-sm text-[var(--text-secondary)]">
          {area.notes}
        </p>
      )}
      {delState.message && (
        <Notice tone="danger" className="mb-3">
          {delState.message}
        </Notice>
      )}

      {editing && canEdit && (
        <form
          action={areaAction}
          className="mb-3 space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 print:hidden"
        >
          <input type="hidden" name="vesselId" value={vesselId} />
          <input type="hidden" name="id" value={area.id} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label={t("chung.ten")} className="md:col-span-2">
              <Input name="name" defaultValue={area.name} required />
            </Field>
            <Field label="m²">
              <Input
                name="areaM2"
                type="number"
                step="0.1"
                min="0"
                defaultValue={area.areaM2 || ""}
                className="tabular"
              />
            </Field>
            <Field label={t("paint.thuTu")}>
              <Input
                name="sortOrder"
                type="number"
                step="1"
                defaultValue={area.sortOrder}
                className="tabular"
              />
            </Field>
            <Field label={t("chung.ghiChu")} className="md:col-span-4">
              <Input name="notes" defaultValue={area.notes ?? ""} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              loading={areaPending}
              icon={<Save className="size-4" />}
            >
              {t("chung.luu")}
            </Button>
            {areaState.message && (
              <Notice
                tone={areaState.success ? "success" : "danger"}
                className="basis-full"
              >
                {areaState.message}
              </Notice>
            )}
          </div>
        </form>
      )}

      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              <Th className="w-16">{t("paint.cotLop")}</Th>
              <Th>{t("paint.son")}</Th>
              <Th align="right">{t("paint.soLopPhu")}</Th>
              <Th align="right">DFT (µm)</Th>
              <Th align="right">{t("paint.cotUocTinhL")}</Th>
              <Th>{t("chung.ghiChu")}</Th>
              {canEdit && <Th className="print:hidden"></Th>}
            </tr>
          </thead>
          <tbody>
            {layers.length === 0 ? (
              <Tr>
                <Td
                  colSpan={canEdit ? 7 : 6}
                  align="center"
                  className="text-[var(--text-muted)]"
                >
                  {t("paint.chuaCoLop")}
                </Td>
              </Tr>
            ) : (
              layers.map((l) => (
                <SchemeLayerRow
                  key={l.id}
                  vesselId={vesselId}
                  areaId={area.id}
                  areaM2={area.areaM2}
                  layer={l}
                  products={products}
                  canEdit={canEdit}
                  onDelete={layerDelAction}
                />
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
      {layerDelState.message && (
        <Notice tone="danger" className="mt-2">
          {layerDelState.message}
        </Notice>
      )}

      {canEdit && (
        <div className="mt-3 print:hidden">
          {!adding ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setAdding(true)}
              icon={<Plus className="size-4" />}
            >
              {t("paint.themLopVaoSoDo")}
            </Button>
          ) : (
            <form
              action={layerAction}
              className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
            >
              <input type="hidden" name="vesselId" value={vesselId} />
              <input type="hidden" name="areaId" value={area.id} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Field
                  label={`${t("paint.loaiSon")} *`}
                  className="md:col-span-2"
                >
                  <Select name="productId" required>
                    <option value="">{t("paint.chonSon")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("paint.lopThu")}>
                  <Input
                    name="layerNo"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={layers.length + 1}
                    className="tabular"
                  />
                </Field>
                <Field label={t("paint.soLopPhu")}>
                  <Input
                    name="coats"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={1}
                    className="tabular"
                  />
                </Field>
                <Field label="DFT (µm)">
                  <Input
                    name="dft"
                    type="number"
                    min="0"
                    step="1"
                    className="tabular"
                  />
                </Field>
                <Field label={t("chung.ghiChu")} className="md:col-span-5">
                  <Input name="notes" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  loading={layerPending}
                  icon={<Plus className="size-4" />}
                >
                  {layerPending ? t("chung.dangLuu") : t("paint.themLop")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAdding(false)}
                >
                  {t("chung.dong")}
                </Button>
                {layerState.message && (
                  <Notice
                    tone={layerState.success ? "success" : "danger"}
                    className="basis-full"
                  >
                    {layerState.message}
                  </Notice>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
