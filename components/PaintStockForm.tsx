"use client";

import { useActionState, useState } from "react";
import { ClipboardList, Droplets, Save } from "lucide-react";
import { paintStockMove, savePaintStockMin } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
} from "@/components/ui";

export type StockProductOption = { id: number; label: string; uom: string };

export function PaintStockMoveForm({
  vesselId,
  products,
}: {
  vesselId: number;
  products: StockProductOption[];
}) {
  const { t, tTuDo } = useNgonNgu();
  const [state, action, pending] = useActionState(paintStockMove, {
    message: "",
  });
  const [type, setType] = useState("IN");
  // "moi" = khai một loại sơn chưa có trong danh mục ngay tại đây. Chưa có loại
  // nào thì mở sẵn ở chế độ này, vì lúc đó chọn từ danh mục là vô nghĩa.
  const [nguon, setNguon] = useState<"cu" | "moi">(
    products.length === 0 ? "moi" : "cu"
  );
  const laMoi = nguon === "moi";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={!laMoi ? "primary" : "secondary"}
          onClick={() => setNguon("cu")}
          disabled={products.length === 0}
          icon={<ClipboardList className="size-4" />}
        >
          {t("paint.chonTuDanhMuc")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={laMoi ? "primary" : "secondary"}
          onClick={() => {
            setNguon("moi");
            // Bỏ mục "Xuất" khỏi ô chọn mà không kéo state về IN thì ô hiện
            // trống trong khi vẫn gửi OUT lên server.
            setType("IN");
          }}
          icon={<Droplets className="size-4" />}
        >
          {t("paint.loaiSonMoi")}
        </Button>
        {products.length === 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            {t("paint.danhMucRong")}
          </span>
        )}
      </div>

      {laMoi && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 md:grid-cols-5">
          <Field
            label={`${t("paint.tenSonMoi")} *`}
            className="md:col-span-2"
          >
            <Input
              name="newName"
              required={laMoi}
              placeholder={t("paint.phVdMarathon")}
            />
          </Field>
          <Field label={t("paint.hangSanXuat")}>
            <Input name="newMaker" placeholder="Jotun, Chugoku..." />
          </Field>
          <Field label={t("paint.heSon")}>
            <Select name="newPaintType">
              {Object.keys(PAINT_TYPE_LABEL).map((v) => (
                <option key={v} value={v}>
                  {tTuDo(`paint.loaiSon_${v}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("paint.cotMau")}>
            <Input name="newColorName" placeholder={t("paint.phMau")} />
          </Field>
          <Field label={t("chung.donVi")}>
            <Input name="newUom" defaultValue="L" />
          </Field>
          <Field label={t("paint.dungTichLonThung")}>
            <Input
              name="newPackSize"
              type="number"
              step="0.01"
              min="0"
              className="tabular"
            />
          </Field>
          <p className="text-xs text-[var(--text-secondary)] md:col-span-4 md:self-end">
            {t("paint.loaiMoiGhiChu")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {!laMoi && (
          <Field label={`${t("paint.loaiSon")} *`} className="md:col-span-2">
            <Select name="productId" required={!laMoi}>
              <option value="">{t("paint.chonSon")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={`${t("chung.thaoTac")} *`}>
          <Select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="IN">{t("paint.optNhanSon")}</option>
            {/* Loại mới thì chưa có tồn để xuất — bỏ hẳn lựa chọn thay vì để
                người dùng chọn rồi mới bị server báo lỗi. */}
            {!laMoi && <option value="OUT">{t("paint.optXuatHaoHut")}</option>}
          </Select>
        </Field>
        <Field label={`${t("chung.soLuong")} *`}>
          <Input
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="tabular"
          />
        </Field>
        <Field label={t("paint.thoiDiemGoiY")}>
          <Input name="occurredAt" type="datetime-local" />
        </Field>
        <Field label={t("chung.ghiChu")} className="md:col-span-5">
          <Input name="note" placeholder={t("paint.phGhiChuGiaoDich")} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          loading={pending}
          icon={<Save className="size-4" />}
        >
          {pending ? t("paint.dangGhi") : t("paint.nutGhiGiaoDich")}
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

export function PaintStockMinForm({
  vesselId,
  productId,
  minQty,
}: {
  vesselId: number;
  productId: number;
  minQty: number;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(savePaintStockMin, {
    message: "",
  });
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="productId" value={productId} />
      <Input
        name="minQty"
        type="number"
        step="0.01"
        min="0"
        defaultValue={minQty || ""}
        className="tabular w-20 px-2 py-1 text-right text-sm"
      />
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        icon={<Save className="size-4" />}
        title={state.message || t("paint.luuDinhMucToiThieu")}
        aria-label={t("paint.luuDinhMucToiThieu")}
      />
    </form>
  );
}
