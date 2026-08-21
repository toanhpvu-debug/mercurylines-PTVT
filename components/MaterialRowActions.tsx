"use client";

import { useActionState, useState } from "react";
import {
  deleteMaterial,
  setMaterialActive,
  updateMaterial,
} from "@/app/actions";

export type EditableMaterial = {
  id: number;
  code: string;
  nameVn: string;
  nameEn: string | null;
  impa: string | null;
  partNumber: string | null;
  manufacturer: string | null;
  materialType: string;
  equipment: string | null;
  uom: string;
  categoryId: number | null;
  minStock: number;
  maxStock: number;
  isCritical: boolean;
  isActive: boolean;
};

type CategoryOption = { id: number; name: string };

export default function MaterialRowActions({
  material,
  categories,
  onlyEdit = false,
}: {
  material: EditableMaterial;
  categories: CategoryOption[];
  /**
   * Chỉ hiện nút Sửa. Dùng ở chế độ xem theo tàu: ngừng dùng / xóa là thao tác
   * trên bản ghi dùng chung toàn đội, làm từ danh mục gốc mới đúng ngữ cảnh.
   */
  onlyEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(updateMaterial, {
    message: "",
  });
  const [toggleState, toggleAction, togglePending] = useActionState(
    setMaterialActive,
    { message: "" }
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMaterial,
    { message: "" }
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 hover:bg-blue-200"
        >
          Sửa
        </button>
        {!onlyEdit && (
        <form action={toggleAction}>
          <input type="hidden" name="id" value={material.id} />
          <input
            type="hidden"
            name="active"
            value={material.isActive ? "false" : "true"}
          />
          <button
            disabled={togglePending}
            className={`rounded px-2 py-1 text-xs disabled:opacity-50 ${
              material.isActive
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {togglePending
              ? "..."
              : material.isActive
                ? "Ngừng sử dụng"
                : "Dùng lại"}
          </button>
        </form>
        )}
        {!onlyEdit && (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            const ok = window.confirm(
              `Xóa vĩnh viễn vật tư ${material.code}? Chỉ xóa được khi chưa có tồn kho và chưa dùng trong yêu cầu nào.`
            );
            if (!ok) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={material.id} />
          <button
            disabled={deletePending}
            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {deletePending ? "..." : "Xóa"}
          </button>
        </form>
        )}
      </div>

      {(toggleState.message || deleteState.message) && (
        <p className="text-xs text-red-600">
          {toggleState.message || deleteState.message}
        </p>
      )}
      {saveState.message && !editing && (
        <p
          className={`text-xs ${
            saveState.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {saveState.message}
        </p>
      )}

      {editing && (
        <EditDialog
          material={material}
          categories={categories}
          action={saveAction}
          pending={savePending}
          message={saveState.message}
          success={saveState.success}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// Form sửa mở dạng hộp thoại phủ màn hình — bảng danh mục có tới 11 cột nên
// nhồi form vào trong ô thao tác sẽ vỡ bố cục.
function EditDialog({
  material,
  categories,
  action,
  pending,
  message,
  success,
  onClose,
}: {
  material: EditableMaterial;
  categories: CategoryOption[];
  action: (formData: FormData) => void;
  pending: boolean;
  message: string;
  success?: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState(material.materialType);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4">
      <form
        action={action}
        className="mx-auto my-8 w-full max-w-3xl space-y-3 rounded-xl bg-white p-5 text-left shadow-xl"
      >
        <input type="hidden" name="id" value={material.id} />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-blue-950">Sửa vật tư</h3>
            <p className="font-mono text-sm text-slate-500">{material.code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Mã *</span>
            <input
              name="code"
              defaultValue={material.code}
              required
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-600">
              Tên tiếng Việt *
            </span>
            <input
              name="nameVn"
              defaultValue={material.nameVn}
              required
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block md:col-span-3">
            <span className="mb-1 block text-sm text-slate-600">
              Tên tiếng Anh
            </span>
            <input
              name="nameEn"
              defaultValue={material.nameEn ?? ""}
              className="w-full rounded border p-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Loại</span>
            <select
              name="materialType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded border p-2"
            >
              <option value="STORE">Vật tư (Store)</option>
              <option value="SPARE">Phụ tùng (Spare)</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-600">
              Thiết bị
              {type !== "SPARE" ? " — chỉ dùng cho phụ tùng" : ""}
            </span>
            <input
              name="equipment"
              defaultValue={material.equipment ?? ""}
              disabled={type !== "SPARE"}
              placeholder="Main Engine, Air Compressor..."
              className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              IMPA — 6 chữ số
            </span>
            <input
              name="impa"
              defaultValue={material.impa ?? ""}
              placeholder="190115"
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              Part No. — mã nhà sản xuất
            </span>
            <input
              name="partNumber"
              defaultValue={material.partNumber ?? ""}
              placeholder="VLH-53.06.01"
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Maker</span>
            <input
              name="manufacturer"
              defaultValue={material.manufacturer ?? ""}
              className="w-full rounded border p-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Nhóm</span>
            <select
              name="categoryId"
              defaultValue={material.categoryId ?? ""}
              className="w-full rounded border p-2"
            >
              <option value="">— Không thuộc nhóm nào —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Đơn vị</span>
            <input
              name="uom"
              defaultValue={material.uom}
              className="w-full rounded border p-2"
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-sm text-slate-600">
                Tồn tối thiểu
              </span>
              <input
                name="minStock"
                type="number"
                min="0"
                step="0.01"
                defaultValue={material.minStock}
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-sm text-slate-600">
                Tồn tối đa
              </span>
              <input
                name="maxStock"
                type="number"
                min="0"
                step="0.01"
                defaultValue={material.maxStock}
                className="w-full rounded border p-2"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 md:col-span-3">
            <input
              type="checkbox"
              name="isCritical"
              defaultChecked={material.isCritical}
              className="h-4 w-4"
            />
            <span className="text-sm text-slate-700">
              Phụ tùng thiết yếu (Critical) — theo dõi riêng trên Dashboard
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <button
            disabled={pending}
            className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600 hover:underline"
          >
            Hủy
          </button>
          {message && (
            <span
              className={`text-sm ${
                success ? "text-green-700" : "text-red-600"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
