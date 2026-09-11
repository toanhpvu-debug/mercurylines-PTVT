import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  History,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  danhTinhHieuLuc,
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { VAN_HANH_TAU } from "@/lib/roles";
import { duongDanTheKho, lamTron } from "@/lib/theKho";
import InventoryForm from "@/components/InventoryForm";
import PrintButton from "@/components/PrintButton";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Thẻ kho: toàn bộ nhập / xuất của MỘT mặt hàng tại MỘT kho, theo thứ tự thời
 * gian thực hiện, kèm tồn sau mỗi dòng. Đây là chỗ trả lời câu "món này nhập
 * lần cuối khi nào, ai xuất, xuất để làm gì" — bảng tồn kho chỉ cho con số
 * hiện tại, nhật ký chung thì trộn 600 mặt hàng vào một dòng thời gian.
 *
 * Địa chỉ: /inventory/stock-card?material=<id>&wh=<id>. Kho quyết định tàu,
 * nên phạm vi tàu được kiểm qua kho — người chỉ phụ trách một tàu gõ id kho
 * của tàu khác thì nhận 404 y như kho không tồn tại, không lộ là có.
 */
export default async function StockCardPage({
  searchParams,
}: {
  searchParams: Promise<{ material?: string; wh?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, ngay, ngayGio, so } = await layT();
  const scope = vesselScopeDayDu(user);
  const params = await searchParams;
  const materialId = Number(params.material);
  const warehouseId = Number(params.wh);
  if (
    !Number.isInteger(materialId) ||
    materialId <= 0 ||
    !Number.isInteger(warehouseId) ||
    warehouseId <= 0
  ) {
    notFound();
  }

  const [material, warehouse] = await Promise.all([
    prisma.material.findUnique({ where: { id: materialId } }),
    prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: { vessel: { select: { id: true, code: true, name: true } } },
    }),
  ]);
  if (!material || !warehouse || !warehouse.vessel) notFound();
  if (!trongPhamVi(scope, warehouse.vessel.id)) notFound();
  const vessel = warehouse.vessel;

  const [inventory, transactions] = await Promise.all([
    prisma.inventory.findUnique({
      where: { materialId_warehouseId: { materialId, warehouseId } },
    }),
    prisma.inventoryTransaction.findMany({
      where: { materialId, warehouseId },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    }),
  ]);

  // Cùng danh sách vai trò với createInventoryTransaction — xem inventory/page.tsx.
  const canTransact = danhTinhHieuLuc(user).some((d) =>
    VAN_HANH_TAU.includes(d.role)
  );

  // Tồn sau từng dòng phải cộng dồn ra ĐÚNG tồn hiện tại. Tồn hiện tại có thể
  // đã được đưa vào không qua giao dịch (nhập danh mục từ file kèm số tồn, gói
  // đồng bộ, dữ liệu mẫu), nên tồn đầu = tồn hiện tại − Σ nhập + Σ xuất; khác 0
  // thì hiện thành một dòng "tồn đầu" riêng thay vì để cột tồn sau lệch với con
  // số người ta thấy ở bảng tồn kho rồi tưởng thẻ kho sai.
  const tongNhap = lamTron(
    transactions.filter((x) => x.type === "IN").reduce((s, x) => s + x.quantity, 0)
  );
  const tongXuat = lamTron(
    transactions.filter((x) => x.type === "OUT").reduce((s, x) => s + x.quantity, 0)
  );
  const tonHienTai = inventory?.quantity ?? 0;
  const dangGiu = inventory?.reservedQuantity ?? 0;
  const tonDau = lamTron(tonHienTai - tongNhap + tongXuat);
  // Cộng dồn bằng reduce (không gán lại biến ngoài trong callback — quy tắc
  // react-hooks/immutability của bộ lint): tồn sau dòng i = tồn sau dòng i−1 ± SL.
  const dong = transactions.reduce<
    Array<(typeof transactions)[number] & { tonSau: number }>
  >((acc, x) => {
    const truoc = acc.length ? acc[acc.length - 1].tonSau : tonDau;
    acc.push({
      ...x,
      tonSau: lamTron(truoc + (x.type === "IN" ? x.quantity : -x.quantity)),
    });
    return acc;
  }, []);
  const coNhapBu = transactions.some(
    (x) => Math.abs(x.createdAt.getTime() - x.occurredAt.getTime()) > 60 * 1000
  );
  const lanNhapCuoi = [...transactions].reverse().find((x) => x.type === "IN");
  const lanXuatCuoi = [...transactions].reverse().find((x) => x.type === "OUT");
  const isLow = tonHienTai - dangGiu <= material.minStock;

  const moTaGanNhat = (x: (typeof transactions)[number] | undefined, dau: string) =>
    x
      ? `${dau}${so(x.quantity)} ${material.uom}${x.note ? ` · ${x.note}` : ""}`
      : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-baseline gap-2">
            <span className="font-display text-xl tracking-wide">{material.code}</span>
            <span>— {material.nameVn}</span>
          </span>
        }
        subtitle={`${t("inventory.theKho")} · ${vessel.code} ${vessel.name} · ${t("chung.kho")} ${warehouse.code} — ${warehouse.name} · ${t("chung.donVi")}: ${material.uom}`}
        action={
          <>
            <Link
              href={`/inventory?vessel=${vessel.id}`}
              className={buttonClass("secondary")}
            >
              <ArrowLeft className="size-4" />
              {t("inventory.quayLaiTonKho")}
            </Link>
            <PrintButton label={t("inventory.inTheKho")} />
          </>
        }
      />

      {/* Bốn con số người mở thẻ kho hỏi trước tiên — không in, vì đã có trong tờ thẻ. */}
      <div className="no-print grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<Boxes className="size-4" />}
          label={t("inventory.cotTon")}
          value={so(tonHienTai)}
          sub={
            dangGiu > 0
              ? `${material.uom} · ${t("inventory.dangGiu", { n: so(dangGiu) })}`
              : material.uom
          }
          tone={isLow ? "danger" : "success"}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label={t("inventory.cotToiThieu")}
          value={so(material.minStock)}
          sub={material.uom}
        />
        <Stat
          icon={<ArrowDownToLine className="size-4" />}
          label={t("inventory.cotNhapGanNhat")}
          value={lanNhapCuoi ? ngay(lanNhapCuoi.occurredAt) : t("inventory.chuaNhapXuat")}
          sub={moTaGanNhat(lanNhapCuoi, "+")}
          tone="success"
        />
        <Stat
          icon={<ArrowUpFromLine className="size-4" />}
          label={t("inventory.cotXuatGanNhat")}
          value={lanXuatCuoi ? ngay(lanXuatCuoi.occurredAt) : t("inventory.chuaNhapXuat")}
          sub={moTaGanNhat(lanXuatCuoi, "−")}
          tone="warning"
        />
      </div>

      {/* Tờ thẻ kho — tờ giấy trắng ở cả hai chế độ (xem .print-area trong globals.css). */}
      <div className="print-area surface rounded-xl border p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none print:border-0">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <p className="text-lg font-semibold uppercase tracking-wide text-[var(--text-primary)]">
              {t("inventory.theKho")}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {t("inventory.theKhoMoTa")}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[var(--text-secondary)]">{t("chung.tau")}</dt>
            <dd className="font-medium text-[var(--text-primary)]">
              <span className="font-display text-xs tracking-wide">{vessel.code}</span> — {vessel.name}
            </dd>
            <dt className="text-[var(--text-secondary)]">{t("chung.kho")}</dt>
            <dd className="font-medium text-[var(--text-primary)]">
              <span className="font-display text-xs tracking-wide">{warehouse.code}</span> — {warehouse.name}
            </dd>
            <dt className="text-[var(--text-secondary)]">{t("chung.vatTu")}</dt>
            <dd className="font-medium text-[var(--text-primary)]">
              <span className="font-display text-xs tracking-wide">{material.code}</span> — {material.nameVn}
            </dd>
            <dt className="text-[var(--text-secondary)]">{t("chung.donVi")}</dt>
            <dd className="text-[var(--text-primary)]">
              {material.uom} · {t("inventory.cotToiThieu")} {so(material.minStock)}
            </dd>
            <dt className="text-[var(--text-secondary)]">{t("inventory.inLuc")}</dt>
            <dd className="text-[var(--text-primary)]">{ngayGio(new Date())}</dd>
          </dl>
        </div>

        {transactions.length === 0 && tonDau === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title={t("inventory.chuaCoGiaoDichMatHang")}
          />
        ) : (
          // Cùng khuôn 5 chứng từ kia: Table mang min-w-max, thiếu khung cuộn thì
          // ghi chú dài đẩy tờ thẻ rộng hơn màn hình; khi in @media print đã
          // mở overflow lại nên giấy không bị cắt dòng.
          <div className="mt-3 overflow-x-auto">
          <Table dense>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>{t("inventory.cotThoiDiem")}</Th>
                <Th align="right">{t("inventory.cotNhap")}</Th>
                <Th align="right">{t("inventory.cotXuat")}</Th>
                <Th align="right">{t("inventory.cotTonSau")}</Th>
                <Th>{t("chung.ghiChu")}</Th>
                <Th>{t("chung.nguoiThucHien")}</Th>
                {coNhapBu && <Th>{t("inventory.cotGhiSoLuc")}</Th>}
              </tr>
            </thead>
            <tbody>
              {tonDau !== 0 && (
                <Tr>
                  <Td className="text-[var(--text-muted)]">—</Td>
                  <Td className="text-[var(--text-muted)]">—</Td>
                  <Td align="right" />
                  <Td align="right" />
                  <Td align="right" className="font-semibold">
                    {so(tonDau)}
                  </Td>
                  <Td colSpan={coNhapBu ? 3 : 2}>
                    <span className="text-xs text-[var(--text-muted)]">
                      {t("inventory.tonDauKhongGiaoDich")}
                    </span>
                  </Td>
                </Tr>
              )}
              {dong.map((x, i) => {
                const isIn = x.type === "IN";
                const nhapBu =
                  Math.abs(x.createdAt.getTime() - x.occurredAt.getTime()) > 60 * 1000;
                return (
                  <Tr key={x.id}>
                    <Td className="tabular text-[var(--text-muted)]">{i + 1}</Td>
                    <Td className="whitespace-nowrap font-medium">{ngayGio(x.occurredAt)}</Td>
                    <Td align="right" className="tabular font-semibold">
                      {isIn ? so(x.quantity) : ""}
                    </Td>
                    <Td align="right" className="tabular font-semibold">
                      {isIn ? "" : so(x.quantity)}
                    </Td>
                    <Td align="right" className="tabular">
                      {so(x.tonSau)}
                    </Td>
                    <Td>
                      <span className="text-[var(--text-secondary)]">{x.note ?? ""}</span>
                    </Td>
                    <Td className="whitespace-nowrap">{x.performedBy ?? "—"}</Td>
                    {coNhapBu && (
                      <Td className="whitespace-nowrap">
                        <span className="text-xs text-[var(--text-muted)]">
                          {nhapBu ? ngayGio(x.createdAt) : "—"}
                        </span>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border-subtle)] font-semibold">
                <Td colSpan={2} className="text-[var(--text-secondary)]">
                  {t("inventory.nGiaoDich", { n: transactions.length })}
                </Td>
                <Td align="right" className="tabular">
                  {so(tongNhap)}
                </Td>
                <Td align="right" className="tabular">
                  {so(tongXuat)}
                </Td>
                <Td align="right" className="tabular">
                  {so(tonHienTai)}
                </Td>
                <Td colSpan={coNhapBu ? 3 : 2}>
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    {t("inventory.tongNhap")} / {t("inventory.tongXuat")} / {t("inventory.cotTon")}
                  </span>
                </Td>
              </tr>
            </tfoot>
          </Table>
          </div>
        )}
      </div>

      {canTransact && (
        <div className="no-print">
          <Card>
            <CardHeader
              icon={<ArrowLeftRight className="size-4" />}
              title={t("inventory.ghiChoMatHangNay")}
              subtitle={t("inventory.ghiChoMatHangNayMoTa")}
            />
            <InventoryForm
              materials={[{ id: material.id, code: material.code, nameVn: material.nameVn }]}
              warehouses={[{ id: warehouse.id, code: warehouse.code, name: warehouse.name }]}
              returnTo={duongDanTheKho(materialId, warehouseId)}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
