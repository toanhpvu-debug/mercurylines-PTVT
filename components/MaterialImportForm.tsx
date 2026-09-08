"use client";

import { startTransition, useActionState, useState } from "react";
import { importMaterials } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

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
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("chung.tau")} *
          </span>
          <select
            name="vesselId"
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              // File kiểm kê luôn có cột "Tồn trên tàu" nên mặc định là GHI TỒN
              // theo sheet; muốn chỉ nạp danh mục thì chọn lại trong ô bên cạnh.
              setWarehouseId(e.target.value ? "AUTO" : "");
            }}
            className="w-full rounded border p-2"
            required
          >
            <option value="">— {t("chung.chonTau")} —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("materials.loaiDuPhong")}
          </span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="STORE">{tTuDo("labels.typeLong_STORE")}</option>
            <option value="SPARE">{tTuDo("labels.typeLong_SPARE")}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("materials.ghiTonVaoKho")}
          </span>
          {/* Danh sách kho phụ thuộc tàu. Trước đây ô này bị khóa im lặng và chỉ
              hiện "— Không ghi tồn —" nên trông như hỏng; nay nói rõ phải chọn tàu. */}
          <select
            name="warehouseId"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!vesselId}
          >
            {!vesselId ? (
              <option value="">← {t("materials.chonTauTruoc")}</option>
            ) : (
              <>
                <option value="AUTO">
                  ⭑ {t("materials.tuDongTheoSheet")}
                </option>
                {vesselWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
                <option value="">{t("materials.khongGhiTon")}</option>
              </>
            )}
          </select>
        </label>
      </div>

      {vesselId && vesselWarehouses.length === 0 && (
        <p className="rounded border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800">
          {t("materials.tauChuaCoKho")}{" "}
          <b>{t("materials.duongDanTaoKho")}</b>{" "}
          {t("materials.taoKhoTruoc")}
        </p>
      )}
      {warehouseId === "AUTO" && (
        <p className="rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">
          {t("materials.robTruoc")} <b>{t("materials.robTenCot")}</b>{" "}
          {t("materials.robSau")}
        </p>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <p className="mb-1 font-semibold text-blue-950">
          {t("materials.fileDanhMuc")}
        </p>
        <p className="mb-3 text-xs text-slate-600">
          {t("materials.nhanFormCongTy")} <b>MLS-11-06</b>{" "}
          {t("materials.moTaMLS1106")} <b>MLS-11-04</b>{" "}
          {t("materials.moTaMLS1104")}
        </p>
        <p className="mb-3 rounded border border-blue-200 bg-white/70 p-2 text-xs text-slate-700">
          <b>{t("materials.docToanBoSheet")}</b>{" "}
          {t("materials.docSheetTheoTen")}
        </p>
        <input
          type="file"
          name="file"
          accept=".xls,.xlsx,.doc,.docx"
          required
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending
            ? t("materials.dangNhapDuLieu")
            : t("materials.nutNhapVaoDanhMuc")}
        </button>
      </div>
      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
