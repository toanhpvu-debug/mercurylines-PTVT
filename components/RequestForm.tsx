"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Send, Trash2 } from "lucide-react";
import { boPhanCuaChucDanh } from "@/lib/roles";
import { useNgonNgu } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Notice,
  Select,
} from "@/components/ui";

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

/**
 * Bản yêu cầu đang được sửa. Vắng mặt = form đang ở chế độ LẬP MỚI.
 *
 * Cùng một form cho cả lập và sửa vì hai việc đó nhìn thấy và gõ vào đúng những
 * ô như nhau — tách ra thành hai form là mở đường cho chúng lệch nhau (thêm ô
 * mới ở form lập, quên ở form sửa) đúng kiểu lỗi không ai phát hiện cho tới khi
 * người dùng hỏi "sao sửa xong mất mục Nhà sản xuất".
 */
export type YeuCauDangSua = {
  id: number;
  requestNo: string;
  kind: "STORE" | "SPARE";
  vesselId: number;
  department: string;
  priority: string;
  /** yyyy-mm-dd, chuỗi rỗng nếu chưa đặt. */
  requiredDate: string;
  purpose: string;
  equipment: string;
  maker: string;
  serialNo: string;
  items: RequestItem[];
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

/* Nút trong bộ chọn phân đoạn (Vật tư / Phụ tùng, Có sẵn / Mới). */
const SEG_BTN =
  "rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none";
const SEG_ON = "bg-brand-700 text-white shadow-sm";
const SEG_OFF =
  "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]";

/**
 * Dòng điền sẵn từ danh mục (chọn hàng loạt ở /materials → "Yêu cầu nhanh").
 * Một yêu cầu chỉ có MỘT loại (vật tư hoặc phụ tùng): loại lấy theo đa số các
 * mặt hàng được chọn, mặt hàng khác loại hay không thuộc tàu bị bỏ và báo số.
 */
function dongTuDanhMuc(ids: number[] | undefined, materials: MaterialOption[]) {
  if (!ids?.length) return null;
  const chon = ids.map((id) => materials.find((m) => m.id === id)).filter((m): m is MaterialOption => Boolean(m));
  const soSpare = chon.filter((m) => m.materialType === "SPARE").length;
  const kind: "STORE" | "SPARE" = soSpare > chon.length - soSpare ? "SPARE" : "STORE";
  const items: RequestItem[] = chon
    .filter((m) => m.materialType === kind)
    .map((m) => ({ mode: "existing", materialId: String(m.id), itemName: "", itemCode: "", itemUom: "", quantity: "1", note: "" }));
  return { kind, items, boQua: ids.length - items.length };
}

export default function RequestForm({
  vessels,
  materials,
  defaultVesselId,
  nguoiLap,
  dangSua,
  mucBanDau,
}: {
  vessels: VesselOption[];
  materials: MaterialOption[];
  defaultVesselId?: number;
  /** Người đang đăng nhập — tên và chức danh đi thẳng vào yêu cầu. */
  nguoiLap: { name: string; role: string };
  /** Có = sửa bản đã lập; không có = lập mới. */
  dangSua?: YeuCauDangSua;
  /** Id mặt hàng chọn sẵn từ danh mục (?vatTu=1,2,3). */
  mucBanDau?: number[];
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const laSua = Boolean(dangSua);
  const [dienSan] = useState(() => (dangSua ? null : dongTuDanhMuc(mucBanDau, materials)));
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<"STORE" | "SPARE">(dangSua?.kind ?? dienSan?.kind ?? "STORE");
  const [vesselId, setVesselId] = useState(
    dangSua ? String(dangSua.vesselId) : defaultVesselId ? String(defaultVesselId) : ""
  );
  // Bộ phận chọn sẵn theo chức danh: Máy 2 mở form là đã ở bộ phận Máy, Phó 3
  // là ở Boong. Chọn nhầm bộ phận nghĩa là yêu cầu đi lạc sang người duyệt khác.
  // Khi SỬA thì lấy đúng bộ phận của chứng từ, không đoán lại theo người đang mở.
  const [department, setDepartment] = useState(
    dangSua?.department ?? boPhanCuaChucDanh(nguoiLap.role) ?? "ENGINE"
  );
  const [requiredDate, setRequiredDate] = useState(dangSua?.requiredDate ?? "");
  const [priority, setPriority] = useState(dangSua?.priority ?? "NORMAL");
  const [purpose, setPurpose] = useState(dangSua?.purpose ?? "");
  const [equipment, setEquipment] = useState(dangSua?.equipment ?? "");
  const [maker, setMaker] = useState(dangSua?.maker ?? "");
  const [serialNo, setSerialNo] = useState(dangSua?.serialNo ?? "");
  const [items, setItems] = useState<RequestItem[]>(
    dangSua?.items.length ? dangSua.items : dienSan?.items.length ? dienSan.items : [blankItem()]
  );

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
      const res = await fetch(
        dangSua ? `/api/material-requests/${dangSua.id}` : "/api/material-requests",
        {
          method: dangSua ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || t("requests.coLoi"));
        setIsError(true);
        setLoading(false);
        return;
      }
      if (dangSua) {
        // Về thẳng trang chứng từ: người sửa xong muốn xem lại tờ vừa sửa, chứ
        // không phải ngồi tiếp trước một form đã lưu rồi. refresh() trước push()
        // để trang đích dựng lại từ dữ liệu mới chứ không lấy bản đệm cũ.
        setMessage(t("requests.suaThanhCong"));
        router.refresh();
        router.push(`/requests/${dangSua.id}`);
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
    <Card>
      <CardHeader
        icon={<ClipboardList className="size-4" />}
        title={
          laSua
            ? isSpare
              ? t("requests.suaYeuCauPhuTung")
              : t("requests.suaYeuCauVatTu")
            : isSpare
              ? t("requests.taoYeuCauPhuTung")
              : t("requests.taoYeuCauVatTu")
        }
        subtitle={laSua ? t("requests.suaMoTa") : undefined}
      />
      <form onSubmit={submit} className="space-y-4">
        {dienSan && dienSan.items.length > 0 && (
          <Notice tone={dienSan.boQua ? "warning" : "info"}>
            {t("requests.chonTuDanhMuc", { n: dienSan.items.length })}
            {dienSan.boQua ? ` ${t("requests.chonTuDanhMucBoQua", { n: dienSan.boQua })}` : ""}
          </Notice>
        )}
        {/* Đổi loại là xóa sạch các dòng đã gõ (vật tư và phụ tùng dùng hai danh
            mục khác nhau). Khi SỬA thì loại đã khóa — số yêu cầu mã hóa nó —
            nên hai nút này tắt hẳn thay vì để bấm rồi mất hết dòng vô ích. */}
        <div className="inline-flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
          <button
            type="button"
            disabled={laSua}
            onClick={() => {
              setKind("STORE");
              setItems([blankItem()]);
            }}
            aria-pressed={!isSpare}
            className={cn(
              SEG_BTN,
              !isSpare ? SEG_ON : SEG_OFF,
              laSua && "cursor-not-allowed opacity-60"
            )}
          >
            {t("requests.nutLoaiVatTu")}
          </button>
          <button
            type="button"
            disabled={laSua}
            onClick={() => {
              setKind("SPARE");
              setItems([blankItem()]);
            }}
            aria-pressed={isSpare}
            className={cn(
              SEG_BTN,
              isSpare ? SEG_ON : SEG_OFF,
              laSua && "cursor-not-allowed opacity-60"
            )}
          >
            {t("requests.nutLoaiPhuTung")}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label={t("chung.tau")}>
            <Select
              value={vesselId}
              onChange={(e) => setVesselId(e.target.value)}
              disabled={laSua}
              required
            >
              <option value="">{t("chung.chonTau")}</option>
              {vessels.map((vessel) => (
                <option key={vessel.id} value={vessel.id}>
                  {vessel.code} - {vessel.name}
                </option>
              ))}
            </Select>
          </Field>
          {/* Người yêu cầu không gõ tay nữa — lấy thẳng từ tài khoản đăng nhập
              để chứng từ và nhật ký khớp với người thật sự bấm nút. */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              {t("requests.nguoiYeuCau")}
            </span>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <b className="text-[var(--text-primary)]">{nguoiLap.name}</b>
              <span className="text-[var(--text-secondary)]">
                {" · "}
                {tTuDo(`labels.role_${nguoiLap.role}`)}
              </span>
            </div>
          </div>
          <Field label={t("requests.cotBoPhan")}>
            <Select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {["ENGINE", "DECK", "ELECTRICAL", "GENERAL"].map((bp) => (
                <option key={bp} value={bp}>
                  {tTuDo(`labels.reqDept_${bp}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("chung.ngay")}>
            <Input
              type="date"
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </Field>
          <Field label={t("requests.cotUuTien")}>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((uu) => (
                <option key={uu} value={uu}>
                  {tTuDo(`labels.priority_${uu}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("requests.phMucDich")}>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t("requests.phMucDich")}
            />
          </Field>
        </div>

        {isSpare && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 md:grid-cols-3">
            <Field label={t("chung.thietBi")}>
              <Input
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder={t("chung.thietBi")}
              />
            </Field>
            <Field label={t("requests.phHangSanXuat")}>
              <Input
                value={maker}
                onChange={(e) => setMaker(e.target.value)}
                placeholder={t("requests.phHangSanXuat")}
              />
            </Field>
            <Field label={t("requests.phSoMay")}>
              <Input
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder={t("requests.phSoMay")}
              />
            </Field>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => updateItem(index, "mode", "existing")}
                    aria-pressed={item.mode === "existing"}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                      item.mode === "existing" ? SEG_ON : SEG_OFF
                    )}
                  >
                    {t("requests.coSan")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(index, "mode", "new")}
                    aria-pressed={item.mode === "new"}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                      item.mode === "new" ? SEG_ON : SEG_OFF
                    )}
                  >
                    {t("requests.moiNgoaiDanhMuc")}
                  </button>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {t("requests.dongThu", { n: index + 1 })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  icon={<Trash2 className="size-4" />}
                  className="ml-auto text-[var(--text-danger)]"
                >
                  {t("requests.xoaDong")}
                </Button>
              </div>

              {item.mode === "existing" ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <Select
                    value={item.materialId}
                    onChange={(e) =>
                      updateItem(index, "materialId", e.target.value)
                    }
                    className="md:col-span-4"
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
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    placeholder={t("requests.slYeuCau")}
                    className="tabular"
                    required
                  />
                  <Input
                    value={item.note}
                    onChange={(e) => updateItem(index, "note", e.target.value)}
                    placeholder={t("chung.ghiChu")}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <Input
                    value={item.itemName}
                    onChange={(e) =>
                      updateItem(index, "itemName", e.target.value)
                    }
                    placeholder={
                      isSpare
                        ? t("requests.phTenPhuTungMoi")
                        : t("requests.phTenVatTuMoi")
                    }
                    className="md:col-span-2"
                    required
                  />
                  <Input
                    value={item.itemCode}
                    onChange={(e) =>
                      updateItem(index, "itemCode", e.target.value)
                    }
                    placeholder={isSpare ? "Part No." : t("requests.maImpa")}
                  />
                  <Input
                    value={item.itemUom}
                    onChange={(e) =>
                      updateItem(index, "itemUom", e.target.value)
                    }
                    placeholder={t("requests.phDvt")}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    placeholder={t("requests.slYeuCau")}
                    className="tabular"
                    required
                  />
                  <Input
                    value={item.note}
                    onChange={(e) => updateItem(index, "note", e.target.value)}
                    placeholder={t("chung.ghiChu")}
                  />
                </div>
              )}
            </div>
          ))}
          {filteredMaterials.length === 0 && (
            <Notice tone="warning">
              {isSpare
                ? t("requests.chuaCoPhuTungCoSan")
                : t("requests.chuaCoVatTuCoSan")}
            </Notice>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={addItem}
            icon={<Plus className="size-4" />}
          >
            {t("requests.themDong")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<Send className="size-4" />}
          >
            {loading
              ? laSua
                ? t("requests.dangLuuThayDoi")
                : t("chung.dangXuLy")
              : laSua
                ? t("requests.luuThayDoi")
                : t("requests.nutTaoYeuCau")}
          </Button>
        </div>
        {message && (
          <Notice tone={isError ? "danger" : "success"}>{message}</Notice>
        )}
      </form>
    </Card>
  );
}
