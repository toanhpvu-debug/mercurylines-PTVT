import Link from "next/link";
import { ArrowLeft, Building2, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import {
  SupplierActiveToggle,
  SupplierDeleteButton,
  SupplierEditForm,
  SupplierForm,
} from "@/components/SupplierForm";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const user = await requireScopedUser();
  const { t } = await layT();
  const canManage = user.role === "ADMIN";
  const suppliers = await prisma.supplier.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { purchaseOrders: true } } },
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/purchasing"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <PageHeader
          title={t("purchasing.nhaCungCap")}
          subtitle={t("purchasing.moTaNcc")}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {canManage && (
          <Card>
            <CardHeader
              icon={<Plus className="size-4" />}
              title={t("purchasing.themNcc")}
            />
            <SupplierForm />
          </Card>
        )}
        <Card className={canManage ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader
            icon={<Building2 className="size-4" />}
            title={t("purchasing.danhSach", { n: suppliers.length })}
          />
          {suppliers.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-5" />}
              title={t("purchasing.chuaCoNcc")}
            />
          ) : (
            <TableWrap>
              <Table dense>
                <thead>
                  <tr>
                    <Th>{t("chung.ma")}</Th>
                    <Th>{t("chung.ten")}</Th>
                    <Th>{t("purchasing.cotLienHe")}</Th>
                    <Th>{t("purchasing.cotEmailDt")}</Th>
                    <Th align="right">{t("purchasing.cotSoDonPo")}</Th>
                    <Th>{t("chung.trangThai")}</Th>
                    {canManage && <Th>{t("chung.thaoTac")}</Th>}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <Tr
                      key={s.id}
                      className={cn(
                        "align-top transition-colors hover:bg-[var(--surface-sunken)]/50",
                        !s.isActive && "opacity-60"
                      )}
                    >
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                        {s.code}
                      </Td>
                      <Td className="font-medium">{s.name}</Td>
                      <Td>{s.contact}</Td>
                      <Td>
                        <p>{s.email}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {s.phone}
                        </p>
                      </Td>
                      <Td align="right">{s._count.purchaseOrders}</Td>
                      <Td>
                        {s.isActive ? (
                          <Badge tone="success" dot>
                            {t("labels.active_true")}
                          </Badge>
                        ) : (
                          <Badge tone="muted" dot>
                            {t("labels.active_false")}
                          </Badge>
                        )}
                      </Td>
                      {canManage && (
                        <Td>
                          <div className="flex flex-wrap items-start gap-2">
                            <SupplierEditForm
                              supplier={{
                                id: s.id,
                                code: s.code,
                                name: s.name,
                                contact: s.contact,
                                email: s.email,
                                phone: s.phone,
                                address: s.address,
                              }}
                            />
                            <SupplierActiveToggle
                              id={s.id}
                              isActive={s.isActive}
                            />
                            <SupplierDeleteButton id={s.id} />
                          </div>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
