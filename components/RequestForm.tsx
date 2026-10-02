"use client";

import { memo, useCallback, useMemo, useState } from "react";
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
  /** R.O.B ghi cho hàng MỚI (ngoài danh mục) — từ file MLS-11-05 hoặc bản đã lập. */
  rob?: string;
  /** Dòng nhắc dưới mục (đọc từ file: R.O.B trên file, cảnh báo khi đọc). */
  goiY?: string;
  /** Dòng sơn (yêu cầu sơn): id loại sơn trong danh mục sơn — giữ nguyên khi sửa. */
  paintProductId?: string;
};

/**
 * Điền sẵn từ file MLS-11-05A/B đã tải (/requests?tuTep=<id>) — trang dựng sẵn
 * mọi dòng (đã ghép danh mục), form chỉ nhận vào và để người lập soát.
 */
export type DienTuFile = {
  tepId: number;
  ten: string;
  kind: "STORE" | "SPARE";
  vesselId: number | null;
  department: string | null;
  /** yyyy-mm-dd hoặc "". */
  requiredDate: string;
  purpose: string;
  equipment: string;
  maker: string;
  serialNo: string;
  items: RequestItem[];
  khop: number;
  moi: number;
  thieuSo: number;
  canhBao: number;
  phan: string[];
  /** Ô tàu trên file khi không nhận ra tàu. */
  tauFile: string | null;
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
  tuFile,
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
  /** Điền sẵn từ file MLS-11-05A/B (?tuTep=<id>). */
  tuFile?: DienTuFile;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const laSua = Boolean(dangSua);
  const [dienSan] = useState(() => (dangSua || tuFile ? null : dongTuDanhMuc(mucBanDau, materials)));
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<"STORE" | "SPARE">(dangSua?.kind ?? tuFile?.kind ?? dienSan?.kind ?? "STORE");
  const [vesselId, setVesselId] = useState(
    dangSua
      ? String(dangSua.vesselId)
      : tuFile?.vesselId
        ? String(tuFile.vesselId)
        : defaultVesselId
          ? String(defaultVesselId)
          : ""
  );
  // Bộ phận chọn sẵn theo chức danh: Máy 2 mở form là đã ở bộ phận Máy, Phó 3
  // là ở Boong. Chọn nhầm bộ phận nghĩa là yêu cầu đi lạc sang người duyệt khác.
  // Khi SỬA thì lấy đúng bộ phận của chứng từ, không đoán lại theo người đang mở.
  const [department, setDepartment] = useState(
    dangSua?.department ?? tuFile?.department ?? boPhanCuaChucDanh(nguoiLap.role) ?? "ENGINE"
  );
  const [requiredDate, setRequiredDate] = useState(dangSua?.requiredDate ?? tuFile?.requiredDate ?? "");
  const [priority, setPriority] = useState(dangSua?.priority ?? "NORMAL");
  const [purpose, setPurpose] = useState(dangSua?.purpose ?? tuFile?.purpose ?? "");
  const [equipment, setEquipment] = useState(dangSua?.equipment ?? tuFile?.equipment ?? "");
  const [maker, setMaker] = useState(dangSua?.maker ?? tuFile?.maker ?? "");
  const [serialNo, setSerialNo] = useState(dangSua?.serialNo ?? tuFile?.serialNo ?? "");
  const [items, setItems] = useState<RequestItem[]>(
    dangSua?.items.length
      ? dangSua.items
      : tuFile?.items.length
        ? tuFile.items
        : dienSan?.items.length
          ? dienSan.items
          : [blankItem()]
  );

  const filteredMaterials = useMemo(
    () => materials.filter((m) => m.materialType === kind),
    [materials, kind]
  );

  // Tra mặt hàng đang chọn của từng dòng — dòng đóng chỉ vẽ đúng option này.
  const theoId = useMemo(
    () => new Map(filteredMaterials.map((m) => [String(m.id), m])),
    [filteredMaterials]
  );
  // Dòng đang mở danh sách đầy đủ (vừa bấm / focus vào ô chọn mặt hàng).
  const [dongMo, setDongMo] = useState<number | null>(null);

  // Cập nhật kiểu hàm + useCallback: hàm ổn định nên các dòng (memo) không
  // dựng lại khi gõ ở dòng khác, và dòng không đổi giữ nguyên object.
  const addItem = () => setItems((cu) => [...cu, blankItem()]);
  const removeItem = useCallback(
    (index: number) => setItems((cu) => cu.filter((_, i) => i !== index)),
    []
  );
  const updateItem = useCallback(
    (index: number, field: keyof RequestItem, value: string) =>
      setItems((cu) => {
        const updated = [...cu];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      }),
    []
  );

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
                  rob: item.rob?.trim() ? Number(item.rob) : null,
                  paintProductId: item.paintProductId ? Number(item.paintProductId) : null,
                }
          ),
        ...(tuFile ? { tuTep: tuFile.tepId } : {}),
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
      // Lập từ file: rời ?tuTep để form về trống và file đã dùng không điền lại.
      if (tuFile) router.replace("/requests");
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
        {tuFile && (
          <Notice tone={tuFile.thieuSo || tuFile.canhBao || !tuFile.vesselId ? "warning" : "info"}>
            <p>
              {t("requests.tepDaDien", { ten: tuFile.ten, n: tuFile.items.length, khop: tuFile.khop, moi: tuFile.moi })}
            </p>
            {tuFile.thieuSo > 0 && <p>{t("requests.tepThieuSo", { n: tuFile.thieuSo })}</p>}
            {tuFile.canhBao > 0 && <p>{t("requests.tepCanhBao", { n: tuFile.canhBao })}</p>}
            {tuFile.phan.length > 0 && <p>{t("requests.tepPhan", { ds: tuFile.phan.join(", ") })}</p>}
            {!tuFile.vesselId && (
              <p>
                {t("requests.tepChuaNhanTau")}
                {tuFile.tauFile ? ` ${t("requests.tepTauKhac", { ten: tuFile.tauFile })}` : ""}
              </p>
            )}
          </Notice>
        )}
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
            <DongYeuCauForm
              key={index}
              item={item}
              index={index}
              isSpare={isSpare}
              danhSach={filteredMaterials}
              dangChon={item.materialId ? theoId.get(item.materialId) : undefined}
              moDu={dongMo === index}
              onMo={setDongMo}
              onSua={updateItem}
              onXoa={removeItem}
            />
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

