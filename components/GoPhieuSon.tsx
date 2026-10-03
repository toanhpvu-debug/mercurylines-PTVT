"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { goPhieuSon } from "@/app/son-phieu-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Modal } from "@/components/ui-client";

/**
 * Gỡ một phiếu giao sơn ĐÃ NHẬP (nhập nhầm phiếu, nhầm tàu, đọc sai cả loạt) — hoặc
 * một báo cáo tồn MLS-11-14 đã cập nhật (`laBaoCao`: hoàn lại mọi dòng nó đã ghi):
 * trừ lại tồn đúng số đã nhập theo phiếu và mở lại phiếu để sửa rồi nhập lại.
 */
export default function GoPhieuSon({ id, laBaoCao = false }: { id: number; laBaoCao?: boolean }) {
  const { t } = useNgonNgu();
  const [mo, setMo] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [bao, setBao] = useState<{ chu: string; ok: boolean } | null>(null);
  const [dangChay, chay] = useTransition();

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
        {t(laBaoCao ? "paint.btNutGo" : "paint.pgNutGo")}
      </Button>
      {bao?.ok && <span className="text-xs text-[var(--text-success)]">{bao.chu}</span>}
      {mo && (
        <Modal open onClose={() => setMo(false)} width="max-w-xl" title={t(laBaoCao ? "paint.btTieuDeGo" : "paint.pgTieuDeGo")}>
          <form
            className="space-y-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              chay(async () => {
                const r = await goPhieuSon(id, lyDo);
                setBao({ chu: r.message, ok: Boolean(r.success) });
                if (r.success) setMo(false);
              });
            }}
          >
            <p className="text-sm text-[var(--text-primary)]">{t(laBaoCao ? "paint.btGoMoTa" : "paint.pgGoMoTa")}</p>
            <Notice tone="warning">{t(laBaoCao ? "paint.btGoKhoa" : "paint.pgGoKhoa")}</Notice>
            <Field label={`${t("paint.tsLyDoGo")} *`}>
              <Input value={lyDo} onChange={(e) => setLyDo(e.target.value)} required maxLength={200} placeholder={t(laBaoCao ? "paint.btLyDoGoGoiY" : "paint.pgLyDoGoGoiY")} />
            </Field>
            {bao && !bao.ok && <Notice tone="danger">{bao.chu}</Notice>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
              <Button type="button" variant="ghost" onClick={() => setMo(false)}>
                {t("chung.huy")}
              </Button>
              <Button type="submit" variant="danger" loading={dangChay} icon={<Undo2 className="size-4" />}>
                {t(laBaoCao ? "paint.btNutXacNhanGo" : "paint.pgNutXacNhanGo")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
