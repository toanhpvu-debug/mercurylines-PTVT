"use client";

import { useState, useTransition } from "react";
import { ScanText } from "lucide-react";
import { docPhieuTuPdf } from "@/app/consumable-actions";
import type { PhieuDeXuat } from "@/lib/bunkerParse";
import { useNgonNgu } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { Button, Input } from "@/components/ui";

export type KetQuaDoc = {
  deXuat?: PhieuDeXuat;
  tepTam?: string;
  tenTep?: string;
  coTep?: number;
};

/**
 * Lớp cho ô chọn tệp: nút "Chọn tệp" của trình duyệt tô màu nhấn nhạt để cùng
 * dáng với các nút khác. Dùng chung với form ghi phiếu (ConsumableForms).
 */
export const LOP_O_TEP =
  "file:mr-3 file:rounded-md file:border-0 file:bg-brand-500/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-brand-700 dark:file:text-brand-300";

/**
 * Đọc BDN / phiếu giao từ file PDF — kể cả bản SCAN — rồi điền sẵn vào form.
 *
 * KHÔNG dùng <form> riêng: component này nằm bên trong form ghi phiếu, mà HTML
 * không cho lồng form. Gọi thẳng server action như một hàm async.
 *
 * Máy chỉ ĐỀ XUẤT; người nhập đối chiếu với bản gốc rồi mới bấm lưu. Bản gốc
 * được đính kèm luôn vào phiếu — đó mới là chỗ bảo đảm chính xác về sau, chứ
 * không phải tin vào máy đọc.
 */
export default function ConsumablePdfReader({
  vesselId,
  onDoc,
}: {
  vesselId: number;
  onDoc: (kq: KetQuaDoc) => void;
}) {
  const { t } = useNgonNgu();
  const [dangChay, batDau] = useTransition();
  const [thongBao, setThongBao] = useState("");
  const [tot, setTot] = useState(false);
  const [chu, setChu] = useState("");
  const [tep, setTep] = useState<File | null>(null);

  const doc = () => {
    if (!tep) {
      setThongBao(t("consumables.hayChonPdf"));
      setTot(false);
      return;
    }
    const fd = new FormData();
    fd.set("vesselId", String(vesselId));
    fd.set("file", tep);
    batDau(async () => {
      const kq = await docPhieuTuPdf({ message: "" }, fd);
      setThongBao(kq.message);
      setTot(!!kq.success);
      setChu(kq.chu ?? "");
      onDoc({
        deXuat: kq.deXuat,
        tepTam: kq.tepTam,
        tenTep: tep.name,
        coTep: tep.size,
      });
    });
  };

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <ScanText className="size-4 text-[var(--text-muted)]" />
        {t("consumables.docTuPdf")}
      </p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        {t("consumables.moTaDocTruoc")}{" "}
        <b className="text-[var(--text-primary)]">{t("consumables.dienSanDam")}</b>{" "}
        {t("consumables.moTaDocGiua")}{" "}
        <b className="text-[var(--text-primary)]">{t("consumables.doiChieuDam")}</b>.{" "}
        {t("consumables.moTaDocSau")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            type="file"
            accept=".pdf"
            onChange={(e) => setTep(e.target.files?.[0] ?? null)}
            className={LOP_O_TEP}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={doc}
          loading={dangChay}
          icon={<ScanText className="size-4" />}
        >
          {dangChay
            ? t("consumables.dangDocScan")
            : t("consumables.nutDocFile")}
        </Button>
      </div>
      {thongBao && (
        <p
          className={cn(
            "mt-2 text-sm",
            tot ? "text-[var(--text-success)]" : "text-[var(--text-warning)]"
          )}
        >
          {thongBao}
        </p>
      )}
      {chu && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-brand-700 hover:underline dark:text-brand-300">
            {t("consumables.xemChuDoc")}
          </summary>
          <pre className="mt-1 max-h-56 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 font-mono text-[11px] whitespace-pre-wrap text-[var(--text-secondary)]">
            {chu}
          </pre>
        </details>
      )}
    </div>
  );
}