/**
 * Một dòng của form yêu cầu — tách riêng và memo vì form có thể tới hàng trăm
 * dòng (yêu cầu nhanh từ file MLS-11-05, tick cả bộ phận ở Danh mục).
 *
 * Ô chọn mặt hàng của dòng ĐÓNG chỉ vẽ option đang chọn; danh sách đầy đủ chỉ
 * vẽ cho dòng vừa được bấm / focus (moDu). Trước đây mỗi dòng vẽ nguyên danh
 * mục: đo 2026-10-02, file 169 dòng của người toàn đội ra 1.448 KB HTML / 245 KB
 * gzip với 11.832 <option>; tick 100 mặt hàng ra 1 MB gzip, và mỗi phím gõ dựng
 * lại mọi <select> của mọi dòng.
 */
const DongYeuCauForm = memo(function DongYeuCauForm({
  item,
  index,
  isSpare,
  danhSach,
  dangChon,
  moDu,
  onMo,
  onSua,
  onXoa,
}: {
  item: RequestItem;
  index: number;
  isSpare: boolean;
  danhSach: MaterialOption[];
  dangChon: MaterialOption | undefined;
  moDu: boolean;
  onMo: (index: number) => void;
  onSua: (index: number, field: keyof RequestItem, value: string) => void;
  onXoa: (index: number) => void;
}) {
  const { t } = useNgonNgu();
  return (
    <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onSua(index, "mode", "existing")}
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
            onClick={() => onSua(index, "mode", "new")}
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
          onClick={() => onXoa(index)}
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
              onSua(index, "materialId", e.target.value)
            }
            className="md:col-span-4"
            required
            // Mở đủ danh sách cho đúng dòng này ngay khi bấm / tab vào (trước
            // khi trình duyệt bung hộp chọn).
            onPointerDown={() => onMo(index)}
            onFocus={() => onMo(index)}
          >
            <option value="">
              {isSpare
                ? t("requests.chonPhuTung")
                : t("requests.chonVatTu")}
            </option>
            {(moDu ? danhSach : dangChon ? [dangChon] : []).map((m) => (
              <option key={m.id} value={m.id}>
                {`${m.code} - ${m.nameVn}${m.partNumber ? ` (${m.partNumber})` : ""}`}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={item.quantity}
            onChange={(e) =>
              onSua(index, "quantity", e.target.value)
            }
            placeholder={t("requests.slYeuCau")}
            className="tabular"
            required
          />
          <Input
            value={item.note}
            onChange={(e) => onSua(index, "note", e.target.value)}
            placeholder={t("chung.ghiChu")}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <Input
            value={item.itemName}
            onChange={(e) =>
              onSua(index, "itemName", e.target.value)
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
              onSua(index, "itemCode", e.target.value)
            }
            placeholder={isSpare ? "Part No." : t("requests.maImpa")}
          />
          <Input
            value={item.itemUom}
            onChange={(e) =>
              onSua(index, "itemUom", e.target.value)
            }
            placeholder={t("requests.phDvt")}
          />
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={item.quantity}
            onChange={(e) =>
              onSua(index, "quantity", e.target.value)
            }
            placeholder={t("requests.slYeuCau")}
            className="tabular"
            required
          />
          <Input
            value={item.note}
            onChange={(e) => onSua(index, "note", e.target.value)}
            placeholder={t("chung.ghiChu")}
          />
        </div>
      )}
      {item.goiY && (
        <p className="text-xs text-[var(--text-muted)]">{item.goiY}</p>
      )}
    </div>
  );
});
