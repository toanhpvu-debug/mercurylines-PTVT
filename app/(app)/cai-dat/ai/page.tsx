import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { requireScopedUser } from "@/lib/auth";
import { trangThaiCauHinhAi } from "@/lib/cauHinhAi";
import { MODEL_MAC_DINH, TEN_NHA_CUNG_CAP } from "@/lib/docPhieuBangAi";
import CauHinhAiForm from "@/components/CauHinhAiForm";
import { layT } from "@/lib/i18n/server";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function ngayGio(d: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function CauHinhAiPage() {
  const user = await requireScopedUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  const { t, tTuDo } = await layT();
  const tt = await trangThaiCauHinhAi();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("cauHinhAi.tieuDe")}
        subtitle={t("cauHinhAi.moTa")}
        action={
          <Link href="/materials/phieu-giao" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300">
            {t("cauHinhAi.lienKetPhieuGiao")}
            <ArrowRight className="size-4" />
          </Link>
        }
      />

      <Card>
        <CardHeader
          title={t("cauHinhAi.trangThaiTieuDe")}
          icon={<Sparkles className="size-4" />}
          action={<Badge tone={tt.bat ? "success" : "neutral"} dot>{tt.bat ? t("cauHinhAi.dangBat") : t("cauHinhAi.dangTat")}</Badge>}
        />
        {tt.bat && (
          <p className="text-sm text-[var(--text-secondary)]">
            {tt.nhaCungCap ? TEN_NHA_CUNG_CAP[tt.nhaCungCap] : ""} · <span className="font-mono">{tt.model}</span> ·{" "}
            <span className="font-mono">{tt.duoiKhoa}</span> · {tTuDo(`cauHinhAi.cheDo_${tt.cheDo}`)} ·{" "}
            {tt.nguon === "db" ? t("cauHinhAi.nguonDb") : t("cauHinhAi.nguonEnv")}
            {tt.nguon === "db" && tt.updatedBy && tt.updatedAt ? (
              <>
                {" · "}
                {t("cauHinhAi.capNhatBoi", { nguoi: tt.updatedBy, luc: ngayGio(tt.updatedAt) })}
              </>
            ) : null}
          </p>
        )}
        {tt.loiGiaiMa && (
          <Notice tone="danger" className="mt-3">
            {t("cauHinhAi.loiGiaiMa")}
          </Notice>
        )}
        {tt.nguon === "db" && tt.coEnv && (
          <Notice tone="info" className="mt-3">
            {t("cauHinhAi.envBiChe")}
          </Notice>
        )}
      </Card>

      <Card>
        <CauHinhAiForm
          trangThai={{
            bat: tt.bat,
            nguon: tt.nguon,
            nhaCungCap: tt.nhaCungCap,
            model: tt.model,
            cheDo: tt.cheDo,
            duoiKhoa: tt.duoiKhoa,
            loiGiaiMa: tt.loiGiaiMa,
            coEnv: tt.coEnv,
          }}
          macDinh={MODEL_MAC_DINH}
        />
      </Card>

      <Card>
        <CardHeader title={t("cauHinhAi.huongDanTieuDe")} icon={<ShieldCheck className="size-4" />} />
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>
            <b className="text-[var(--text-primary)]">{t("cauHinhAi.ncc_gemini")}:</b> {t("cauHinhAi.huongDanGemini")}{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300">
              aistudio.google.com/apikey <ExternalLink className="size-3.5" />
            </a>
          </li>
          <li>
            <b className="text-[var(--text-primary)]">{t("cauHinhAi.ncc_claude")}:</b> {t("cauHinhAi.huongDanClaude")}{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300">
              console.anthropic.com <ExternalLink className="size-3.5" />
            </a>
          </li>
          <li>
            <b className="text-[var(--text-primary)]">{t("cauHinhAi.ncc_deepseek")}:</b> {t("cauHinhAi.huongDanDeepseek")}{" "}
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300">
              platform.deepseek.com <ExternalLink className="size-3.5" />
            </a>
          </li>
          <li>{t("cauHinhAi.luuYRiengTu")}</li>
          <li>{t("cauHinhAi.luuYChiPhi")}</li>
        </ul>
      </Card>
    </div>
  );
}
