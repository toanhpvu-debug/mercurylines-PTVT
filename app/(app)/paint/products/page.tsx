import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Droplets, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { PAINT_TYPES, PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import {
  PaintProductAddForm,
  PaintProductRowActions,
} from "@/components/PaintProductManager";
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
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL = PAINT_TYPE_LABEL;

export default async function PaintProductsPage() {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  // Nhãn loại sơn lấy theo ngôn ngữ; mã lạ (dữ liệu cũ) thì hiện nguyên mã.
  const tenLoaiSon = (ma: string) =>
    ma in TYPE_LABEL ? tTuDo(`paint.loaiSon_${ma}`) : ma;
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/paint");
  }
  const products = await prisma.paintProduct.findMany({
    orderBy: [{ paintType: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { schemeLayers: true, jobLines: true } },
      stocks: { select: { quantity: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/paint"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("paint.quayLaiQuanLySon")}
        </Link>
        <PageHeader
          title={t("paint.danhMucSon")}
          subtitle={t("paint.danhMucMoTa")}
          action={
            <>
              <PaintProductAddForm types={PAINT_TYPES} />
              <Link href="/paint/import" className={buttonClass("secondary")}>
                <Upload className="size-4" />
                {t("paint.nutNhapTuFile")}
              </Link>
            </>
          }
        />
      </div>

      <Card>
        <CardHeader
          icon={<Droplets className="size-4" />}
          title={t("paint.danhSachN", { n: products.length })}
        />
        {products.length === 0 ? (
          <EmptyState
            icon={<Droplets className="size-5" />}
            title={t("paint.chuaCoLoaiSon")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("chung.ma")}</Th>
                  <Th>{t("paint.tenSon")}</Th>
                  <Th>{t("paint.hang")}</Th>
                  <Th>{t("paint.cotLoai")}</Th>
                  <Th>{t("paint.cotMau")}</Th>
                  <Th align="right">{t("paint.cotDoPhu")}</Th>
                  <Th align="right">DFT (µm)</Th>
                  <Th align="right">{t("paint.cotTongTon")}</Th>
                  <Th>{t("chung.thaoTac")}</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const total = p.stocks.reduce((s, x) => s + x.quantity, 0);
                  return (
                    <Tr
                      key={p.id}
                      className={cn(
                        "transition-colors hover:bg-[var(--surface-sunken)]/50",
                        !p.isActive && "opacity-60"
                      )}
                    >
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                        {p.code}
                      </Td>
                      <Td>
                        {p.name}
                        {!p.isActive && (
                          <Badge tone="muted" className="ml-2">
                            {t("labels.active_false")}
                          </Badge>
                        )}
                      </Td>
                      <Td>{p.maker ?? "—"}</Td>
                      <Td>
                        <Badge tone="neutral">{tenLoaiSon(p.paintType)}</Badge>
                      </Td>
                      <Td>
                        {[p.colorName, p.colorCode].filter(Boolean).join(" · ") ||
                          "—"}
                      </Td>
                      <Td align="right">{p.coverage || "—"}</Td>
                      <Td align="right">{p.dftPerCoat || "—"}</Td>
                      <Td align="right">
                        {total ? `${total} ${p.uom}` : "—"}
                      </Td>
                      <Td>
                        <PaintProductRowActions
                          product={{
                            id: p.id,
                            code: p.code,
                            name: p.name,
                            maker: p.maker,
                            paintType: p.paintType,
                            colorCode: p.colorCode,
                            colorName: p.colorName,
                            uom: p.uom,
                            packSize: p.packSize,
                            coverage: p.coverage,
                            dftPerCoat: p.dftPerCoat,
                            thinner: p.thinner,
                            notes: p.notes,
                            isActive: p.isActive,
                          }}
                          types={PAINT_TYPES}
                          canDelete={user.role === "ADMIN"}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
