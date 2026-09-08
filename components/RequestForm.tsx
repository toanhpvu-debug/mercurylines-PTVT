"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { boPhanCuaChucDanh } from "@/lib/roles";
import { useNgonNgu } from "@/lib/i18n/client";

type VesselOption = {
  id: number;
  code: string;
  name: string;
};

type MaterialOption = {
  id: number;
  code: string;
  nameVn: string;
  uom: string;
  materialType: string;
  partNumber: string | null;
  equipment: string | null;
};

type RequestItem = {
  mode: "existing" | "new";
  materialId: string;
  itemName: string;
  itemCode: string;
  itemUom: string;
  quantity: string;
  note: string;
};

const blankItem = (): RequestItem => ({
  mode: "existing",
  materialId: "",
  itemName: "",
  itemCode: "",
  itemUom: "",
  quantity: "1",
  note: "",
});

export default function RequestForm({
  vessels,
  materials,
  defaultVesselId,
  nguoiLap,
}: {
  vessels: VesselOption[];
  materials: MaterialOption[];
  defaultVesselId?: number;
  /** Người đang đăng nhập — tên và chức danh đi thẳng vào yêu cầu. */
  nguoiLap: { name: string; role: string };
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<"STORE" | "SPARE">("STORE");
  const [vesselId, setVesselId] = useState(
    defaultVesselId ? String(defaultVesselId) : ""
  );
  // Bộ phận chọn sẵn theo chức danh: Máy 2 mở form là đã ở bộ phận Máy, Phó 3
  // là ở Boong. Chọn nhầm bộ phận nghĩa là yêu cầu đi lạc sang người duyệt khác.
  const [department, setDepartment] = useState(
    boPhanCuaChucDanh(nguoiLap.role) ?? "ENGINE"
  );
  const [requiredDate, setRequiredDate] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [purpose, setPurpose] = useState("");
  const [equipment, setEquipment] = useState("");
  const [maker, setMaker] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [items, setItems] = useState<RequestItem[]>([blankItem()]);

  const filteredMaterials = useMemo(
    () => materials.filter((m) => m.materialType === kind),
    [materials, kind]
  );

  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (index: number) =>
    setItems(items.filter((_, i) => i !== index));
  const updateItem = (
    index: number,
    field: keyof RequestItem,
    value: string
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    setLoading(true);
    try {
      const payload = {
        kind,
        vesselId: Number(vesselId),
        department,
        requiredDate,
        priority,
        purpose,
        equipment,
        maker,
        serialNo,
        items: items
          .filter((item) =>
            item.mode === "existing"
              ? item.materialId
              : item.itemName.trim()
          )
          .map((item) =>
            item.mode === "existing"
              ? {
                  materialId: Number(item.materialId),
                  quantity: Number(item.quantity),
                  note: item.note,
                }
              : {
                  isNew: true,
                  itemName: item.itemName.trim(),
                  itemCode: item.itemCode.trim(),
                  itemUom: item.itemUom.trim(),
                  quantity: Number(item.quantity),
                  note: item.note,
                }
          ),
      };
      if (!payload.vesselId) {
        setMessage(t("requests.canChonTau"));
        setIsError(true);
        setLoading(false);
        return;
      }
      if (!payload.items.length) {
        setMessage(t("requests.canMotDong"));
        setIsError(true);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/material-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || t("requests.coLoi"));
        setIsError(true);
        setLoading(false);
        return;
      }
      setMessage(
        kind === "SPARE"
          ? t("requests.taoPhuTungThanhCong")
          : t("requests.taoVatTuThanhCong")
      );
      setPurpose("");
      setItems([blankItem()]);
      router.refresh();
    } catch {
      setMessage(t("requests.coLoi"));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const isSpare = kind === "SPARE";

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
      <h3 className="mb-4 text-lg font-semibold">
        {isSpare
          ? t("requests.taoYeuCauPhuTung")
          : t("requests.taoYeuCauVatTu")}
      </h3>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setKind("STORE");
              setItems([blankItem()]);
            }}
            className={`rounded px-3 py-1 text-sm ${
              !isSpare
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t("requests.nutLoaiVatTu")}
          </button>
          <button
            type="button"
            onClick={() => {
              setKind("SPARE");
              setItems([blankItem()]);
            }}
            className={`rounded px-3 py-1 text-sm ${
              isSpare
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t("requests.nutLoaiPhuTung")}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            className="rounded border p-2"
            required
          >
            <option value="">{t("chung.chonTau")}</option>
            {vessels.map((vessel) => (
              <option key={vessel.id} value={vessel.id}>
                {vessel.code} - {vessel.name}
              </option>
            ))}
          </select>
          {/* Người yêu cầu không gõ tay nữa — lấy thẳng từ tài khoản đăng nhập
              để chứng từ và nhật ký khớp với người thật sự bấm nút. */}
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
            <span className="text-slate-500">
              {t("requests.nguoiYeuCau")}:{" "}
            </span>
            <b>{nguoiLap.name}</b>
            <span className="text-slate-600">
              {" · "}
              {tTuDo(`labels.role_${nguoiLap.role}`)}
            </span>
          </div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded border p-2"
          >
            {["ENGINE", "DECK", "ELECTRICAL", "GENERAL"].map((bp) => (
              <option key={bp} value={bp}>
                {tTuDo(`labels.reqDept_${bp}`)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={requiredDate}
            onChange={(e) => setRequiredDate(e.target.value)}
            className="rounded border p-2"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded border p-2"
          >
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((uu) => (
              <option key={uu} value={uu}>
                {tTuDo(`labels.priority_${uu}`)}
              </option>
            ))}
          </select>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={t("requests.phMucDich")}
            className="rounded border p-2"
          />
        </div>

        {isSpare && (
          <div className="grid grid-cols-1 gap-3 rounded border bg-slate-50 p-3 md:grid-cols-3">
            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder={t("chung.thietBi")}
              className="rounded border p-2"
            />
            <input
              value={maker}
              onChange={(e) => setMaker(e.target.value)}
              placeholder={t("requests.phHangSanXuat")}
              className="rounded border p-2"
            />
            <input
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
              placeholder={t("requests.phSoMay")}
              className="rounded border p-2"
            />
          </div>
        )}

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded border text-xs">
                  <button
                    type="button"
                    onClick={() => updateItem(index, "mode", "existing")}
                    className={`rounded-l px-2 py-1 ${
                      item.mode === "existing"
                        ? "bg-blue-700 text-white"
                        : "bg-white text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    {t("requests.coSan")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(index, "mode", "new")}
                    className={`rounded-r px-2 py-1 ${
                      item.mode === "new"
                        ? "bg-blue-700 text-white"
                        : "bg-white text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    {t("requests.moiNgoaiDanhMuc")}
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  {t("requests.dongThu", { n: index + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="ml-auto rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                >
                  {t("requests.xoaDong")}
                </button>
              </div>

              {item.mode === "existing" ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <select
                    value={item.materialId}
                    onChange={(e) =>
                      updateItem(index, "materialId", e.target.value)
                    }
                    className="rounded border p-2 md:col-span-4"
                    required
                  >
                    <option value="">
                      {isSpare
                        ? t("requests.chonPhuTung")
                        : t("requests.chonVatTu")}
                    </option>
                    {filteredMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.code} - {material.nameVn}
                        {material.partNumber
                          ? ` (${material.partNumber})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    placeholder={t("requests.slYeuCau")}
                    className="rounded border p-2"
                    required
                  />
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(index, "note", e.target.value)}
                    placeholder={t("chung.ghiChu")}
                    className="rounded border p-2"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <input
                    value={item.itemName}
                    onChange={(e) =>
                      updateItem(index, "itemName", e.target.value)
                    }
                    placeholder={
                      isSpare
                        ? t("requests.phTenPhuTungMoi")
                        : t("requests.phTenVatTuMoi")
                    }
                    className="rounded border p-2 md:col-span-2"
                    required
                  />
                  <input
                    value={item.itemCode}
                    onChange={(e) =>
                      updateItem(index, "itemCode", e.target.value)
                    }
                    placeholder={isSpare ? "Part No." : t("requests.maImpa")}
                    className="rounded border p-2"
                  />
                  <input
                    value={item.itemUom}
                    onChange={(e) =>
                      updateItem(index, "itemUom", e.target.value)
                    }
                    placeholder={t("requests.phDvt")}
                    className="rounded border p-2"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    placeholder={t("requests.slYeuCau")}
                    className="rounded border p-2"
                    required
                  />
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(index, "note", e.target.value)}
                    placeholder={t("chung.ghiChu")}
                    className="rounded border p-2"
                  />
                </div>
              )}
            </div>
          ))}
          {filteredMaterials.length === 0 && (
            <p className="text-sm text-amber-700">
              {isSpare
                ? t("requests.chuaCoPhuTungCoSan")
                : t("requests.chuaCoVatTuCoSan")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addItem}
            className="rounded border px-4 py-2 hover:bg-blue-50"
          >
            {t("requests.themDong")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? t("chung.dangXuLy") : t("requests.nutTaoYeuCau")}
          </button>
        </div>
        {message && (
          <p
            className={`text-sm ${
              isError ? "text-red-600" : "text-green-700"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
