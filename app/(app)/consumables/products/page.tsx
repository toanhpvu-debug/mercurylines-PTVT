import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Droplets,
  FlaskConical,
  Fuel,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { danhTinhHieuLuc, requireScopedUser } from "@/lib/auth";
import { QUAN_DANH_MUC_NHIEN_LIEU, VAN_HANH_HOA_CHAT } from "@/lib/roles";
import { CONSUMABLE_CATEGORIES } from "@/lib/consumables";
import {
  ConsumableProductActions,
  ConsumableProductForm,
} from "@/components/ConsumableProductManager";
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
  TrNhom,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/** Biểu tượng nhóm — thay cho emoji `icon` trong lib/consumables.ts. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  FUEL: Fuel,
  LUBE: Droplets,
  CHEMICAL: FlaskConical,
};

export default async function ConsumableProductsPage() {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  // Vào xem và THÊM mới thì người quản nhóm trên tàu cũng được; sửa/xóa một mặt
  // hàng đang dùng chung thì server chặn riêng ở từng action.
  //
  // Xét cả danh tính MƯỢN qua ủy quyền chứ không chỉ user.role thô, vì hai lý
  // do: các server action của trang này đi qua requireActiveRole nên vốn đã
  // nhận vai trò mượn — đọc user.role thô ở cổng là người được máy trưởng ủy
  // quyền không vào nổi cái trang chứa đúng những action họ gọi được; và nút
  // dẫn tới đây ở /consumables cũng tính theo danhTinhHieuLuc, lệch nhau thì họ
  // thấy nút, bấm vào bị redirect ngược về chỗ vừa bấm, bấm mãi một vòng câm.
  const danhTinh = danhTinhHieuLuc(user);
  if (!danhTinh.some((d) => VAN_HANH_HOA_CHAT.includes(d.role))) {
    redirect("/consumables");
  }
  // Máy trưởng sửa/ngừng/xóa được mặt hàng như quản trị — danh mục dầu và hóa
  // chất là nghiệp vụ buồng máy. Cũng tính vai trò mượn, để khớp requireFleet()
  // ở consumable-actions: nếu không, người nhận ủy quyền của máy trưởng sửa
  // được thật mà giao diện lại giấu nút và báo họ chỉ thêm mới được.
  const laVanPhong = danhTinh.some((d) =>
    QUAN_DANH_MUC_NHIEN_LIEU.includes(d.role)
  );

  const products = await prisma.consumableProduct.findMany({
    orderBy: [{ category: "asc" }, { grade: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { stocks: true, receipts: true, transactions: true } },
    },
  });

  // Một bảng chung, mỗi nhóm một dòng tiêu đề — cột của ba nhóm giống hệt nhau.
  const soCot = laVanPhong ? 8 : 7;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/consumables"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("consumables.quayLaiTieuHao")}
        </Link>
        <PageHeader
          title={t("consumables.tieuDeDanhMuc")}
          subtitle={t("consumables.moTaDanhMuc")}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Plus className="size-4" />}
            title={t("consumables.themMatHang")}
          />
          <ConsumableProductForm />
          {!laVanPhong && (
            <Notice tone="info" className="mt-4 text-xs">
              {t("consumables.luuYQuyenSua")}
            </Notice>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            icon={<BookOpen className="size-4" />}
            title={t("consumables.danhSachN", { n: products.length })}
          />
          {products.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title={t("consumables.chuaCoMatHangNao")}
            />
          ) : (
            <TableWrap>
              <Table dense>
                <thead>
                  <tr>
                    <Th>{t("chung.ma")}</Th>
                    <Th>{t("chung.ten")}</Th>
                    <Th>{t("consumables.chungLoai")}</Th>
                    <Th>{t("consumables.cotHang")}</Th>
                    <Th>{t("chung.donVi")}</Th>
                    <Th>{t("consumables.cotDacTinh")}</Th>
                    <Th>{t("chung.trangThai")}</Th>
                    {laVanPhong && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {CONSUMABLE_CATEGORIES.map((c) => {
                    const rows = products.filter((p) => p.category === c.value);
                    if (rows.length === 0) return null;
                    const Icon = CATEGORY_ICON[c.value];
                    return (
                      <React.Fragment key={c.value}>
                        <TrNhom colSpan={soCot}>
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {Icon && (
                              <Icon className="size-4 text-[var(--text-muted)]" />
                            )}
                            {tTuDo(`consumables.nhom_${c.value}`)}
                            <span className="text-xs font-normal text-[var(--text-muted)]">
                              ({rows.length})
                            </span>
                          </span>
                        </TrNhom>
                        {rows.map((p) => (
                          <Tr
                            key={p.id}
                            className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                          >
                            <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                              {p.code}
                            </Td>
                            <Td>
                              {p.name}
                              {p.nameEn && (
                                <span className="block text-xs text-[var(--text-muted)]">
                                  {p.nameEn}
                                </span>
                              )}
                            </Td>
                            <Td>
                              <span className="text-[var(--text-secondary)]">
                                {tTuDo(`consumables.loai_${p.grade}`)}
                              </span>
                            </Td>
                            <Td>
                              <span className="text-[var(--text-secondary)]">
                                {p.maker ?? "—"}
                              </span>
                            </Td>
                            <Td>
                              <span className="text-xs text-[var(--text-secondary)]">
                                {p.uom}
                              </span>
                            </Td>
                            <Td>
                              <span className="tabular text-xs text-[var(--text-secondary)]">
                                {p.sulphurMax !== null && <>S ≤ {p.sulphurMax}% </>}
                                {p.viscosity !== null && <>· {p.viscosity} cSt </>}
                                {p.bnValue !== null && <>· TBN {p.bnValue} </>}
                                {p.shelfLifeMonths !== null && (
                                  <>
                                    ·{" "}
                                    {t("consumables.hdNThang", {
                                      n: p.shelfLifeMonths,
                                    })}{" "}
                                  </>
                                )}
                                {p.hazardClass && <>· {p.hazardClass}</>}
                                {p.sulphurMax === null &&
                                  p.viscosity === null &&
                                  p.bnValue === null &&
                                  p.shelfLifeMonths === null &&
                                  !p.hazardClass &&
                                  "—"}
                              </span>
                            </Td>
                            <Td>
                              <Badge tone={p.isActive ? "success" : "muted"} dot>
                                {tTuDo(`labels.active_${p.isActive}`)}
                              </Badge>
                              <span className="mt-1 block text-xs whitespace-nowrap text-[var(--text-muted)]">
                                {t("consumables.nPhieuNGiaoDich", {
                                  p: p._count.receipts,
                                  g: p._count.transactions,
                                })}
                              </span>
                            </Td>
                            {laVanPhong && (
                              <Td>
                                <ConsumableProductActions
                                  row={{
                                    id: p.id,
                                    code: p.code,
                                    name: p.name,
                                    nameEn: p.nameEn,
                                    category: p.category,
                                    grade: p.grade,
                                    maker: p.maker,
                                    uom: p.uom,
                                    sulphurMax: p.sulphurMax,
                                    viscosity: p.viscosity,
                                    density: p.density,
                                    bnValue: p.bnValue,
                                    hazardClass: p.hazardClass,
                                    shelfLifeMonths: p.shelfLifeMonths,
                                    isActive: p.isActive,
                                  }}
                                />
                              </Td>
                            )}
                          </Tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {t("consumables.chuThichVongDoi")}
      </p>
    </div>
  );
}
