import Link from "next/link";
import { ExternalLink, FileText, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import DocumentUploadForm from "@/components/DocumentUploadForm";
import DocumentDeleteButton from "@/components/DocumentDeleteButton";
import { layT } from "@/lib/i18n/server";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

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
  const canDelete = user.role === "ADMIN";
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader
              icon={<Upload className="size-4" />}
              title={t("inventory.taiBaoCaoLen")}
            />
            <DocumentUploadForm vessels={vessels} />
          </Card>
          <Card className="xl:col-span-2">
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
              <TableWrap>
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("inventory.cotNgayTai")}</Th>
                      <Th>{t("chung.tau")}</Th>
                      <Th>{t("inventory.loai")}</Th>
                      <Th>{t("inventory.cotKy")}</Th>
                      <Th>{t("inventory.cotTieuDeFile")}</Th>
                      <Th>{t("inventory.cotCo")}</Th>
                      <Th>{t("inventory.cotNguoiTai")}</Th>
                      <Th>SHA-256</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <Tr
                        key={doc.id}
                        className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                      >
                        <Td className="whitespace-nowrap">
                          {ngay(doc.createdAt)}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <Link
                            href={`/vessels/${doc.vessel.id}`}
                            className="font-display text-xs tracking-wide text-brand-700 hover:underline dark:text-brand-300"
                          >
                            {doc.vessel.code}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap">
                          <Badge tone="neutral">{doc.reportType}</Badge>
                        </Td>
                        <Td className="whitespace-nowrap">{doc.period}</Td>
                        <Td>
                          <p className="font-medium">{doc.title}</p>
                          {doc.title !== doc.fileName && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {doc.fileName}
                            </p>
                          )}
                          {doc.note && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {t("chung.ghiChu")}: {doc.note}
                            </p>
                          )}
                        </Td>
                        <Td className="tabular whitespace-nowrap">
                          {formatSize(doc.size)}
                        </Td>
                        <Td>{doc.uploadedBy.name}</Td>
                        <Td>
                          <span
                            className="font-mono text-xs text-[var(--text-muted)]"
                            title={doc.sha256}
                          >
                            {doc.sha256.slice(0, 12)}…
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/documents/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonClass("secondary", "sm")}
                            >
                              <ExternalLink className="size-4" />
                              {t("inventory.xemTai")}
                            </a>
                            {canDelete && (
                              <DocumentDeleteButton
                                id={doc.id}
                                fileName={doc.fileName}
                              />
                            )}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <Notice tone="info" className="mt-4">
              {t("inventory.luuYBatBien")}
            </Notice>
          </Card>
        </div>
      )}
    </div>
  );
}
