import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  BookOpen,
  Droplets,
  FlaskConical,
  Fuel,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  danhTinhHieuLuc,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { VAN_HANH_HOA_CHAT, nhomNhienLieuChoPhep } from "@/lib/roles";
import {
  CONSUMABLE_CATEGORIES,
  NGUONG_CANH_BAO_HAN_DUNG,
  soNgayToi,
} from "@/lib/consumables";
import { layT } from "@/lib/i18n/server";
import {
  Badge,
  Card,
  CardHeader,
  Notice,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/** Biểu tượng nhóm — thay cho emoji `icon` trong lib/consumables.ts. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  FUEL: Fuel,
  LUBE: Droplets,
  CHEMICAL: FlaskConical,
};

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

export default async function ConsumablesPage() {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  // Nút này dẫn sang TRANG /consumables/products nên phải khớp ĐÚNG cổng của
  // trang đó — cả nhóm vai trò (VAN_HANH_HOA_CHAT) lẫn cách tính danh tính
  // (danhTinhHieuLuc). Liệt kê tay ở đây bỏ sót MÁY TRƯỞNG và đại phó nên họ
  // không thấy lối vào danh mục dù gõ URL thì server vẫn cho vào; ngược lại
  // nếu chỗ này tính vai trò mượn mà trang đích đọc user.role thô thì người
  // nhận ủy quyền thấy nút, bấm vào bị đá ngược về đây, không một dòng báo.
  // Đổi một phía là tạo lại đúng lỗi đó ở chiều kia, nên hai phía sửa cùng lúc.
  const canManageCatalog = danhTinhHieuLuc(user).some((d) =>
    VAN_HANH_HOA_CHAT.includes(d.role)
  );

  const [vessels, products, stocks, receipts] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
    }),
    prisma.consumableProduct.findMany({ where: { isActive: true } }),
    prisma.consumableStock.findMany({ include: { product: true } }),
    prisma.consumableReceipt.findMany({
      include: { product: true },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  const idTau = new Set(vessels.map((v) => v.id));
  const stocksTrongPhamVi = stocks.filter((s) => idTau.has(s.vesselId));
  const receiptsTrongPhamVi = receipts.filter((r) => idTau.has(r.vesselId));

  const duoiDinhMuc = stocksTrongPhamVi.filter(
    (s) => s.minQty > 0 && s.quantity < s.minQty
  );
  const sapHetHan = receiptsTrongPhamVi.filter((r) => {
    const con = soNgayToi(r.expiryDate);
    return con !== null && con <= NGUONG_CANH_BAO_HAN_DUNG;
  });

  // Lô dầu vượt giới hạn ECA — số này cho biết còn bao nhiêu lô không dùng được
  // trong vùng kiểm soát khí thải.
  const loVuotEca = receiptsTrongPhamVi.filter(
    (r) => r.sulphur !== null && r.sulphur > 0.1
  );

  const theoTau = vessels.map((v) => {
    const st = stocksTrongPhamVi.filter((s) => s.vesselId === v.id);
    return {
      v,
      soMatHang: st.length,
      thieu: st.filter((s) => s.minQty > 0 && s.quantity < s.minQty).length,
      soPhieu: receiptsTrongPhamVi.filter((r) => r.vesselId === v.id).length,
      ganNhat: receiptsTrongPhamVi.find((r) => r.vesselId === v.id)?.receivedAt,
      nhomGhiDuoc: nhomNhienLieuChoPhep(user, v.id).length,
    };
  });

  const soTheoNhom = CONSUMABLE_CATEGORIES.map((c) => ({
    ...c,
    soMatHang: products.filter((p) => p.category === c.value).length,
  }));

  const soCanChuY = duoiDinhMuc.length + sapHetHan.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("consumables.tieuDe")}
        subtitle={t("consumables.moTa")}
        action={
          canManageCatalog && (
            <Link
              href="/consumables/products"
              className={buttonClass("primary")}
            >
              <BookOpen className="size-4" />
              {t("consumables.nutDanhMuc", { n: products.length })}
            </Link>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {soTheoNhom.map((c) => {
          const Icon = CATEGORY_ICON[c.value];
          return (
            <Stat
              key={c.value}
              icon={Icon && <Icon className="size-4" />}
              label={tTuDo(`consumables.nhom_${c.value}`)}
              value={c.soMatHang}
              sub={t("consumables.matHangTrongDanhMuc")}
            />
          );
        })}
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label={t("consumables.canChuY")}
          value={soCanChuY}
          tone={soCanChuY > 0 ? "danger" : "success"}
          sub={t("consumables.tomTatCanChuY", {
            duoi: duoiDinhMuc.length,
            han: sapHetHan.length,
          })}
        />
      </div>

      {loVuotEca.length > 0 && (
        <Notice tone="warning">
          <b>{t("consumables.ecaDam", { n: loVuotEca.length })}</b>{" "}
          {t("consumables.ecaSau")}
        </Notice>
      )}

      <Card>
        <CardHeader
          icon={<Anchor className="size-4" />}
          title={t("consumables.theoTau")}
        />
        <TableWrap>
          <Table dense>
            <thead>
              <tr>
                <Th>{t("consumables.cotMaTau")}</Th>
                <Th>{t("consumables.cotTenTau")}</Th>
                <Th align="right">{t("consumables.cotMatHangCoTon")}</Th>
                <Th align="right">{t("consumables.cotDuoiDinhMuc")}</Th>
                <Th align="right">{t("consumables.cotPhieuNhan")}</Th>
                <Th>{t("consumables.cotNhanGanNhat")}</Th>
                <Th>{t("consumables.cotQuyenCuaBan")}</Th>
              </tr>
            </thead>
            <tbody>
              {theoTau.map((dong) => (
                <Tr
                  key={dong.v.id}
                  className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                >
                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/consumables/${dong.v.id}`}
                      className={`font-display text-xs tracking-wide ${LINK}`}
                    >
                      {dong.v.code}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/consumables/${dong.v.id}`}
                      className={`font-medium ${LINK}`}
                    >
                      {dong.v.name}
                    </Link>
                  </Td>
                  <Td align="right">{dong.soMatHang}</Td>
                  <Td align="right">
                    {dong.thieu > 0 ? (
                      <Badge tone="danger">{dong.thieu}</Badge>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </Td>
                  <Td align="right">{dong.soPhieu}</Td>
                  <Td className="whitespace-nowrap">
                    <span className="text-[var(--text-secondary)]">
                      {dong.ganNhat ? ngay(dong.ganNhat) : "—"}
                    </span>
                  </Td>
                  <Td>
                    {dong.nhomGhiDuoc > 0 ? (
                      <Badge tone="success">
                        {t("consumables.ghiDuocNNhom", { n: dong.nhomGhiDuoc })}
                      </Badge>
                    ) : (
                      <Badge tone="muted">{t("consumables.chiXem")}</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        {t("consumables.chuThichQuyenGhi")}
      </p>
    </div>
  );
}
