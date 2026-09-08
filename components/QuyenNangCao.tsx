"use client";

import { useActionState } from "react";

import {
  capNhatPhanCongDoiTau,
  taoUyQuyen,
  thuHoiUyQuyen,
} from "@/app/quyen-actions";
import { ROLE_LABEL, type TrangThaiUyQuyen } from "@/lib/roles";

type VesselOption = { id: number; label: string };
type NguoiDung = { id: number; name: string; email: string; role: string };

const ngayVN = (d: string | Date) =>
  new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Phân công đội tàu cho MỘT tài khoản quản lý kỹ thuật.
 *
 * Không đánh dấu tàu nào nghĩa là thấy toàn đội — nói thẳng điều đó ra ngay
 * trên giao diện, vì "bỏ trống = toàn quyền" là kiểu quy ước dễ hiểu nhầm
 * thành "bỏ trống = không có gì".
 */
export function PhanCongDoiTau({
  user,
  vessels,
  daChon,
}: {
  user: NguoiDung;
  vessels: VesselOption[];
  daChon: number[];
}) {
  const [state, formAction, pending] = useActionState(capNhatPhanCongDoiTau, {
    message: "",
  });
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {vessels.map((v) => (
          <label key={v.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="vesselIds"
              value={v.id}
              defaultChecked={daChon.includes(v.id)}
              className="rounded border-slate-300"
            />
            <span>{v.label}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu phân công"}
        </button>
        <span className="text-xs text-slate-500">
          {daChon.length
            ? `Đang phụ trách ${daChon.length} tàu`
            : "Chưa phân công tàu nào — tài khoản này đang thấy TOÀN ĐỘI"}
        </span>
      </div>
      {state.message && (
        <p
          className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Lập ủy quyền: ai giao, giao cho ai, trong khoảng nào, vì sao. */
export function LapUyQuyen({
  nguoiCoQuyen,
  nguoiNhan,
  laAdmin,
}: {
  nguoiCoQuyen: NguoiDung[];
  nguoiNhan: NguoiDung[];
  laAdmin: boolean;
  /**
   * Người đang mở trang. CỐ Ý không dùng để chọn sẵn ô "Người giao quyền" nữa
   * (xem lý do ở ô đó); vẫn khai báo để nơi gọi truyền vào không thành lỗi kiểu.
   */
  toiId?: number;
}) {
  const [state, formAction, pending] = useActionState(taoUyQuyen, {
    message: "",
  });
  const homNay = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">
          Người giao quyền {laAdmin ? "*" : ""}
        </label>
        {laAdmin ? (
          // KHÔNG chọn sẵn chính người đang mở trang.
          //
          // Trang này chỉ quản trị viên mở được, nên "mặc định là tôi" chính là
          // giá trị mà taoUyQuyen luôn từ chối: quyền quản trị hệ thống không
          // đem cho mượn được. Người dùng ở đây gần như luôn lập ủy quyền HỘ
          // người khác (máy trưởng đi bờ giao cho Máy 2), nên ô này bắt buộc
          // phải chọn tay — bỏ trống thì trình duyệt chặn ngay tại chỗ thay vì
          // để họ bấm Lưu rồi nhận lỗi từ máy chủ ở mọi lần đầu.
          //
          // Dùng hằng "" làm defaultValue chứ không phải một prop: defaultValue
          // chỉ có tác dụng ở lần dựng đầu, nên giá trị lấy từ prop sẽ lệch khi
          // prop đổi mà ô đã dựng xong.
          <select
            name="delegatorId"
            required
            defaultValue=""
            className="w-full rounded border p-2 text-sm"
          >
            <option value="" disabled>
              — Chọn người giao quyền —
            </option>
            {nguoiCoQuyen.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {ROLE_LABEL[u.role] ?? u.role}
              </option>
            ))}
          </select>
        ) : (
          <p className="rounded bg-slate-50 p-2 text-sm text-slate-600">
            Bạn giao quyền của chính mình
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Người nhận *</label>
        <select
          name="delegateId"
          required
          defaultValue=""
          className="w-full rounded border p-2 text-sm"
        >
          <option value="" disabled>
            — Chọn người nhận —
          </option>
          {nguoiNhan.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {ROLE_LABEL[u.role] ?? u.role}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Từ ngày *</label>
          <input
            type="date"
            name="startAt"
            required
            defaultValue={homNay}
            className="w-full rounded border p-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Đến hết ngày *</label>
          <input
            type="date"
            name="endAt"
            required
            className="w-full rounded border p-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Lý do</label>
        <input
          name="reason"
          placeholder="Đi bờ, nghỉ phép, đi họp..."
          className="w-full rounded border p-2 text-sm"
        />
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lập ủy quyền"}
      </button>
      {state.message && (
        <p
          className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ThuHoiUyQuyen({ id }: { id: number }) {
  const [state, formAction, pending] = useActionState(thuHoiUyQuyen, {
    message: "",
  });
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {pending ? "..." : "Thu hồi"}
      </button>
      {state.message && !state.success && (
        <span className="ml-2 text-xs text-red-600">{state.message}</span>
      )}
    </form>
  );
}

/**
 * Nhãn trạng thái của một ủy quyền.
 *
 * Trạng thái được tính SẴN ở phía máy chủ (lib/roles.ts) rồi truyền xuống: máy
 * người dùng có thể lệch giờ, mà "còn hiệu lực hay không" là câu hỏi phải trả
 * lời bằng đồng hồ của máy chủ — chính đồng hồ đã dùng lúc xét quyền.
 */
export function NhanTrangThaiUyQuyen({
  trangThai,
  revokedAt,
}: {
  trangThai: TrangThaiUyQuyen;
  revokedAt: string | Date | null;
}) {
  if (trangThai === "DA_THU_HOI") {
    return (
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        Đã thu hồi{revokedAt ? ` ${ngayVN(revokedAt)}` : ""}
      </span>
    );
  }
  if (trangThai === "HET_HAN") {
    return (
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        Hết hạn
      </span>
    );
  }
  if (trangThai === "CHUA_TOI") {
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
        Chưa tới hạn
      </span>
    );
  }
  return (
    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
      Đang hiệu lực
    </span>
  );
}
