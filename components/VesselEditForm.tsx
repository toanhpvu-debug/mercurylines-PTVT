"use client";

import { useActionState } from "react";
import { updateVessel } from "@/app/actions";
import ChonMayChinh from "@/components/ChonMayChinh";

type VesselData = {
  id: number;
  code: string;
  name: string;
  imo: string | null;
  flag: string | null;
  vesselType: string | null;
  status: string;
  mainEngineGroup: string | null;
  mainEngineModel: string | null;
};

export default function VesselEditForm({ vessel }: { vessel: VesselData }) {
  const [state, formAction, pending] = useActionState(updateVessel, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={vessel.id} />
      <div>
        <label className="mb-1 block text-sm text-slate-600">Mã tàu</label>
        <input
          name="code"
          className="w-full rounded border p-2"
          defaultValue={v.code ?? vessel.code}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">Tên tàu</label>
        <input
          name="name"
          className="w-full rounded border p-2"
          defaultValue={v.name ?? vessel.name}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">IMO number</label>
        <input
          name="imo"
          className="w-full rounded border p-2"
          defaultValue={v.imo ?? vessel.imo ?? ""}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">Cờ tàu</label>
        <input
          name="flag"
          className="w-full rounded border p-2"
          defaultValue={v.flag ?? vessel.flag ?? ""}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">Loại tàu</label>
        <input
          name="vesselType"
          className="w-full rounded border p-2"
          defaultValue={v.vesselType ?? vessel.vesselType ?? ""}
        />
      </div>
      <ChonMayChinh
        nhom={v.mainEngineGroup ?? vessel.mainEngineGroup ?? ""}
        model={v.mainEngineModel ?? vessel.mainEngineModel ?? ""}
      />
      <div>
        <label className="mb-1 block text-sm text-slate-600">Trạng thái</label>
        <select
          name="status"
          className="w-full rounded border p-2"
          defaultValue={v.status ?? vessel.status}
        >
          <option value="ACTIVE">Hoạt động</option>
          <option value="MAINTENANCE">Bảo dưỡng</option>
          <option value="INACTIVE">Ngừng khai thác</option>
        </select>
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
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
