"use client";

import { useState, useTransition } from "react";
import { CalendarRange, Undo2 } from "lucide-react";
import { doiKyKiemKe, goKiemKe } from "@/app/kiem-ke-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Modal } from "@/components/ui-client";

/**
 * Đổi kỳ đối chiếu của một lần kiểm kê chưa áp dụng: ngày kiểm kê (cuối kỳ) và đầu
 * kỳ (bỏ trống = chỉ đối chiếu số đếm). File ghi sai / không ghi kỳ thì sửa ở đây.
 */
export function DoiKyKiemKe({ id, tuNgay, ngayKiemKe, homNay }: { id: number; tuNgay: string; ngayKiemKe: string; homNay: string }) {
  const { t } = useNgonNgu();
  const [tu, setTu] = useState(tuNgay);
  const [den, setDen] = useState(ngayKiemKe);
  const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, chay] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        chay(async () => {
          const r = await doiKyKiemKe(id, tu, den);
          setBao({ ok: Boolean(r.success), chu: r.message });
        });
      }}
    >
      <Field label={t("kiemKe.tuNgay")}>
        <Input type="date" value={tu} max={den || homNay} onChange={(e) => setTu(e.target.value)} className="w-44" />
      </Field>
      <Field label={t("kiemKe.denNgay")}>
        <Input type="date" value={den} max={homNay} required onChange={(e) => setDen(e.target.value)} className="w-44" />
      </Field>
      <Button type="submit" size="sm" loading={dang} icon={<CalendarRange className="size-4" />} disabled={tu === tuNgay && den === ngayKiemKe}>
        {t("kiemKe.nutDoiKy")}
      </Button>
      {bao && <span className={`text-sm ${bao.ok ? "text-[var(--text-success)]" : "text-[var(--text-danger)]"}`}>{bao.chu}</span>}
    </form>
  );
}

/** Gỡ một lần kiểm kê đã áp dụng (bắt ghi lý do): hoàn lại đúng các dòng nó đã ghi. */
export function GoKiemKe({ id }: { id: number }) {
  const { t } = useNgonNgu();
  const [mo, setMo] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dang, chay] = useTransition();
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Undo2 className="size-4" />}
        onClick={() => {
          setBao(null);
          setMo(true);
        }}
      >
        {t("kiemKe.nutGo")}
      </Button>
      {mo && (
        <Modal open onClose={() => setMo(false)} width="max-w-xl" title={t("kiemKe.tieuDeGo")}>
          <form
            className="space-y-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              chay(async () => {
                const r = await goKiemKe(id, lyDo);
                setBao({ ok: Boolean(r.success), chu: r.message });
                if (r.success) setMo(false);
              });
            }}
          >
            <p className="text-sm text-[var(--text-primary)]">{t("kiemKe.goMoTa")}</p>
            <Notice tone="warning">{t("kiemKe.goKhoa")}</Notice>
            <Field label={`${t("kiemKe.lyDoGo")} *`}>
              <Input value={lyDo} onChange={(e) => setLyDo(e.target.value)} required maxLength={200} placeholder={t("kiemKe.lyDoGoGoiY")} />
            </Field>
            {bao && !bao.ok && <Notice tone="danger">{bao.chu}</Notice>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
              <Button type="button" variant="ghost" onClick={() => setMo(false)}>
                {t("chung.huy")}
              </Button>
              <Button type="submit" variant="danger" loading={dang} icon={<Undo2 className="size-4" />}>
                {t("kiemKe.nutXacNhanGo")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {bao?.ok && <span className="text-sm text-[var(--text-success)]">{bao.chu}</span>}
    </>
  );
}
