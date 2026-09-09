"use client";

import { useActionState, useState } from "react";
import { ArrowDownToLine, Save } from "lucide-react";
import {
  createConsumableMove,
  createConsumableReceipt,
  saveConsumableMin,
} from "@/app/consumable-actions";
import {
  CATEGORY_VALUES,
  CONSUMERS,
  GIOI_HAN_LUU_HUYNH,
  kiemTraLuuHuynh,
  type CanhBaoLuuHuynh,
} from "@/lib/consumables";
import ConsumablePdfReader, {
  LOP_O_TEP,
  type KetQuaDoc,
} from "@/components/ConsumablePdfReader";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  type Tone,
} from "@/components/ui";

export type ProductOption = {
  id: number;
  label: string;
  uom: string;
  category: string;
  shelfLifeMonths: number | null;
};

/** Ba mức của kiemTraLuuHuynh() → tone của hộp cảnh báo. */
const TONE_LUU_HUYNH: Record<CanhBaoLuuHuynh["muc"], Tone> = {
  VUOT_TOAN_CAU: "danger",
  VUOT_ECA: "warning",
  DAT: "success",
};

/**
 * Ô do máy đọc từ bản scan điền sẵn: vòng màu cảnh báo quanh ô — nhìn là biết
 * chỗ phải đối chiếu với bản gốc. Vẽ bằng ring (box-shadow) chứ không chỉ đổi
 * màu viền, để chắc chắn nổi lên trên lớp `field` của ô nhập ở cả hai chế độ.
 */
const O_MAY_DIEN =
  "border-[var(--tone-warning-text)] ring-2 ring-[var(--tone-warning-text)]";

/** Khung nhóm ô nhập (đặc tính lô hàng). */
const FIELDSET = "rounded-lg border border-[var(--border-subtle)] p-3";
const LEGEND = "px-1 text-xs font-medium text-[var(--text-secondary)]";

/**
 * Ô nhập compact cho form định mức nằm trong ô bảng. Không dùng <Input> vì
 * cn() không gộp lớp trùng: px-3/py-2 của FIELD và px-2/py-1 truyền thêm sẽ
 * cùng tồn tại, ô rộng hay hẹp tùy thứ tự CSS sinh ra.
 */
const O_NHO =
  "field w-24 rounded-lg border px-2 py-1 text-right text-sm tabular " +
  "focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-60";

function ThongBao({ state }: { state: { message: string; success?: boolean } }) {
  if (!state.message) return null;
  return (
    <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>
  );
}

/**
 * Danh sách <option> mặt hàng, gom theo nhóm bằng <optgroup> khi ô chọn chứa
 * nhiều hơn một nhóm — thay cho emoji nhóm từng đứng đầu mỗi nhãn. Một nhóm
 * thì không cần tiêu đề nhóm.
 */
