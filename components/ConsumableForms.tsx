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
  kiemTraLuuHuynh,
} from "@/lib/consumables";
import ConsumablePdfReader, {
  type KetQuaDoc,
} from "@/components/ConsumablePdfReader";
import { useNgonNgu } from "@/lib/i18n/client";

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
  const { t, tTuDo } = useNgonNgu();
  const [state, action, pending] = useActionState(createConsumableReceipt, {
    message: "",
  });
  const [productId, setProductId] = useState("");
  const [sulphur, setSulphur] = useState("");
  // Kết quả đọc từ PDF: dùng làm giá trị điền sẵn (defaultValue) và để tô sáng
  // đúng những ô máy đã điền — người nhập biết chỗ nào cần soi lại.
  const [doc, setDoc] = useState<KetQuaDoc | null>(null);
  const [lanDoc, setLanDoc] = useState(0);
  const dx = doc?.deXuat;
  const daDoc = new Set(dx?.daDoc ?? []);
  // Ô nào máy điền thì viền vàng — nhìn là biết chỗ phải đối chiếu bản gốc.
  const oDoc = (ten: string) =>
    daDoc.has(ten)
      ? "w-full rounded border-2 border-amber-400 bg-amber-50 p-2"
      : "w-full rounded border p-2";

  const chon = products.find((p) => String(p.id) === productId);
  const laDau = chon?.category === "FUEL";
  const laNhon = chon?.category === "LUBE";
  const laHoaChat = chon?.category === "CHEMICAL";
  const canhBao = laDau ? kiemTraLuuHuynh(sulphur ? Number(sulphur) : null) : null;

  if (products.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {t("consumables.chuaCoMatHangTruoc")}{" "}
        <span className="font-medium">{t("consumables.danhMucDam")}</span>{" "}
        {t("consumables.chuaCoMatHangSau")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bộ đọc PDF nằm NGOÀI form: form dùng key={lanDoc} để dựng lại với giá
          trị điền sẵn mới, nếu bộ đọc nằm trong thì mỗi lần đọc xong nó bị dựng
          lại và mất luôn thông báo vừa hiện. HTML cũng không cho lồng form. */}
      <ConsumablePdfReader
        vesselId={vesselId}
        onDoc={(kq) => {
          setDoc(kq);
          setLanDoc((n) => n + 1);
          setSulphur(
            kq.deXuat?.sulphur != null ? String(kq.deXuat.sulphur) : ""
          );
        }}
      />

      {dx && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          {t("consumables.goiYVienVangTruoc")}{" "}
          <b>{t("consumables.goiYVienVangDam")}</b>{" "}
          {t("consumables.goiYVienVangGiua")}{" "}
          <b>{t("consumables.goiYSoLuongDam")}</b> {t("chung.va")}{" "}
          <b>{t("consumables.goiYLuuHuynhDam")}</b>.
        </p>
      )}

      <form action={action} className="space-y-3" key={lanDoc}>
      <input type="hidden" name="vesselId" value={vesselId} />
      {doc?.tepTam && (
        <>
          <input type="hidden" name="tepTam" value={doc.tepTam} />
          <input type="hidden" name="tepTamTen" value={doc.tenTep ?? ""} />
          <input type="hidden" name="tepTamCo" value={String(doc.coTep ?? 0)} />
        </>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="block md:col-span-2">
          <Nhan>{t("consumables.matHang")} *</Nhan>
          <select
            name="productId"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="">{t("consumables.chonMatHang")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Nhan>
            {laDau
              ? t("consumables.soBdn")
              : t("consumables.soPhieuGiao")}{" "}
            *
          </Nhan>
          <input
            name="docNo"
            required
            defaultValue={dx?.docNo ?? ""}
            className={oDoc("docNo")}
          />
        </label>
        <label className="block">
          <Nhan>{t("consumables.ngayNhan")} *</Nhan>
          <input
            type="date"
            name="receivedAt"
            required
            defaultValue={dx?.receivedAt ?? ""}
            className={oDoc("receivedAt")}
          />
        </label>
        <label className="block">
          <Nhan>
            {t("chung.soLuong")} * {chon ? `(${chon.uom})` : ""}
          </Nhan>
          <input
            name="quantity"
            type="number"
            step="0.001"
            min="0.001"
            required
            defaultValue={dx?.quantity ?? ""}
            className={oDoc("quantity")}
          />
        </label>
        <label className="block">
          <Nhan>{t("consumables.cangNhan")}</Nhan>
          <input
            name="port"
            defaultValue={dx?.port ?? ""}
            className={oDoc("port")}
          />
        </label>
        <label className="block">
          <Nhan>{t("consumables.nhaCungCap")}</Nhan>
          <input
            name="supplier"
            defaultValue={dx?.supplier ?? ""}
            className={oDoc("supplier")}
          />
        </label>
        {laDau && (
          <label className="block">
            <Nhan>{t("consumables.saLanXeCap")}</Nhan>
            <input
              name="barge"
              defaultValue={dx?.barge ?? ""}
              className={oDoc("barge")}
            />
          </label>
        )}
      </div>

      {(laDau || laNhon) && (
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            {t("consumables.dacTinhLoHang")}{" "}
            {laDau ? t("consumables.theoBdn") : ""}
          </legend>
          <div className="grid gap-3 md:grid-cols-4">
            {laDau && (
              <label className="block">
                <Nhan>{t("consumables.luuHuynh")}</Nhan>
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
              <Nhan>{t("consumables.khoiLuongRieng")}</Nhan>
              <input
                name="density"
                type="number"
                step="0.1"
                defaultValue={dx?.density ?? ""}
                className={oDoc("density")}
              />
            </label>
            <label className="block">
              <Nhan>{t("consumables.doNhot")}</Nhan>
              <input
                name="viscosity"
                type="number"
                step="0.1"
                defaultValue={dx?.viscosity ?? ""}
                className={oDoc("viscosity")}
              />
            </label>
            {laDau && (
              <>
                <label className="block">
                  <Nhan>{t("consumables.nuoc")}</Nhan>
                  <input
                    name="waterContent"
                    type="number"
                    step="0.01"
                    defaultValue={dx?.waterContent ?? ""}
                    className={oDoc("waterContent")}
                  />
                </label>
                <label className="block">
                  <Nhan>{t("consumables.diemChopChay")}</Nhan>
                  <input
                    name="flashPoint"
                    type="number"
                    step="0.1"
                    defaultValue={dx?.flashPoint ?? ""}
                    className={oDoc("flashPoint")}
                  />
                </label>
              </>
            )}
            {laNhon && (
              <label className="block">
                <Nhan>{t("consumables.tbn")}</Nhan>
                <input
                  name="bnValue"
                  type="number"
                  step="0.1"
                  defaultValue={dx?.bnValue ?? ""}
                  className={oDoc("bnValue")}
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
              {/* Câu chữ lấy theo MỨC, không lấy chuỗi tiếng Việt dựng sẵn
                  trong lib/consumables.ts — file đó dùng chung cả hai phía. */}
              {tTuDo(`consumables.luuHuynh_${canhBao.muc}`, {
                s: Number(sulphur),
              })}
            </p>
          )}

          {laDau && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <Nhan>{t("consumables.soNiemMau")}</Nhan>
                <input
                  name="sampleSealNo"
                  placeholder={t("consumables.soNiemPlaceholder")}
                  defaultValue={dx?.sampleSealNo ?? ""}
                  className={oDoc("sampleSealNo")}
                />
              </label>
              <p className="self-end text-xs text-slate-600">
                {t("consumables.mauGiuTruoc")}{" "}
                <b>{t("consumables.mauGiu12Thang")}</b>{" "}
                {t("consumables.mauGiuSau")}
              </p>
            </div>
          )}
        </fieldset>
      )}

      {laHoaChat && (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <Nhan>{t("consumables.hanDungCuaLo")}</Nhan>
            <input
              type="date"
              name="expiryDate"
              defaultValue={dx?.expiryDate ?? ""}
              className={oDoc("expiryDate")}
            />
          </label>
          <p className="text-xs text-slate-600 md:col-span-2 md:self-end">
            {chon?.shelfLifeMonths
              ? t("consumables.tuTinhHanDung", { n: chon.shelfLifeMonths })
              : t("consumables.chuaKhaiHanDung")}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <Nhan>{t("consumables.donGia")}</Nhan>
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            defaultValue={dx?.unitPrice ?? ""}
            className={oDoc("unitPrice")}
          />
        </label>
        <label className="block">
          <Nhan>{t("consumables.tienTe")}</Nhan>
          <input
            name="currency"
            placeholder="USD"
            defaultValue={dx?.currency ?? ""}
            className={oDoc("currency")}
          />
        </label>
        <label className="block md:col-span-2">
          <Nhan>{t("chung.ghiChu")}</Nhan>
          <input name="note" className="w-full rounded border p-2" />
        </label>
      </div>

      <label className="block">
        <Nhan>{t("consumables.dinhKemBanGoc")}</Nhan>
        <input
          type="file"
          name="attach"
          accept=".pdf"
          className="w-full rounded border p-2"
        />
        {doc?.tepTam && (
          <span className="mt-1 block text-xs text-emerald-700">
            {t("consumables.daCoBanGoc", { ten: doc.tenTep ?? "" })}
          </span>
        )}
      </label>

      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending
          ? t("consumables.dangGhi")
          : t("consumables.nutGhiPhieuNhan")}
      </button>
      <ThongBao state={state} />
      </form>
    </div>
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
  const { t, tTuDo } = useNgonNgu();
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
          <Nhan>{t("consumables.matHang")} *</Nhan>
          <select name="productId" required className="w-full rounded border p-2">
            <option value="">{t("consumables.chonMatHang")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Nhan>{t("consumables.loaiGhi")} *</Nhan>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="CONSUME">
              {t("consumables.giaoDich_CONSUME")}
            </option>
            <option value="OUT">{t("consumables.giaoDich_OUT")}</option>
            <option value="IN">{t("consumables.giaoDich_IN")}</option>
          </select>
        </label>
        {/* Nơi tiêu thụ chỉ hiện với CONSUME — ghi vào nhận/xuất là dữ liệu vô
            nghĩa làm báo cáo cộng nhầm. */}
        {type === "CONSUME" && (
          <label className="block">
            <Nhan>{t("consumables.noiTieuThu")} *</Nhan>
            <select name="consumer" className="w-full rounded border p-2">
              {CONSUMERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {tTuDo(`consumables.noiTieuThu_${c.value}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <Nhan>{t("chung.soLuong")} *</Nhan>
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
          <Nhan>{t("consumables.thoiDiemTrong")}</Nhan>
          <input
            type="datetime-local"
            name="occurredAt"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-3">
          <Nhan>{t("chung.ghiChu")}</Nhan>
          <input
            name="note"
            placeholder={t("consumables.ghiChuPlaceholder")}
            className="w-full rounded border p-2"
          />
        </label>
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending
          ? t("consumables.dangGhi")
          : t("consumables.nutGhiGiaoDich")}
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
  const { t } = useNgonNgu();
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
        title={t("consumables.luuDinhMuc")}
        className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-50"
      >
        {pending ? "..." : t("chung.luu")}
      </button>
      {state.message && !state.success && (
        <span className="text-xs text-red-600">{state.message}</span>
      )}
    </form>
  );
}

export { GIOI_HAN_LUU_HUYNH };
