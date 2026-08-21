"use client";

import { useActionState } from "react";
import { approveRequestQuantities } from "@/app/actions";

type ItemInput = {
  id: number;
  code: string;
  name: string;
  quantity: number;
  rob: number;
  /** SL tàu đã duyệt ở bước trước — trần cho bước duyệt của công ty. */
  tauDuyet: number;
};

export default function RequestApprovalForm({
  requestId,
  items,
  capDuyet,
}: {
  requestId: number;
  items: ItemInput[];
  capDuyet: "TAU" | "CONG_TY";
}) {
  const laCongTy = capDuyet === "CONG_TY";
  // Cấp công ty không được duyệt vượt số tàu đã duyệt — trần là số của bước trước.
  const tran = (item: ItemInput) =>
    laCongTy ? Math.min(item.quantity, item.tauDuyet) : item.quantity;
  const [state, formAction, pending] = useActionState(
    approveRequestQuantities,
    { message: "" }
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={requestId} />
      <p className="text-sm text-slate-600">
        {laCongTy
          ? "Nhập số lượng công ty duyệt cho từng dòng. Mặc định bằng số tàu đã duyệt, có thể giảm bớt chứ không tăng."
          : "Nhập số lượng duyệt (S.L Duyệt) cho từng dòng rồi bấm Duyệt. Mặc định bằng số lượng yêu cầu, có thể giảm bớt."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
              <th className="p-2">Mã</th>
              <th className="p-2">Tên</th>
              <th className="p-2">Tồn (ROB)</th>
              <th className="p-2">SL yêu cầu</th>
              {laCongTy && <th className="p-2">Tàu duyệt</th>}
              <th className="p-2">{laCongTy ? "Công ty duyệt" : "SL duyệt"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 font-medium">{item.code}</td>
                <td className="p-2">{item.name}</td>
                <td className="p-2">{item.rob}</td>
                <td className="p-2">{item.quantity}</td>
                {laCongTy && <td className="p-2">{item.tauDuyet}</td>}
                <td className="p-2">
                  <input
                    name={`approved_${item.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    max={tran(item)}
                    defaultValue={tran(item)}
                    className="w-24 rounded border p-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        disabled={pending}
        className="rounded bg-green-100 px-4 py-2 text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        {pending
          ? "Đang duyệt..."
          : laCongTy
            ? "Công ty duyệt"
            : "Tàu duyệt & chuyển lên công ty"}
      </button>
      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
