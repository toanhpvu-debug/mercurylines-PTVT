"use client";

import { useActionState, useState } from "react";
import { Plus, Power, PowerOff, Save, Trash2 } from "lucide-react";
import {
  deleteConsumableProduct,
  saveConsumableProduct,
  toggleConsumableProduct,
} from "@/app/consumable-actions";
import {
  CONSUMABLE_CATEGORIES,
  GRADES,
  UOM_GOI_Y,
} from "@/lib/consumables";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

export type ProductRow = {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  category: string;
  grade: string;
  maker: string | null;
  uom: string;
  sulphurMax: number | null;
  viscosity: number | null;
  density: number | null;
  bnValue: number | null;
  hazardClass: string | null;
  shelfLifeMonths: number | null;
  isActive: boolean;
};

/** Khung nhóm ô nhập (đặc tính danh nghĩa, an toàn & hạn dùng). */
const FIELDSET = "rounded-lg border border-[var(--border-subtle)] p-3";
const LEGEND = "px-1 text-xs font-medium text-[var(--text-secondary)]";

/**
 * Form thêm / sửa một mặt hàng.
 *
 * Ô nhập đổi theo NHÓM: hỏi lưu huỳnh của một can hóa chất tẩy rửa, hay hỏi
 * hạn dùng của một lô HFO, đều là ô trống vô nghĩa mà người dùng vẫn phải đọc
 * qua rồi bỏ trống.
 */
export function ConsumableProductForm({ row }: { row?: ProductRow }) {
  const { t, tTuDo } = useNgonNgu();
  const [state, action, pending] = useActionState(saveConsumableProduct, {
    message: "",
  });
  const [category, setCategory] = useState(row?.category ?? "FUEL");
  const laDau = category === "FUEL";
  const laNhon = category === "LUBE";
  const laHoaChat = category === "CHEMICAL";

  return (
    <form action={action} className="space-y-3">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-3 md:grid-cols-4">
        <Field label={`${t("chung.nhom")} *`}>
          <Select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CONSUMABLE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {tTuDo(`consumables.nhom_${c.value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`${t("consumables.chungLoai")} *`}>
          <Select name="grade" defaultValue={row?.grade} key={category}>
            {GRADES[category].map((g) => (
              <option key={g.value} value={g.value}>
                {tTuDo(`consumables.loai_${g.value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={`${t("consumables.tenMatHang")} *`}
          className="md:col-span-2"
        >
          <Input name="name" required defaultValue={row?.name} />
        </Field>
        <Field label={t("consumables.maTuSinh")}>
          <Input
            name="code"
            defaultValue={row?.code}
            placeholder={laDau ? "FO-0001" : laNhon ? "LO-0001" : "CH-0001"}
          />
        </Field>
        <Field label={t("consumables.hangSx")}>
          <Input name="maker" defaultValue={row?.maker ?? ""} />
        </Field>
        <Field label={`${t("consumables.donViTinh")} *`}>
          <Input
            name="uom"
            list="uom-goi-y"
            defaultValue={row?.uom ?? (laDau ? "MT" : "L")}
          />
          <datalist id="uom-goi-y">
            {(UOM_GOI_Y[category] ?? []).map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label={t("consumables.dungTichThung")}>
          <Input
            name="packSize"
            type="number"
            step="0.01"
            min="0"
            className="tabular"
          />
        </Field>
      </div>

      {(laDau || laNhon) && (
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>
            {t("consumables.dacTinhDanhNghia")}
          </legend>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            {t("consumables.ghiChuDacTinh")}
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            {laDau && (
              <Field label={t("consumables.luuHuynhToiDa")}>
                <Input
                  name="sulphurMax"
                  type="number"
                  step="0.001"
                  defaultValue={row?.sulphurMax ?? ""}
                  className="tabular"
                />
              </Field>
            )}
            <Field label={t("consumables.doNhot")}>
              <Input
                name="viscosity"
                type="number"
                step="0.1"
                defaultValue={row?.viscosity ?? ""}
                className="tabular"
              />
            </Field>
            <Field label={t("consumables.khoiLuongRiengNgan")}>
              <Input
                name="density"
                type="number"
                step="0.1"
                defaultValue={row?.density ?? ""}
                className="tabular"
              />
            </Field>
            {laNhon && (
              <Field label={t("consumables.tbn")}>
                <Input
                  name="bnValue"
                  type="number"
                  step="0.1"
                  defaultValue={row?.bnValue ?? ""}
                  className="tabular"
                />
              </Field>
            )}
          </div>
        </fieldset>
      )}

      {laHoaChat && (
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>{t("consumables.anToanHanDung")}</legend>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t("consumables.phanLoaiNguyHiemGhs")}>
              <Input
                name="hazardClass"
                defaultValue={row?.hazardClass ?? ""}
                placeholder={t("consumables.viDuNguyHiem")}
              />
            </Field>
            <Field
              label={t("consumables.hanDungThang")}
              hint={t("consumables.goiYHanDung")}
            >
              <Input
                name="shelfLifeMonths"
                type="number"
                min="0"
                step="1"
                defaultValue={row?.shelfLifeMonths ?? ""}
                className="tabular"
              />
            </Field>
            <Field label={t("consumables.ghiChuAnToan")}>
              <Input name="msdsNote" />
            </Field>
          </div>
        </fieldset>
      )}

      <Field label={t("chung.ghiChu")}>
        <Input name="notes" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={
            row ? <Save className="size-4" /> : <Plus className="size-4" />
          }
        >
          {pending
            ? t("chung.dangLuu")
            : row
              ? t("consumables.luuThayDoi")
              : t("consumables.themMatHang")}
        </Button>
      </div>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}

export function ConsumableProductActions({ row }: { row: ProductRow }) {
  const { t } = useNgonNgu();
  const [tState, tAction, tPending] = useActionState(toggleConsumableProduct, {
    message: "",
  });
  const [dState, dAction, dPending] = useActionState(deleteConsumableProduct, {
    message: "",
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <form action={tAction}>
          <input type="hidden" name="id" value={row.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            loading={tPending}
            icon={
              row.isActive ? (
                <PowerOff className="size-4" />
              ) : (
                <Power className="size-4" />
              )
            }
          >
            {row.isActive
              ? t("consumables.nutNgungDung")
              : t("consumables.nutDungLai")}
          </Button>
        </form>
        <form
          action={dAction}
          onSubmit={(e) => {
            if (
              !confirm(
                t("consumables.xacNhanXoaMatHang", { ten: row.name })
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <Button
            type="submit"
            size="sm"
            variant="danger"
            loading={dPending}
            icon={<Trash2 className="size-4" />}
          >
            {t("chung.xoa")}
          </Button>
        </form>
      </div>
      {[tState.message, dState.message]
        .filter((m) => m)
        .map((m, i) => (
          <span
            key={i}
            className="max-w-72 text-right text-xs text-[var(--text-danger)]"
          >
            {m}
          </span>
        ))}
    </div>
  );
}
