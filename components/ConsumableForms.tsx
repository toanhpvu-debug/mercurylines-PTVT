"use client";

import { useActionState, useState } from "react";
import {
  createConsumableMove,
  createConsumableReceipt,
  saveConsumableMin,
} from "@/app/consumable-actions";
import {
  CONSUMERS,
  GIOI_HAN_LUU_HUYNH,
  TRANSACTION_LABEL,
  kiemTraLuuHuynh,
} from "@/lib/consumables";

export type ProductOption = {
  id: number;
  label: string;
  uom: string;
  category: string;
  shelfLifeMonths: number | null;
};

function Nhan({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-sm text-slate-600">{children}</span>;
}

function ThongBao({ state }: { state: { message: string; success?: boolean } }) {
  if (!state.message) return null;
  return (
    <p
      className={`text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}
    >
      {state.message}
    </p>
  );
}

/**
 * Ghi một lô nhận: BDN với dầu đốt, phiếu giao hàng với dầu nhờn / hóa chất.
 *
 * Form đổi theo nhóm mặt hàng đang chọn — hỏi lưu huỳnh của một can hóa chất
 * tẩy rửa, hay hỏi hạn dùng của một lô HFO, đều là ô trống vô nghĩa mà người
 * dùng vẫn phải đọc qua.
 */
export function ConsumableReceiptForm({
  vesselId,
  products,
}: {
  vesselId: number;
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(createConsumableReceipt, {
    message: "",
  });
  const [productId, setProductId] = useState("");
  const [sulphur, setSulphur] = useState("");

  const chon = products.find((p) => String(p.id) === productId);
  const laDau = chon?.category === "FUEL";
  const laNhon = chon?.category === "LUBE";
  const laHoaChat = chon?.category === "CHEMICAL";
  const canhBao = laDau ? kiemTraLuuHuynh(sulphur ? Number(sulphur) : null) : null;

  if (products.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Chưa có mặt hàng nào thuộc nhóm bạn phụ trách. Thêm ở{" "}
        <span className="font-medium">Danh mục dầu &amp; hóa chất</span> trước.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="grid gap-3 md:grid-cols-4">
        <label className="block md:col-span-2">
          <Nhan>Mặt hàng *</Nhan>
          <select
            name="productId"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="">— Chọn mặt hàng —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Nhan>{laDau ? "Số BDN *" : "Số phiếu giao *"}</Nhan>
          <input name="docNo" required className="w-full rounded border p-2" />
        </label>
        <label className="block">
          <Nhan>Ngày nhận *</Nhan>
          <input
            type="date"
            name="receivedAt"
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Số lượng * {chon ? `(${chon.uom})` : ""}</Nhan>
          <input
            name="quantity"
            type="number"
            step="0.001"
            min="0.001"
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Cảng nhận</Nhan>
          <input name="port" className="w-full rounded border p-2" />
        </label>
        <label className="block">
          <Nhan>Nhà cung cấp</Nhan>
          <input name="supplier" className="w-full rounded border p-2" />
        </label>
        {laDau && (
          <label className="block">
            <Nhan>Sà lan / xe cấp</Nhan>
            <input name="barge" className="w-full rounded border p-2" />
          </label>
        )}
      </div>

      {(laDau || laNhon) && (
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Đặc tính lô hàng {laDau ? "(theo BDN / chứng thư phân tích)" : ""}
          </legend>
          <div className="grid gap-3 md:grid-cols-4">
            {laDau && (
              <label className="block">
                <Nhan>Lưu huỳnh (% m/m)</Nhan>
                <input
                  name="sulphur"
                  type="number"
                  step="0.001"
                  min="0"
                  value={sulphur}
                  onChange={(e) => setSulphur(e.target.value)}
                  className="w-full rounded border p-2"
                />
              </label>
            )}
            <label className="block">
              <Nhan>Khối lượng riêng @15°C (kg/m³)</Nhan>
              <input
                name="density"
                type="number"
                step="0.1"
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block">
              <Nhan>Độ nhớt (cSt)</Nhan>
              <input
                name="viscosity"
                type="number"
                step="0.1"
                className="w-full rounded border p-2"
              />
            </label>
            {laDau && (
              <>
                <label className="block">
                  <Nhan>Nước (% v/v)</Nhan>
                  <input
                    name="waterContent"
                    type="number"
                    step="0.01"
                    className="w-full rounded border p-2"
                  />
                </label>
                <label className="block">
                  <Nhan>Điểm chớp cháy (°C)</Nhan>
                  <input
                    name="flashPoint"
                    type="number"
                    step="0.1"
                    className="w-full rounded border p-2"
                  />
                </label>
              </>
            )}
            {laNhon && (
              <label className="block">
                <Nhan>TBN (mgKOH/g)</Nhan>
                <input
                  name="bnValue"
                  type="number"
                  step="0.1"
                  className="w-full rounded border p-2"
                />
              </label>
            )}
          </div>

          {canhBao && (
            <p
              className={`mt-3 rounded p-2 text-sm ${
                canhBao.muc === "VUOT_TOAN_CAU"
                  ? "bg-red-50 text-red-800"
                  : canhBao.muc === "VUOT_ECA"
                    ? "bg-amber-50 text-amber-900"
                    : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {canhBao.loi}
            </p>
          )}

          {laDau && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <Nhan>Số niêm mẫu (sample seal no.)</Nhan>
                <input
                  name="sampleSealNo"
                  placeholder="Số niêm trên chai mẫu đại diện"
                  className="w-full rounded border p-2"
                />
              </label>
              <p className="self-end text-xs text-slate-600">
                Mẫu đại diện phải giữ trên tàu tới khi dùng hết lô và ít nhất{" "}
                <b>12 tháng</b> kể từ ngày giao (MARPOL Annex VI Reg 18.8.1).
                Hệ thống tự tính mốc này khi lưu.
              </p>
            </div>
          )}
        </fieldset>
      )}

      {laHoaChat && (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <Nhan>Hạn dùng của lô</Nhan>
            <input
              type="date"
              name="expiryDate"
              className="w-full rounded border p-2"
            />
          </label>
          <p className="text-xs text-slate-600 md:col-span-2 md:self-end">
            {chon?.shelfLifeMonths
              ? `Bỏ trống thì tự tính = ngày nhận + ${chon.shelfLifeMonths} tháng theo hạn dùng khai ở danh mục.`
              : "Mặt hàng này chưa khai hạn dùng ở danh mục — nhập tay nếu lô có hạn."}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <Nhan>Đơn giá</Nhan>
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Tiền tệ</Nhan>
          <input
            name="currency"
            placeholder="USD"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-2">
          <Nhan>Ghi chú</Nhan>
          <input name="note" className="w-full rounded border p-2" />
        </label>
      </div>

      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang ghi..." : "Ghi phiếu nhận"}
      </button>
      <ThongBao state={state} />
    </form>
  );
}

