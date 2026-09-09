"use client";

import { useActionState, useState } from "react";
import {
  ClipboardPaste,
  FileSpreadsheet,
  PackageMinus,
  PackagePlus,
} from "lucide-react";
import { nhapXuatSonHangLoat } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
} from "@/components/ui";

/**
 * Nhập / xuất sơn hàng loạt từ file Excel hoặc bảng dán từ PDF.
 *
 * Cột số lượng ở đây là SỐ CỘNG THÊM / TRỪ ĐI theo phiếu, không phải tồn chốt
 * lại — khác hẳn trang "Nhập danh mục sơn từ file". Nói rõ ngay trên form vì
 * lẫn hai cái này là sai tồn kho.
 */
export default function PaintStockBulkForm({
  vesselId,
}: {
  vesselId: number;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(nhapXuatSonHangLoat, {
    message: "",
  });
  const [type, setType] = useState("IN");
  const [nguon, setNguon] = useState<"file" | "dan">("file");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={`${t("paint.loaiPhieu")} *`}>
          <Select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="IN">{t("paint.optNhapSon")}</option>
            <option value="OUT">{t("paint.optXuatSon")}</option>
          </Select>
        </Field>
        <Field label={t("paint.thoiDiem")}>
          <Input type="datetime-local" name="occurredAt" />
        </Field>
        <Field label={t("paint.ghiChuPhieu")}>
          <Input name="note" placeholder={t("paint.phGhiChuPhieu")} />
        </Field>
      </div>

      <Notice tone="warning">
        {t("paint.luuY1")} <b>{t("paint.luuYDam1")}</b> {t("paint.luuY2")}{" "}
        <i>{t("paint.luuYDam2")}</i> {t("paint.luuY3")}{" "}
        <b>{t("paint.nhapDanhMucTieuDe")}</b>.
        {type === "OUT" && (
          <>
            {" "}
            {t("paint.luuYXuat1")} <b>{t("paint.luuYXuatDam")}</b>
            {t("paint.luuYXuat2")}
          </>
        )}
      </Notice>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={nguon === "file" ? "primary" : "secondary"}
          onClick={() => setNguon("file")}
          icon={<FileSpreadsheet className="size-4" />}
        >
          {t("paint.tuFileExcel")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={nguon === "dan" ? "primary" : "secondary"}
          onClick={() => setNguon("dan")}
          icon={<ClipboardPaste className="size-4" />}
        >
          {t("paint.danBangPdf")}
        </Button>
      </div>

      {nguon === "file" ? (
        <Field
          label="File Excel (.xls / .xlsx)"
          hint={
            <>
              {t("paint.bangCanCot1")}{" "}
              <b className="text-[var(--text-secondary)]">
                {t("paint.bangCanCotTen")}
              </b>{" "}
              {t("paint.bangCanCot2")}{" "}
              <b className="text-[var(--text-secondary)]">
                {t("paint.bangCanCotSL")}
              </b>{" "}
              {t("paint.bangCanCot3")}
            </>
          }
        >
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
          />
        </Field>
      ) : (
        <Field label={t("paint.danBangTuPdf")}>
          <Textarea
            name="pasted"
            rows={6}
            placeholder={t("paint.phDanBangPdf")}
            className="font-mono text-xs"
          />
        </Field>
      )}

      <Button
        variant="primary"
        loading={pending}
        icon={
          type === "IN" ? (
            <PackagePlus className="size-4" />
          ) : (
            <PackageMinus className="size-4" />
          )
        }
      >
        {pending
          ? t("chung.dangXuLy")
          : type === "IN"
            ? t("paint.nutNhapHangLoat")
            : t("paint.nutXuatHangLoat")}
      </Button>

      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
