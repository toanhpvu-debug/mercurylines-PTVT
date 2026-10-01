"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerUpLeft, Send, Undo2, Upload } from "lucide-react";
import { duyetDonMua, nccXacNhanDonMua, rutLaiDonMua, trinhDuyetDonMua } from "@/app/don-mua-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";

function useGoi() {
  const router = useRouter();
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, startT] = useTransition();
  const goi = (fn: () => Promise<{ message: string; success?: boolean }>) =>
    startT(async () => {
      const r = await fn();
      setThongBao({ ok: Boolean(r.success), chu: r.message });
      if (r.success) router.refresh();
    });
  return { thongBao, dang, goi };
}

/** Người lập trình đơn nháp cho lãnh đạo phòng Kỹ thuật – Vật tư duyệt. */
export function TrinhDuyetButton({ poId }: { poId: number }) {
  const { t } = useNgonNgu();
  const { thongBao, dang, goi } = useGoi();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="primary"
        loading={dang}
        icon={<Send className="size-4" />}
        onClick={() => {
          if (window.confirm(t("purchasing.xacNhanTrinhDuyet"))) goi(() => trinhDuyetDonMua(poId));
        }}
      >
        {t("purchasing.nutTrinhDuyet")}
      </Button>
      {/* Trình không được (còn dòng chưa giá, đơn vừa đổi trạng thái...) thì báo TO, không phải dòng chữ nhỏ dễ sót. */}
      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}
    </div>
  );
}

/** Người lập rút đơn đang chờ duyệt về nháp. */
export function RutLaiButton({ poId }: { poId: number }) {
  const { t } = useNgonNgu();
  const { thongBao, dang, goi } = useGoi();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" loading={dang} icon={<Undo2 className="size-4" />} onClick={() => goi(() => rutLaiDonMua(poId))}>
        {t("purchasing.nutRutLai")}
      </Button>
      {thongBao && !thongBao.ok && <span className="text-xs text-[var(--text-danger)]">{thongBao.chu}</span>}
    </span>
  );
}

/** Lãnh đạo phòng Kỹ thuật – Vật tư: duyệt (ghi chú tùy chọn) hoặc trả lại (bắt buộc lý do). */
export function DuyetDonMuaForm({ poId }: { poId: number }) {
  const { t } = useNgonNgu();
  const { thongBao, dang, goi } = useGoi();
  const [ghiChu, setGhiChu] = useState("");
  return (
    <div className="w-full space-y-2">
      <Field label={t("purchasing.ghiChuDuyet")}>
        <Textarea rows={2} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder={t("purchasing.ghiChuDuyetGoiY")} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" loading={dang} icon={<Check className="size-4" />} onClick={() => goi(() => duyetDonMua(poId, true, ghiChu))}>
          {t("purchasing.nutDuyetDon")}
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={dang}
          icon={<CornerUpLeft className="size-4" />}
          onClick={() => {
            if (!ghiChu.trim()) {
              window.alert(t("purchasing.canLyDoTraLai"));
              return;
            }
            goi(() => duyetDonMua(poId, false, ghiChu));
          }}
        >
          {t("purchasing.nutTraLai")}
        </Button>
      </div>
      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}
    </div>
  );
}

/** Ghi nhận nhà cung cấp đã xác nhận đơn (ngày, số / người xác nhận, file PO đã ký gửi lại). */
export function XacNhanNccForm({ poId, homNay }: { poId: number; homNay: string }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(nccXacNhanDonMua, { message: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="w-full space-y-2"
    >
      <input type="hidden" name="poId" value={poId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr]">
        <Field label={t("purchasing.ngayNccXacNhan")}>
          <Input type="date" name="ngay" defaultValue={homNay} max={homNay} />
        </Field>
        <Field label={t("purchasing.soNccXacNhan")}>
          <Input name="ref" placeholder={t("purchasing.soNccXacNhanGoiY")} />
        </Field>
      </div>
      <Field label={t("purchasing.tepNccXacNhan")}>
        <input
          type="file"
          name="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls"
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </Field>
      <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
        {t("purchasing.nutNccXacNhan")}
      </Button>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