/** Ghi tiêu thụ / xuất / nhận lẻ, không kèm chứng từ lô. */
export function ConsumableMoveForm({
  vesselId,
  products,
}: {
  vesselId: number;
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(createConsumableMove, {
    message: "",
  });
  const [type, setType] = useState("CONSUME");

  if (products.length === 0) return null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid gap-3 md:grid-cols-5">
        <label className="block md:col-span-2">
          <Nhan>Mặt hàng *</Nhan>
          <select name="productId" required className="w-full rounded border p-2">
            <option value="">— Chọn mặt hàng —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Nhan>Loại ghi *</Nhan>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="CONSUME">{TRANSACTION_LABEL.CONSUME}</option>
            <option value="OUT">{TRANSACTION_LABEL.OUT}</option>
            <option value="IN">{TRANSACTION_LABEL.IN}</option>
          </select>
        </label>
        {/* Nơi tiêu thụ chỉ hiện với CONSUME — ghi vào nhận/xuất là dữ liệu vô
            nghĩa làm báo cáo cộng nhầm. */}
        {type === "CONSUME" && (
          <label className="block">
            <Nhan>Nơi tiêu thụ *</Nhan>
            <select name="consumer" className="w-full rounded border p-2">
              {CONSUMERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <Nhan>Số lượng *</Nhan>
          <input
            name="quantity"
            type="number"
            step="0.001"
            min="0.001"
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Thời điểm (trống = bây giờ)</Nhan>
          <input
            type="datetime-local"
            name="occurredAt"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-3">
          <Nhan>Ghi chú</Nhan>
          <input
            name="note"
            placeholder="Số hành trình, lý do xuất..."
            className="w-full rounded border p-2"
          />
        </label>
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang ghi..." : "Ghi giao dịch"}
      </button>
      <ThongBao state={state} />
    </form>
  );
}

export function ConsumableMinForm({
  vesselId,
  productId,
  minQty,
}: {
  vesselId: number;
  productId: number;
  minQty: number;
}) {
  const [state, action, pending] = useActionState(saveConsumableMin, {
    message: "",
  });
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="productId" value={productId} />
      <input
        name="minQty"
        type="number"
        step="0.01"
        min="0"
        defaultValue={minQty}
        className="w-20 rounded border p-1 text-right text-sm"
      />
      <button
        disabled={pending}
        title="Lưu định mức tối thiểu"
        className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-50"
      >
        {pending ? "..." : "Lưu"}
      </button>
      {state.message && !state.success && (
        <span className="text-xs text-red-600">{state.message}</span>
      )}
    </form>
  );
}

export { GIOI_HAN_LUU_HUYNH };
