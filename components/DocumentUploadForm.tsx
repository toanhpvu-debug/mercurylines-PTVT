"use client";

import { useActionState, useState } from "react";
import { uploadReportDocument } from "@/app/actions";

type VesselOption = {
  id: number;
  code: string;
  name: string;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export default function DocumentUploadForm({
  vessels,
}: {
  vessels: VesselOption[];
}) {
  const [state, formAction, pending] = useActionState(uploadReportDocument, {
    message: "",
  });
  const [clientError, setClientError] = useState("");
  const v = state.values ?? {};
  const single = vessels.length === 1;
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem(
          "file"
        ) as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
          e.preventDefault();
          setClientError(
            `File "${file.name}" nặng ${(file.size / (1024 * 1024)).toFixed(1)}MB, vượt quá giới hạn 20MB.`
          );
        } else {
          setClientError("");
        }
      }}
      className="space-y-3"
    >
      {single ? (
        <input type="hidden" name="vesselId" value={vessels[0].id} />
      ) : (
        <div>
          <label className="mb-1 block text-sm text-slate-600">Tàu</label>
          <select
            name="vesselId"
            defaultValue={v.vesselId ?? ""}
            className="w-full rounded border p-2"
            required
          >
            <option value="">Chọn tàu</option>
            {vessels.map((vessel) => (
              <option key={vessel.id} value={vessel.id}>
                {vessel.code} - {vessel.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Loại báo cáo
          </label>
          <select
            name="reportType"
            defaultValue={v.reportType ?? "MLS-11-01"}
            className="w-full rounded border p-2"
          >
            <option value="MLS-11-01">
              MLS-11-01 — Nhận & sử dụng vật tư
            </option>
            <option value="MLS-11-04">
              MLS-11-04 — Nhận & sử dụng vật tư (Boong)
            </option>
            <option value="MLS-11-13">
              MLS-11-13 — Dụng cụ chằng buộc container
            </option>
            <option value="KHÁC">Khác</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Kỳ báo cáo
          </label>
          <input
            name="period"
            type="month"
            defaultValue={v.period ?? ""}
            className="w-full rounded border p-2"
          />
        </div>
      </div>
      <input
        name="title"
        placeholder="Tiêu đề (bỏ trống sẽ dùng tên file)"
        defaultValue={v.title ?? ""}
        className="w-full rounded border p-2"
      />
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          File báo cáo (PDF hoặc Excel, tối đa 20MB)
        </label>
        <input
          name="file"
          type="file"
          accept=".pdf,.xls,.xlsx"
          className="w-full rounded border p-2"
          required
        />
      </div>
      <input
        name="note"
        placeholder="Ghi chú (tùy chọn)"
        defaultValue={v.note ?? ""}
        className="w-full rounded border p-2"
      />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang tải lên..." : "Tải báo cáo lên"}
      </button>
      {clientError && <p className="text-sm text-red-600">{clientError}</p>}
      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Lưu ý: file sau khi tải lên là <b>bản lưu bất biến</b> — không thể sửa
        hay thay thế. Nếu nhầm, hãy tải lên bản đúng (bản mới nằm trên cùng);
        chỉ quản trị viên công ty có quyền xóa.
      </p>
    </form>
  );
}
