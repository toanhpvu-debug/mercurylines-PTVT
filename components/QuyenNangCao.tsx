"use client";

import { useActionState } from "react";
import { Save, ShieldCheck, ShieldOff } from "lucide-react";

import {
  capNhatPhanCongDoiTau,
  taoUyQuyen,
  thuHoiUyQuyen,
} from "@/app/quyen-actions";
import { type TrangThaiUyQuyen } from "@/lib/roles";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice, Select } from "@/components/ui";

type VesselOption = { id: number; label: string };
type NguoiDung = { id: number; name: string; email: string; role: string };

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
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(capNhatPhanCongDoiTau, {
    message: "",
  });
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {vessels.map((v) => (
          <label
            key={v.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-sunken)]"
          >
            <input
              type="checkbox"
              name="vesselIds"
              value={v.id}
              defaultChecked={daChon.includes(v.id)}
              className="size-4 rounded accent-brand-600"
            />
            <span>{v.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          variant="primary"
          loading={pending}
          icon={<Save className="size-4" />}
        >
          {pending ? t("chung.dangLuu") : t("vessels.luuPhanCong")}
        </Button>
        <span className="text-xs text-[var(--text-muted)]">
          {daChon.length
            ? t("vessels.dangPhuTrachNTau", { n: daChon.length })
            : t("vessels.chuaPhanCongTau")}
        </span>
      </div>
      {state.message && (
        <p
          className={`text-xs ${
            state.success
              ? "text-[var(--text-success)]"
              : "text-[var(--text-danger)]"
          }`}
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
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taoUyQuyen, {
    message: "",
  });
  const homNay = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-3">
      <Field
        label={`${t("vessels.cotNguoiGiaoQuyen")}${laAdmin ? " *" : ""}`}
      >
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
          <Select name="delegatorId" required defaultValue="">
            <option value="" disabled>
              {t("vessels.chonNguoiGiaoQuyen")}
            </option>
            {nguoiCoQuyen.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {tTuDo(`labels.role_${u.role}`)}
              </option>
            ))}
          </Select>
        ) : (
          <span className="block rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {t("vessels.tuGiaoQuyen")}
          </span>
        )}
      </Field>
      <Field label={`${t("vessels.cotNguoiNhan")} *`}>
        <Select name="delegateId" required defaultValue="">
          <option value="" disabled>
            {t("vessels.chonNguoiNhan")}
          </option>
          {nguoiNhan.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {tTuDo(`labels.role_${u.role}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`${t("vessels.tuNgay")} *`}>
          <Input type="date" name="startAt" required defaultValue={homNay} />
        </Field>
        <Field label={`${t("vessels.denHetNgay")} *`}>
          <Input type="date" name="endAt" required />
        </Field>
      </div>
      <Field label={t("vessels.cotLyDo")}>
        <Input name="reason" placeholder={t("vessels.phLyDo")} />
      </Field>
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<ShieldCheck className="size-4" />}
      >
        {pending ? t("chung.dangLuu") : t("vessels.lapUyQuyen")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}

export function ThuHoiUyQuyen({ id }: { id: number }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(thuHoiUyQuyen, {
    message: "",
  });
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="danger"
        loading={pending}
        icon={<ShieldOff className="size-4" />}
      >
        {t("vessels.thuHoi")}
      </Button>
      {state.message && !state.success && (
        <span className="ml-2 text-xs text-[var(--text-danger)]">
          {state.message}
        </span>
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
  const { t, ngay } = useNgonNgu();
  if (trangThai === "DA_THU_HOI") {
    return (
      <Badge tone="muted">
        {t("vessels.daThuHoi")}
        {revokedAt
          ? ` ${ngay(revokedAt, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}`
          : ""}
      </Badge>
    );
  }
  if (trangThai === "HET_HAN") {
    return <Badge tone="muted">{t("vessels.hetHan")}</Badge>;
  }
  if (trangThai === "CHUA_TOI") {
    return <Badge tone="warning">{t("vessels.chuaToiHan")}</Badge>;
  }
  return (
    <Badge tone="success" dot>
      {t("vessels.dangHieuLuc")}
    </Badge>
  );
}
