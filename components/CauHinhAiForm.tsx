"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, KeyRound, PlugZap, Save, Trash2 } from "lucide-react";
import { kiemTraKetNoiAiAction, luuCauHinhAiAction, thuDocThatAction, xoaCauHinhAiAction } from "@/app/cau-hinh-ai-actions";
import type { CheDoDocAi, NhaCungCapAi } from "@/lib/docPhieuBangAi";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

export type TrangThaiHienThi = {
  bat: boolean;
  nguon: "db" | "env" | null;
  nhaCungCap: NhaCungCapAi | null;
  model: string | null;
  cheDo: CheDoDocAi;
  duoiKhoa: string | null;
  loiGiaiMa: boolean;
  coEnv: boolean;
};

/**
 * Ô nhập khóa API. Khóa chỉ đi lên server qua server action; sau khi lưu, ô
 * được xóa trắng và chỉ còn 4 ký tự cuối hiện trong trạng thái. "Kiểm tra kết
 * nối" hỏi nhà cung cấp danh sách mô hình — vừa xác nhận khóa đúng, vừa gợi
 * ý tên mô hình để khỏi gõ sai.
 */
export default function CauHinhAiForm({
  trangThai,
  macDinh,
}: {
  trangThai: TrangThaiHienThi;
  macDinh: Record<NhaCungCapAi, string>;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [nhaCungCap, setNhaCungCap] = useState<NhaCungCapAi>(trangThai.nhaCungCap ?? "gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(trangThai.nguon === "db" ? (trangThai.model ?? "") : "");
  const [cheDo, setCheDo] = useState<CheDoDocAi>(trangThai.cheDo);
  const [luu, luuAction, dangLuu] = useActionState(luuCauHinhAiAction, { message: "" });
  const [kiem, kiemAction, dangKiem] = useActionState(kiemTraKetNoiAiAction, { message: "" });
  const [thu, thuAction, dangThu] = useActionState(thuDocThatAction, { message: "" });
  const [xoaPending, startXoa] = useTransition();
  const [thongBaoXoa, setThongBaoXoa] = useState<string | null>(null);
  const daCoKhoa = trangThai.nguon === "db" && !trangThai.loiGiaiMa && trangThai.nhaCungCap === nhaCungCap;
  const pending = dangLuu || dangKiem || dangThu || xoaPending;

  const goiForm = () => {
    const fd = new FormData();
    fd.set("nhaCungCap", nhaCungCap);
    fd.set("apiKey", apiKey);
    fd.set("model", model);
    fd.set("cheDo", cheDo);
    return fd;
  };
  const guiLuu = () =>
    startTransition(async () => {
      luuAction(goiForm());
    });
  const guiKiem = () =>
    startTransition(() => {
      kiemAction(goiForm());
    });
  const guiThu = () =>
    startTransition(() => {
      thuAction(goiForm());
    });
  const xoa = () => {
    if (!window.confirm(t("cauHinhAi.xacNhanXoa"))) return;
    startXoa(async () => {
      const r = await xoaCauHinhAiAction();
      setThongBaoXoa(r.message);
      if (r.success) router.refresh();
    });
  };

  const models = (kiem.models ?? []).filter((m) => (nhaCungCap === "gemini" ? /gemini/i.test(m) : /claude/i.test(m))).slice(0, 40);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guiLuu();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("cauHinhAi.nhaCungCap")}>
          <Select
            value={nhaCungCap}
            onChange={(e) => {
              setNhaCungCap(e.target.value === "claude" ? "claude" : "gemini");
              setModel("");
            }}
            disabled={pending}
          >
            <option value="gemini">{t("cauHinhAi.ncc_gemini")}</option>
            <option value="claude">{t("cauHinhAi.ncc_claude")}</option>
          </Select>
        </Field>
        <Field label={t("cauHinhAi.moHinh")} hint={t("cauHinhAi.moHinhGoiY", { macDinh: macDinh[nhaCungCap] })}>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={macDinh[nhaCungCap]} maxLength={100} disabled={pending} list="ds-mo-hinh-ai" />
          <datalist id="ds-mo-hinh-ai">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label={t("cauHinhAi.cheDoDoc")} hint={t("cauHinhAi.cheDoMoTa")}>
          <Select value={cheDo} onChange={(e) => setCheDo(e.target.value === "nhanh" ? "nhanh" : "ky")} disabled={pending}>
            <option value="ky">{t("cauHinhAi.cheDo_ky")}</option>
            <option value="nhanh">{t("cauHinhAi.cheDo_nhanh")}</option>
          </Select>
        </Field>
      </div>
      <Field label={t("cauHinhAi.khoaApi")}>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="pl-9 font-mono"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={daCoKhoa ? t("cauHinhAi.khoaApiGiuNguyen", { duoi: trangThai.duoiKhoa ?? "" }) : t("cauHinhAi.khoaApiMoi")}
            disabled={pending}
          />
        </div>
      </Field>

      {kiem.message && (
        <Notice tone={kiem.success ? "success" : kiem.models ? "warning" : "danger"}>
          {kiem.message}
          {models.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--text-secondary)]">{t("cauHinhAi.chonMoHinh")}</span>
              {models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                    m === (model || macDinh[nhaCungCap])
                      ? "border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-brand-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </Notice>
      )}
      {luu.message && <Notice tone={luu.success ? "success" : "danger"}>{luu.message}</Notice>}
      {dangThu ? (
        <Notice tone="info">{t("cauHinhAi.dangThuDoc")}</Notice>
      ) : thu.message ? (
        <Notice tone={thu.success ? "success" : "danger"}>{thu.message}</Notice>
      ) : null}
      {thongBaoXoa && <Notice tone="info">{thongBaoXoa}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={guiKiem} loading={dangKiem} disabled={pending} icon={<PlugZap className="size-4" />}>
          {dangKiem ? t("cauHinhAi.dangKiemTra") : t("cauHinhAi.nutKiemTra")}
        </Button>
        <Button type="button" onClick={guiThu} loading={dangThu} disabled={pending} icon={<FileSearch className="size-4" />} title={t("cauHinhAi.thuDocMoTa")}>
          {t("cauHinhAi.nutThuDoc")}
        </Button>
        <Button type="submit" variant="primary" loading={dangLuu} disabled={pending} icon={<Save className="size-4" />}>
          {t("cauHinhAi.nutLuu")}
        </Button>
        {trangThai.nguon === "db" || trangThai.loiGiaiMa ? (
          <Button type="button" variant="ghost" onClick={xoa} disabled={pending} icon={<Trash2 className="size-4" />}>
            {t("cauHinhAi.nutXoa")}
          </Button>
        ) : null}
        <span className="text-xs text-[var(--text-muted)]">{tTuDo(`cauHinhAi.ncc_${nhaCungCap}`)}</span>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{t("cauHinhAi.thuDocMoTa")}</p>
    </form>
  );
}
