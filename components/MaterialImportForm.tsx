"use client";

import { startTransition, useActionState, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { importMaterials } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Notice, Select } from "@/components/ui";

type VesselOption = { id: number; label: string };
type WarehouseOption = { id: number; vesselId: number; label: string };

export default function MaterialImportForm({
  vessels,
  warehouses,
}: {
  vessels: VesselOption[];
  warehouses: WarehouseOption[];
}) {
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(importMaterials, {
    message: "",
  });
  const [vesselId, setVesselId] = useState("");
  const [kind, setKind] = useState("STORE");
  const [warehouseId, setWarehouseId] = useState("");
  const vesselWarehouses = warehouses.filter(
    (w) => String(w.vesselId) === vesselId
  );

  return (
    // Gửi thủ công qua startTransition để React không reset form (mất file) khi lỗi.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={`${t("chung.tau")} *`}>
          <Select
            name="vesselId"
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              // File kiểm kê luôn có cột "Tồn trên tàu" nên mặc định là GHI TỒN
              // theo sheet; muốn chỉ nạp danh mục thì chọn lại trong ô bên cạnh.
              setWarehouseId(e.target.value ? "AUTO" : "");
            }}
            required
          >
            <option value="">— {t("chung.chonTau")} —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("materials.loaiDuPhong")}>
          <Select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="STORE">{tTuDo("labels.typeLong_STORE")}</option>
            <option value="SPARE">{tTuDo("labels.typeLong_SPARE")}</option>
          </Select>
        </Field>
        <Field label={t("materials.ghiTonVaoKho")}>
          {/* Danh sách kho phụ thuộc tàu. Trước đây ô này bị khóa im lặng và chỉ
              hiện "— Không ghi tồn —" nên trông như hỏng; nay nói rõ phải chọn tàu. */}
          <Select
            name="warehouseId"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={!vesselId}
          >
            {!vesselId ? (
              <option value="">{t("materials.chonTauTruoc")}</option>
            ) : (
              <>
                <option value="AUTO">{t("materials.tuDongTheoSheet")}</option>
                {vesselWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
                <option value="">{t("materials.khongGhiTon")}</option>
              </>
            )}
          </Select>
        </Field>
      </div>

      {vesselId && vesselWarehouses.length === 0 && (
        <Notice tone="warning">
          {t("materials.tauChuaCoKho")}{" "}
          <b>{t("materials.duongDanTaoKho")}</b>{" "}
          {t("materials.taoKhoTruoc")}
        </Notice>
      )}
      {warehouseId === "AUTO" && (
        <Notice tone="info">
          {t("materials.robTruoc")} <b>{t("materials.robTenCot")}</b>{" "}
          {t("materials.robSau")}
        </Notice>
      )}

      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
        <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FileSpreadsheet className="size-4 text-[var(--text-muted)]" />
          {t("materials.fileDanhMuc")}
        </p>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          {t("materials.nhanFormCongTy")}{" "}
          <b className="text-[var(--text-primary)]">MLS-11-06</b>{" "}
          {t("materials.moTaMLS1106")}{" "}
          <b className="text-[var(--text-primary)]">MLS-11-04</b>{" "}
          {t("materials.moTaMLS1104")}
        </p>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          <b className="text-[var(--text-primary)]">
            {t("materials.docToanBoSheet")}
          </b>{" "}
          {t("materials.docSheetTheoTen")}
        </p>
        <input
          type="file"
          name="file"
          accept=".xls,.xlsx,.doc,.docx"
          required
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={<Upload className="size-4" />}
        >
          {pending
            ? t("materials.dangNhapDuLieu")
            : t("materials.nutNhapVaoDanhMuc")}
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