function OptionMatHang({ products }: { products: ProductOption[] }) {
  const { tTuDo } = useNgonNgu();
  const nhom = CATEGORY_VALUES.filter((c) =>
    products.some((p) => p.category === c)
  );
  if (nhom.length <= 1) {
    return (
      <>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </>
    );
  }
  return (
    <>
      {nhom.map((c) => (
        <optgroup key={c} label={tTuDo(`consumables.nhom_${c}`)}>
          {products
            .filter((p) => p.category === c)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </optgroup>
      ))}
    </>
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
  // Ô nào máy điền thì có vòng cảnh báo — nhìn là biết chỗ phải đối chiếu bản gốc.
  const oDoc = (ten: string) => (daDoc.has(ten) ? O_MAY_DIEN : undefined);

  const chon = products.find((p) => String(p.id) === productId);
  const laDau = chon?.category === "FUEL";
  const laNhon = chon?.category === "LUBE";
  const laHoaChat = chon?.category === "CHEMICAL";
  const canhBao = laDau ? kiemTraLuuHuynh(sulphur ? Number(sulphur) : null) : null;

  if (products.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        {t("consumables.chuaCoMatHangTruoc")}{" "}
        <span className="font-medium text-[var(--text-primary)]">
          {t("consumables.danhMucDam")}
        </span>{" "}
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
        <Notice tone="warning">
          {t("consumables.goiYVienVangTruoc")}{" "}
          <b>{t("consumables.goiYVienVangDam")}</b>{" "}
          {t("consumables.goiYVienVangGiua")}{" "}
          <b>{t("consumables.goiYSoLuongDam")}</b> {t("chung.va")}{" "}
          <b>{t("consumables.goiYLuuHuynhDam")}</b>.
        </Notice>
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
        <Field label={`${t("consumables.matHang")} *`} className="md:col-span-2">
          <Select
            name="productId"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">{t("consumables.chonMatHang")}</option>
            <OptionMatHang products={products} />
          </Select>
        </Field>
        <Field
          label={`${
            laDau ? t("consumables.soBdn") : t("consumables.soPhieuGiao")
          } *`}
        >
          <Input
            name="docNo"
            required
            defaultValue={dx?.docNo ?? ""}
            className={oDoc("docNo")}
          />
        </Field>
        <Field label={`${t("consumables.ngayNhan")} *`}>
          <Input
            type="date"
            name="receivedAt"
            required
            defaultValue={dx?.receivedAt ?? ""}
            className={oDoc("receivedAt")}
          />
        </Field>
        <Field
          label={`${t("chung.soLuong")} * ${chon ? `(${chon.uom})` : ""}`}
        >
          <Input
            name="quantity"
            type="number"
            step="0.001"
            min="0.001"
            required
            defaultValue={dx?.quantity ?? ""}
            className={oDoc("quantity")}
          />
        </Field>
        <Field label={t("consumables.cangNhan")}>
          <Input
            name="port"
            defaultValue={dx?.port ?? ""}
            className={oDoc("port")}
          />
        </Field>
        <Field label={t("consumables.nhaCungCap")}>
          <Input
            name="supplier"
            defaultValue={dx?.supplier ?? ""}
            className={oDoc("supplier")}
          />
        </Field>
        {laDau && (
          <Field label={t("consumables.saLanXeCap")}>
            <Input
              name="barge"
              defaultValue={dx?.barge ?? ""}
              className={oDoc("barge")}
            />
          </Field>
        )}
      </div>

      {(laDau || laNhon) && (
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>
            {t("consumables.dacTinhLoHang")}{" "}
            {laDau ? t("consumables.theoBdn") : ""}
          </legend>
          <div className="grid gap-3 md:grid-cols-4">
            {laDau && (
              <Field label={t("consumables.luuHuynh")}>
                <Input
                  name="sulphur"
                  type="number"
                  step="0.001"
                  min="0"
                  value={sulphur}
                  onChange={(e) => setSulphur(e.target.value)}
                />
              </Field>
            )}
            <Field label={t("consumables.khoiLuongRieng")}>
              <Input
                name="density"
                type="number"
                step="0.1"
                defaultValue={dx?.density ?? ""}
                className={oDoc("density")}
              />
            </Field>
            <Field label={t("consumables.doNhot")}>
              <Input
                name="viscosity"
                type="number"
                step="0.1"
                defaultValue={dx?.viscosity ?? ""}
                className={oDoc("viscosity")}
              />
            </Field>
            {laDau && (
              <>
                <Field label={t("consumables.nuoc")}>
                  <Input
                    name="waterContent"
                    type="number"
                    step="0.01"
                    defaultValue={dx?.waterContent ?? ""}
                    className={oDoc("waterContent")}
                  />
                </Field>
                <Field label={t("consumables.diemChopChay")}>
                  <Input
                    name="flashPoint"
                    type="number"
                    step="0.1"
                    defaultValue={dx?.flashPoint ?? ""}
                    className={oDoc("flashPoint")}
                  />
                </Field>
              </>
            )}
            {laNhon && (
              <Field label={t("consumables.tbn")}>
                <Input
                  name="bnValue"
                  type="number"
                  step="0.1"
                  defaultValue={dx?.bnValue ?? ""}
                  className={oDoc("bnValue")}
                />
              </Field>
            )}
          </div>

          {canhBao && (
            <Notice tone={TONE_LUU_HUYNH[canhBao.muc]} className="mt-3">
              {/* Câu chữ lấy theo MỨC, không lấy chuỗi tiếng Việt dựng sẵn
                  trong lib/consumables.ts — file đó dùng chung cả hai phía. */}
              {tTuDo(`consumables.luuHuynh_${canhBao.muc}`, {
                s: Number(sulphur),
              })}
            </Notice>
          )}

          {laDau && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label={t("consumables.soNiemMau")}>
                <Input
                  name="sampleSealNo"
                  placeholder={t("consumables.soNiemPlaceholder")}
                  defaultValue={dx?.sampleSealNo ?? ""}
                  className={oDoc("sampleSealNo")}
                />
              </Field>
              <p className="self-end text-xs text-[var(--text-secondary)]">
                {t("consumables.mauGiuTruoc")}{" "}
                <b className="text-[var(--text-primary)]">
                  {t("consumables.mauGiu12Thang")}
                </b>{" "}
                {t("consumables.mauGiuSau")}
              </p>
            </div>
          )}
        </fieldset>
      )}

      {laHoaChat && (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("consumables.hanDungCuaLo")}>
            <Input
              type="date"
              name="expiryDate"
              defaultValue={dx?.expiryDate ?? ""}
              className={oDoc("expiryDate")}
            />
          </Field>
          <p className="text-xs text-[var(--text-secondary)] md:col-span-2 md:self-end">
            {chon?.shelfLifeMonths
              ? t("consumables.tuTinhHanDung", { n: chon.shelfLifeMonths })
              : t("consumables.chuaKhaiHanDung")}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Field label={t("consumables.donGia")}>
          <Input
            name="unitPrice"
            type="number"
            step="0.01"
            defaultValue={dx?.unitPrice ?? ""}
            className={oDoc("unitPrice")}
          />
        </Field>
        <Field label={t("consumables.tienTe")}>
          <Input
            name="currency"
            placeholder="USD"
            defaultValue={dx?.currency ?? ""}
            className={oDoc("currency")}
          />
        </Field>
        <Field label={t("chung.ghiChu")} className="md:col-span-2">
          <Input name="note" />
        </Field>
      </div>

      <Field
        label={t("consumables.dinhKemBanGoc")}
        hint={
          doc?.tepTam ? (
            <span className="text-[var(--text-success)]">
              {t("consumables.daCoBanGoc", { ten: doc.tenTep ?? "" })}
            </span>
          ) : undefined
        }
      >
        <Input type="file" name="attach" accept=".pdf" className={LOP_O_TEP} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={<ArrowDownToLine className="size-4" />}
        >
          {pending
            ? t("consumables.dangGhi")
            : t("consumables.nutGhiPhieuNhan")}
        </Button>
      </div>
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
        <Field label={`${t("consumables.matHang")} *`} className="md:col-span-2">
          <Select name="productId" required>
            <option value="">{t("consumables.chonMatHang")}</option>
            <OptionMatHang products={products} />
          </Select>
        </Field>
        <Field label={`${t("consumables.loaiGhi")} *`}>
          <Select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="CONSUME">
              {t("consumables.giaoDich_CONSUME")}
            </option>
            <option value="OUT">{t("consumables.giaoDich_OUT")}</option>
            <option value="IN">{t("consumables.giaoDich_IN")}</option>
          </Select>
        </Field>
        {/* Nơi tiêu thụ chỉ hiện với CONSUME — ghi vào nhận/xuất là dữ liệu vô
            nghĩa làm báo cáo cộng nhầm. */}
        {type === "CONSUME" && (
          <Field label={`${t("consumables.noiTieuThu")} *`}>
            <Select name="consumer">
              {CONSUMERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {tTuDo(`consumables.noiTieuThu_${c.value}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={`${t("chung.soLuong")} *`}>
          <Input
            name="quantity"
            type="number"
            step="0.001"
            min="0.001"
            required
            className="tabular"
          />
        </Field>
        <Field label={t("consumables.thoiDiemTrong")}>
          <Input type="datetime-local" name="occurredAt" />
        </Field>
        <Field label={t("chung.ghiChu")} className="md:col-span-3">
          <Input
            name="note"
            placeholder={t("consumables.ghiChuPlaceholder")}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={<Save className="size-4" />}
        >
          {pending
            ? t("consumables.dangGhi")
            : t("consumables.nutGhiGiaoDich")}
        </Button>
      </div>
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
    <form action={action} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="productId" value={productId} />
      <input
        name="minQty"
        type="number"
        step="0.01"
        min="0"
        defaultValue={minQty}
        className={O_NHO}
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        loading={pending}
        title={t("consumables.luuDinhMuc")}
        icon={<Save className="size-4" />}
      >
        {t("chung.luu")}
      </Button>
      {state.message && !state.success && (
        <span className="text-xs text-[var(--text-danger)]">{state.message}</span>
      )}
    </form>
  );
}

export { GIOI_HAN_LUU_HUYNH };
