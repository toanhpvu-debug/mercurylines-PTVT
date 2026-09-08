"use client";

import { startTransition, useActionState, useState } from "react";
import {
  deletePaintArea,
  deletePaintSchemeLayer,
  savePaintArea,
  savePaintSchemeLayer,
} from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

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
      <tr className="bg-blue-50/40">
        <td colSpan={7} className="p-2">
          <form action={action} className="space-y-2">
            <input type="hidden" name="vesselId" value={vesselId} />
            <input type="hidden" name="areaId" value={areaId} />
            <input type="hidden" name="id" value={layer.id} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs text-slate-600">
                  {t("paint.son")}
                </span>
                <select
                  name="productId"
                  defaultValue={layer.productId}
                  required
                  className="w-full rounded border p-2"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-600">
                  {t("paint.lopThu")}
                </span>
                <input
                  name="layerNo"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={layer.layerNo}
                  className="w-full rounded border p-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-600">
                  {t("paint.soLopPhu")}
                </span>
                <input
                  name="coats"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={layer.coats}
                  className="w-full rounded border p-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-600">
                  DFT (µm)
                </span>
                <input
                  name="dft"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={layer.dft || ""}
                  className="w-full rounded border p-2"
                />
              </label>
              <label className="block md:col-span-5">
                <span className="mb-1 block text-xs text-slate-600">
                  {t("chung.ghiChu")}
                </span>
                <input
                  name="notes"
                  defaultValue={layer.notes ?? ""}
                  className="w-full rounded border p-2"
                />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={pending}
                className="rounded bg-blue-700 px-4 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {pending ? t("chung.dangLuu") : t("paint.luuLop")}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-slate-600 hover:underline"
              >
                {t("chung.huy")}
              </button>
              {state.message && (
                <span
                  className={`text-sm ${
                    state.success ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {state.message}
                </span>
              )}
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="p-2 font-semibold text-blue-900">{layer.layerNo}</td>
      <td className="p-2">{layer.productLabel}</td>
      <td className="p-2 text-right">{layer.coats}</td>
      <td className="p-2 text-right">{layer.dft || "—"}</td>
      <td className="p-2 text-right">
        {est === null ? (
          <span
            className="text-slate-400"
            title={t("paint.goiYThieuDuLieuUocTinh")}
          >
            —
          </span>
        ) : (
          `${so(est)} ${layer.uom}`
        )}
      </td>
      <td className="p-2 text-slate-600">{layer.notes ?? ""}</td>
      {canEdit && (
        <td className="p-2 text-right whitespace-nowrap print:hidden">
          <button
            onClick={() => setEditing(true)}
            className="mr-3 text-xs text-blue-700 hover:underline"
          >
            {t("chung.sua")}
          </button>
          <form
            className="inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirm(t("paint.xacNhanXoaLop"))) return;
              const fd = new FormData(e.currentTarget);
              startTransition(() => onDelete(fd));
            }}
          >
            <input type="hidden" name="vesselId" value={vesselId} />
            <input type="hidden" name="id" value={layer.id} />
            <button className="text-xs text-red-600 hover:underline">
              {t("chung.xoa")}
            </button>
          </form>
        </td>
      )}
    </tr>
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
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
      >
        + {t("paint.themKhuVuc")}
      </button>
    );
  }
  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="font-semibold text-blue-950">{t("paint.themKhuVuc")}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.tenKhuVuc")} *
          </span>
          <input
            name="name"
            required
            placeholder={t("paint.phTenKhuVuc")}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.dienTich")}
          </span>
          <input
            name="areaM2"
            type="number"
            step="0.1"
            min="0"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.thuTu")}
          </span>
          <input
            name="sortOrder"
            type="number"
            step="1"
            defaultValue={0}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-4">
          <span className="mb-1 block text-sm text-slate-600">
            {t("chung.ghiChu")}
          </span>
          <input name="notes" className="w-full rounded border p-2" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("chung.dangLuu") : t("paint.luuKhuVuc")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-600 hover:underline"
        >
          {t("chung.dong")}
        </button>
        {state.message && (
          <span
            className={`text-sm ${
              state.success ? "text-green-700" : "text-red-600"
            }`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
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
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-blue-950">{area.name}</h4>
          <p className="text-sm text-slate-500">
            {area.areaM2
              ? t("paint.nM2", { n: so(area.areaM2) })
              : t("paint.chuaNhapDienTich")}
            {" · "}
            {t("paint.nLopSoDo", { n: layers.length })}
            {totalLitres > 0 && (
              <>
                {" · "}
                <span className="text-blue-800">
                  {t("paint.uocTinhTronSoDo", { n: so(totalLitres) })}
                </span>
              </>
            )}
          </p>
          {area.notes && (
            <p className="mt-1 text-sm text-slate-600">{area.notes}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-sm text-blue-700 hover:underline"
            >
              {editing ? t("chung.dong") : t("paint.suaKhuVuc")}
            </button>
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
              <button
                disabled={delPending}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {t("chung.xoa")}
              </button>
            </form>
          </div>
        )}
      </div>
      {delState.message && (
        <p className="mt-2 text-sm text-red-600">{delState.message}</p>
      )}

      {editing && canEdit && (
        <form
          action={areaAction}
          className="mt-3 space-y-3 rounded border border-blue-200 bg-blue-50/40 p-3"
        >
          <input type="hidden" name="vesselId" value={vesselId} />
          <input type="hidden" name="id" value={area.id} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-600">
                {t("chung.ten")}
              </span>
              <input
                name="name"
                defaultValue={area.name}
                required
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-600">m²</span>
              <input
                name="areaM2"
                type="number"
                step="0.1"
                min="0"
                defaultValue={area.areaM2 || ""}
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-600">
                {t("paint.thuTu")}
              </span>
              <input
                name="sortOrder"
                type="number"
                step="1"
                defaultValue={area.sortOrder}
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block md:col-span-4">
              <span className="mb-1 block text-sm text-slate-600">
                {t("chung.ghiChu")}
              </span>
              <input
                name="notes"
                defaultValue={area.notes ?? ""}
                className="w-full rounded border p-2"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={areaPending}
              className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {t("chung.luu")}
            </button>
            {areaState.message && (
              <span
                className={`text-sm ${
                  areaState.success ? "text-green-700" : "text-red-600"
                }`}
              >
                {areaState.message}
              </span>
            )}
          </div>
        </form>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-blue-50 text-left text-blue-900">
            <tr>
              <th className="p-2 w-16">{t("paint.cotLop")}</th>
              <th className="p-2">{t("paint.son")}</th>
              <th className="p-2 text-right">{t("paint.soLopPhu")}</th>
              <th className="p-2 text-right">DFT (µm)</th>
              <th className="p-2 text-right">{t("paint.cotUocTinhL")}</th>
              <th className="p-2">{t("chung.ghiChu")}</th>
              {canEdit && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {layers.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 7 : 6}
                  className="p-3 text-center text-slate-500"
                >
                  {t("paint.chuaCoLop")}
                </td>
              </tr>
            ) : (
              layers.map((l) => {
                return (
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {layerDelState.message && (
        <p className="mt-1 text-xs text-red-600">{layerDelState.message}</p>
      )}

      {canEdit && (
        <div className="mt-3">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="text-sm text-blue-700 hover:underline"
            >
              + {t("paint.themLopVaoSoDo")}
            </button>
          ) : (
            <form
              action={layerAction}
              className="space-y-3 rounded border border-blue-200 bg-blue-50/40 p-3"
            >
              <input type="hidden" name="vesselId" value={vesselId} />
              <input type="hidden" name="areaId" value={area.id} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm text-slate-600">
                    {t("paint.loaiSon")} *
                  </span>
                  <select
                    name="productId"
                    required
                    className="w-full rounded border p-2"
                  >
                    <option value="">{t("paint.chonSon")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-600">
                    {t("paint.lopThu")}
                  </span>
                  <input
                    name="layerNo"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={layers.length + 1}
                    className="w-full rounded border p-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-600">
                    {t("paint.soLopPhu")}
                  </span>
                  <input
                    name="coats"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={1}
                    className="w-full rounded border p-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-600">
                    DFT (µm)
                  </span>
                  <input
                    name="dft"
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded border p-2"
                  />
                </label>
                <label className="block md:col-span-5">
                  <span className="mb-1 block text-sm text-slate-600">
                    {t("chung.ghiChu")}
                  </span>
                  <input name="notes" className="w-full rounded border p-2" />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  disabled={layerPending}
                  className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {layerPending ? t("chung.dangLuu") : t("paint.themLop")}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="text-sm text-slate-600 hover:underline"
                >
                  {t("chung.dong")}
                </button>
                {layerState.message && (
                  <span
                    className={`text-sm ${
                      layerState.success ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {layerState.message}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
