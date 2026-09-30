import { FileText, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import DocumentUploadForm from "@/components/DocumentUploadForm";
import BangHoSo from "@/components/BangHoSo";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import { Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function DocumentsPage() {
  const user = await requireScopedUser();
  const { t, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  // Gỡ hồ sơ: chỉ quản trị ở bản cài văn phòng (goHoSo kiểm lại lần nữa).
  const goDuoc = user.role === "ADMIN" && !(await laBanTau());
  const [vessels, documents] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.reportDocument.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      include: {
        vessel: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("inventory.taiLieuTieuDe")}
        subtitle={t("inventory.taiLieuMoTa")}
      />

      {scope.unassigned ? (
        <Notice tone="warning">{t("inventory.taiLieuChuaGanTau")}</Notice>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card>
            <CardHeader
              icon={<Upload className="size-4" />}
              title={t("inventory.taiBaoCaoLen")}
            />
            <DocumentUploadForm vessels={vessels} />
          </Card>
          <Card className="min-w-0">
            <CardHeader
              icon={<FileText className="size-4" />}
              title={t("inventory.hoSoDaLuu", { n: documents.length })}
            />
            {documents.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-5" />}
                title={t("inventory.chuaCoBaoCao")}
              />
            ) : (
              <BangHoSo
                goDuoc={goDuoc}
                dong={documents.map((doc) => ({
                  id: doc.id,
                  ngay: ngay(doc.createdAt),
                  vesselId: doc.vessel.id,
                  vesselCode: doc.vessel.code,
                  reportType: doc.reportType,
                  period: doc.period,
                  title: doc.title,
                  fileName: doc.fileName,
                  note: doc.note,
                  co: formatSize(doc.size),
                  sha256: doc.sha256,
                  nguoiTai: doc.uploadedBy.name,
                }))}
              />
            )}
            <Notice tone="info" className="mt-4">
              {t("inventory.luuYBatBien")}
              {goDuoc && <> {t("inventory.goiYGoHoSo")}</>}
            </Notice>
          </Card>
        </div>
      )}
    </div>
  );
}
