import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Boxes,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Pencil,
  Printer,
  Trash2,
  Warehouse,
  Cog,
  LifeBuoy,
  Package,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  canManageVesselCatalog,
  danhTinhHieuLuc,
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { laBanTau } from "@/lib/banCai";
import { tenKhoNgan } from "@/lib/khoTau";
import { duongDanTheKho } from "@/lib/theKho";
import BangKhoTau from "@/components/BangKhoTau";
import NhapXuatHangLoat from "@/components/NhapXuatHangLoat";
import NutThuGonNhom from "@/components/NutThuGonNhom";
import { DEPARTMENTS, sortWithinDepartment } from "@/lib/departments";
import { nhomCuaVatTu } from "@/lib/phanNhomBanChat";
import { VAN_HANH_TAU } from "@/lib/roles";
import VesselEditForm from "@/components/VesselEditForm";
import VesselDeleteButton from "@/components/VesselDeleteButton";
import VesselSwitcher from "@/components/VesselSwitcher";
import KhungBang from "@/components/KhungBang";
import PhanTrang from "@/components/PhanTrang";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TONE_YEU_CAU,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  TrNhom,
  buttonClass,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const LINK = "text-brand-700 hover:underline dark:text-brand-300";
/** Liên kết không tô màu sẵn (tên mặt hàng, kho) — cả bảng xanh lè thì khó đọc; rê chuột mới hiện. */
const LINK_AN = "hover:text-brand-700 hover:underline dark:hover:text-brand-300";
/** Biểu tượng bộ phận — cùng bảng với trang Tồn kho / Danh mục. */
const DEPT_ICON: Record<string, LucideIcon> = {
  DECK: Anchor,
  ENGINE: Cog,
  ELEC: Zap,
  SERVICE: UtensilsCrossed,
  SAFETY: LifeBuoy,
  OTHER: Package,
};
/** Ô tick của dòng tồn (nhập / xuất hàng loạt — components/NhapXuatHangLoat.tsx). */
const O_TICK = "size-4 accent-brand-600 align-middle";

/** Tiêu đề khung gập: cùng một dáng với trang Tồn kho / Sơn. */
const SUMMARY =
  "flex cursor-pointer select-none list-none flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] [&::-webkit-details-marker]:hidden";

/**
 * Một mục của hồ sơ tàu, GẬP được: dòng tiêu đề (mũi tên · biểu tượng · tên · ghi chú ngắn · nút bên
 * phải) luôn hiện, nội dung mở khi bấm. Mục phụ (báo cáo, sửa / xóa tàu, kho) gập sẵn cho trang gọn;
 * Tồn kho và Yêu cầu mở sẵn. Nút trong dòng tiêu đề vẫn bấm được mà không gập / mở mục.
 */
function MucGap({
  icon,
  tieuDe,
  ghiChu,
  nut,
  mo = false,
  className,
  children,
}: {
  icon: ReactNode;
  tieuDe: ReactNode;
  ghiChu?: ReactNode;
  nut?: ReactNode;
  mo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card padded={false} className={className}>
      <details open={mo} className="group">
        <summary className={SUMMARY}>
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
          />
          {icon}
          {tieuDe}
          {ghiChu && <span className="text-xs font-normal text-[var(--text-muted)]">{ghiChu}</span>}
          {nut && <span className="ml-auto">{nut}</span>}
        </summary>
        <div className="border-t border-[var(--border-subtle)] px-4 py-4">{children}</div>
      </details>
    </Card>
  );
}

// Chỉ giữ TONE ở đây; nhãn trạng thái lấy từ từ điển (labels.vesselStatus_* cho
// ACTIVE/INACTIVE, vessels.trangThaiBaoDuong cho MAINTENANCE).
const TONE_TRANG_THAI: Record<string, Tone> = {
  ACTIVE: "success",
  MAINTENANCE: "warning",
  INACTIVE: "muted",
};

/** Mức ưu tiên → tone nhãn — cùng bảng với trang Yêu cầu vật tư. */
const TONE_UU_TIEN: Record<string, Tone> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "muted",
};

export default async function VesselDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManage = user.role === "ADMIN";

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  if (!trongPhamVi(scope, id)) {
    notFound();
  }
  const vessel = await prisma.vessel.findUnique({
    where: { id },
    include: {
      warehouses: { orderBy: { code: "asc" } },
    },
  });
  if (!vessel) {
    notFound();
  }
  // Bảng tồn kho của tàu NHÓM THEO BỘ PHẬN như Danh mục và trang Tồn kho: Boong → Máy → Điện →
  // Phục vụ → An toàn → Khác, trong bộ phận vật tư trước, phụ tùng theo thiết bị, rồi theo tên — cùng
  // hàm nhomCuaVatTu / sortWithinDepartment nên một mặt hàng đứng cùng bộ phận ở cả ba trang. Mỗi bộ
  // phận một trang 40 dòng, chuyển trang riêng (?trang_DECK=2…) ở dòng tiêu đề và cuối bộ phận.
  const MOI_TRANG_BO_PHAN = 40;
  const sp = await searchParams;
  const [tonTatCa, requests, documents, demTonKho, demGiaoDichKho, banTau] = await Promise.all([
    prisma.inventory.findMany({
      where: { vesselId: id },
      orderBy: [{ material: { code: "asc" } }, { warehouseId: "asc" }],
      select: {
        id: true,
        materialId: true,
        warehouseId: true,
        quantity: true,
        reservedQuantity: true,
        warehouse: { select: { code: true, name: true } },
        material: {
          select: {
            code: true,
            nameVn: true,
            nameEn: true,
            impa: true,
            uom: true,
            minStock: true,
            materialType: true,
            equipment: true,
            department: true,
            nhomQuanLy: true,
            responsibleRank: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
    prisma.materialRequest.findMany({
      where: { vesselId: id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
    }),
    prisma.reportDocument.findMany({
      where: { vesselId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        uploadedBy: { select: { name: true } },
      },
    }),
    // Mục "Kho trên tàu": số mặt hàng / dòng nhập xuất của từng kho (kho còn hàng thì chưa xóa được).
    prisma.inventory.groupBy({ by: ["warehouseId"], where: { vesselId: id }, _count: { _all: true } }),
    prisma.inventoryTransaction.groupBy({ by: ["warehouseId"], where: { vesselId: id }, _count: { _all: true } }),
    laBanTau(),
  ]);
  const soTheoKho = (dem: { warehouseId: number; _count: { _all: number } }[]) => new Map(dem.map((d) => [d.warehouseId, d._count._all]));
  const matHangTheoKho = soTheoKho(demTonKho);
  const giaoDichTheoKho = soTheoKho(demGiaoDichKho);
  const tongTonKho = tonTatCa.length;
  type DongTon = (typeof tonTatCa)[number];
  const theoBoPhan = new Map<string, DongTon[]>();
  for (const r of tonTatCa) {
    const khoa = nhomCuaVatTu({
      nameVn: r.material.nameVn,
      nameEn: r.material.nameEn,
      impa: r.material.impa,
      materialType: r.material.materialType,
      code: r.material.code,
      department: r.material.department,
      categoryName: r.material.category?.name,
      equipment: r.material.equipment,
      nhomQuanLy: r.material.nhomQuanLy,
      responsibleRank: r.material.responsibleRank,
      nguonPhu: r.warehouse.code,
    }).nhom;
    const ds = theoBoPhan.get(khoa);
    if (ds) ds.push(r);
    else theoBoPhan.set(khoa, [r]);
  }
  const boPhan = DEPARTMENTS.map((d) => {
    const sapXep = sortWithinDepartment(theoBoPhan.get(d.key) ?? [], (r) => ({
      materialType: r.material.materialType,
      equipment: r.material.equipment,
      categoryName: r.material.category?.name ?? null,
      nameVn: r.material.nameVn,
    }));
    const soTrang = Math.max(1, Math.ceil(sapXep.length / MOI_TRANG_BO_PHAN));
    // Xin quá số trang (tồn kho vừa ít đi, đường dẫn cũ) → trang cuối.
    const trang = Math.min(Math.max(1, Math.floor(Number(sp[`trang_${d.key}`])) || 1), soTrang);
    const tu = (trang - 1) * MOI_TRANG_BO_PHAN;
    return { key: d.key, tong: sapXep.length, trang, soTrang, tu, dong: sapXep.slice(tu, tu + MOI_TRANG_BO_PHAN) };
  }).filter((d) => d.tong > 0);
  /** Trang n của một bộ phận: giữ trang đang xem của bộ phận khác, cuộn về đúng bộ phận đó. */
  const hrefBoPhan = (key: string, n: number) => {
    const p = new URLSearchParams();
    for (const d of boPhan) if (d.key !== key && d.trang > 1) p.set(`trang_${d.key}`, String(d.trang));
    if (n > 1) p.set(`trang_${key}`, String(n));
    const qs = p.toString();
    return `/vessels/${id}${qs ? `?${qs}` : ""}#ton-${key}`;
  };
  const nhanTrang = (d: (typeof boPhan)[number]) => ({
    dau: t("materials.trangDau"),
    truoc: t("materials.trangTruoc"),
    sau: t("materials.trangSau"),
    cuoi: t("materials.trangCuoi"),
    trang: t("materials.trangN", { n: d.trang, tong: d.soTrang }),
  });
  // Ô tick nhập / xuất hàng loạt: chỉ người ghi được phiếu nhập / xuất (cùng danh sách với
  // createInventoryTransaction, kể cả ủy quyền) — người khác không thấy ô thừa.
  const nhapXuatDuoc = danhTinhHieuLuc(user).some((d) => VAN_HANH_TAU.includes(d.role));
  const bangTon = `tau-${vessel.id}`;
  // Số cột của bảng tồn kho — dòng tiêu đề bộ phận và dòng chuyển trang trải hết chiều ngang.
  const soCot = nhapXuatDuoc ? 8 : 7;
  const toneTT = TONE_TRANG_THAI[vessel.status] ?? "neutral";
  const nhanTT =
    vessel.status === "MAINTENANCE"
      ? t("vessels.trangThaiBaoDuong")
      : vessel.status in TONE_TRANG_THAI
        ? tTuDo(`labels.vesselStatus_${vessel.status}`)
        : vessel.status;
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/vessels"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("vessels.quayLaiDoiTau")}
        </Link>
        <PageHeader
          title={
            <>
              <span className="font-display tracking-wide">{vessel.code}</span>
              {" — "}
              {vessel.name}
            </>
          }
          subtitle={
            <>
              IMO:{" "}
              <span className="font-display text-xs tracking-wide">
                {vessel.imo || "—"}
              </span>{" "}
              · {t("vessels.nhanCo")}: {vessel.flag || "—"} ·{" "}
              {t("vessels.nhanLoai")}: {vessel.vesselType || "—"} ·{" "}
              {t("vessels.nKho", { n: vessel.warehouses.length })}
            </>
          }
          action={
            <Badge tone={toneTT} dot>
              {nhanTT}
            </Badge>
          }
        />
      </div>

      <VesselSwitcher hienTai={vessel.id} duongDan={(id) => `/vessels/${id}`} />

      <MucGap
        icon={<FileText className="size-4 text-[var(--text-muted)]" />}
        tieuDe={t("vessels.baoCaoNhanh")}
        ghiChu={documents.length ? t("vessels.nTepGanNhat", { n: documents.length }) : t("vessels.chuaCoBaoCaoTau")}
        nut={
          <Link href="/documents" className={buttonClass("secondary", "sm")}>
            {t("vessels.taiLenXemTatCa")}
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title={t("vessels.chuaCoBaoCaoTau")}
            action={
              <Link href="/documents" className={buttonClass("secondary", "sm")}>
                {t("vessels.taiBaoCaoLen")}
              </Link>
            }
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotNgayTai")}</Th>
                  <Th>{t("vessels.cotLoai")}</Th>
                  <Th>{t("vessels.cotKy")}</Th>
                  <Th>{t("vessels.cotTieuDeFile")}</Th>
                  <Th>{t("vessels.cotCoFile")}</Th>
                  <Th>{t("vessels.cotNguoiTai")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <Tr
                    key={doc.id}
                    className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {ngay(doc.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap">{doc.reportType}</Td>
                    <Td className="whitespace-nowrap">{doc.period}</Td>
                    <Td>
                      <p className="font-medium">{doc.title}</p>
                      {doc.title !== doc.fileName && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {doc.fileName}
                        </p>
                      )}
                    </Td>
                    <Td className="tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {doc.size >= 1024 * 1024
                        ? `${(doc.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.max(1, Math.round(doc.size / 1024))} KB`}
                    </Td>
                    <Td>{doc.uploadedBy.name}</Td>
                    <Td>
                      <a
                        href={`/api/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass("secondary", "sm")}
                      >
                        <Download className="size-4" />
                        {t("vessels.xemTaiFile")}
                      </a>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </MucGap>

      {canManage && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <MucGap
            className="xl:col-span-2"
            icon={<Pencil className="size-4 text-[var(--text-muted)]" />}
            tieuDe={t("vessels.suaThongTinTau")}
            ghiChu={t("vessels.goiSuaThongTin")}
          >
            <VesselEditForm
              vessel={{
                id: vessel.id,
                code: vessel.code,
                name: vessel.name,
                imo: vessel.imo,
                flag: vessel.flag,
                vesselType: vessel.vesselType,
                status: vessel.status,
                mainEngineGroup: vessel.mainEngineGroup,
                mainEngineModel: vessel.mainEngineModel,
              }}
            />
          </MucGap>
          <MucGap icon={<Trash2 className="size-4 text-[var(--text-muted)]" />} tieuDe={t("vessels.xoaTau")}>
            <p className="mb-3 text-sm text-[var(--text-secondary)]">{t("vessels.luuYXoaTau")}</p>
            <VesselDeleteButton
              id={vessel.id}
              name={vessel.name}
              requestCount={requests.length}
            />
          </MucGap>
        </div>
      )}

      {/* Kho / vị trí cất hàng — chỉ huy của tàu và quản trị thêm, sửa, xóa kho, chuyển hàng giữa các kho. */}
      <MucGap
        icon={<Warehouse className="size-4 text-[var(--text-muted)]" />}
        tieuDe={t("vessels.khoTrenTau")}
        ghiChu={t("vessels.nKho", { n: vessel.warehouses.length })}
      >
        <BangKhoTau
          tau={{ id: vessel.id, code: vessel.code, name: vessel.name }}
          kho={vessel.warehouses.map((w) => ({
            id: w.id,
            code: w.code,
            name: w.name,
            soMatHang: matHangTheoKho.get(w.id) ?? 0,
            soGiaoDich: giaoDichTheoKho.get(w.id) ?? 0,
          }))}
          quanLy={canManageVesselCatalog(user, vessel.id)}
          vanPhong={!banTau}
        />
      </MucGap>

      {/* 4) Tồn kho — mở sẵn, gập được. Nhập/xuất và xuất kiểm kê làm ở module Tồn kho — ở đây chỉ xem. */}
      <MucGap
        mo
        icon={<Boxes className="size-4 text-[var(--text-muted)]" />}
        tieuDe={t("vessels.tonKhoCuaTau", { ten: vessel.name })}
        ghiChu={t("vessels.nDongTon", { n: tongTonKho })}
        nut={
          <Link href={`/inventory?vessel=${vessel.id}`} className={buttonClass("secondary", "sm")}>
            {t("vessels.nhapXuatKiemKe")}
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        {tongTonKho === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" />}
            title={t("vessels.chuaCoTonKho")}
          />
        ) : (
          <KhungBang
            ten="ho-so-tau-ton"
            caoMacDinh="cao"
            tieuDe={`${vessel.code} — ${t("vessels.tonKhoCuaTau", { ten: vessel.name })}`}
          >
            {/* xuongDong: bảng co theo khung (tên dài, tên kho xuống dòng) — đủ 7 cột Mã → Khả dụng
                không phải cuộn ngang; mã giữ một dòng. */}
            <Table dense xuongDong>
              <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                <tr>
                  {nhapXuatDuoc && (
                    <Th className="w-8">
                      <input type="checkbox" data-chon-ton-bang={bangTon} aria-label={t("inventory.hl_chonCaBang")} className={O_TICK} />
                    </Th>
                  )}
                  <Th>{t("vessels.cotMaVatTu")}</Th>
                  <Th>{t("vessels.cotTenVatTu")}</Th>
                  <Th>{t("chung.kho")}</Th>
                  <Th>{t("chung.donVi")}</Th>
                  <Th align="right">{t("vessels.cotTon")}</Th>
                  <Th align="right">{t("vessels.cotGiu")}</Th>
                  <Th align="right">{t("vessels.cotKhaDung")}</Th>
                </tr>
              </thead>
              {/* Mỗi bộ phận một <tbody> (#ton-<bộ phận> để chuyển trang cuộn về đúng chỗ; nút thu gọn
                  ẩn các dòng của riêng nó) — cùng dáng dòng tiêu đề với trang Danh mục. */}
              {boPhan.map((dept) => {
                const DeptIcon = DEPT_ICON[dept.key] ?? Package;
                return (
                  <tbody key={dept.key} id={`ton-${dept.key}`} className="scroll-mt-24">
                    <TrNhom colSpan={soCot}>
                      <div className="flex items-center gap-2">
                        {nhapXuatDuoc && (
                          <input
                            type="checkbox"
                            data-chon-ton-nhom={`${vessel.id}-${dept.key}`}
                            aria-label={t("inventory.hl_chonCaNhom")}
                            title={t("inventory.hl_chonCaNhom")}
                            className={O_TICK}
                          />
                        )}
                        <span className="inline-flex items-center gap-2">
                          <DeptIcon className="size-4 text-[var(--text-muted)]" />
                          {tTuDo(`labels.dept_${dept.key}`)}
                          <Badge tone={dept.dong.length < dept.tong ? "warning" : "neutral"}>
                            {dept.dong.length < dept.tong ? `${dept.tu + 1}–${dept.tu + dept.dong.length}/${dept.tong}` : dept.tong}
                          </Badge>
                        </span>
                        {dept.soTrang > 1 && (
                          <PhanTrang trang={dept.trang} soTrang={dept.soTrang} href={(n) => hrefBoPhan(dept.key, n)} nhan={nhanTrang(dept)} />
                        )}
                        <NutThuGonNhom />
                      </div>
                    </TrNhom>
                    {dept.dong.map((inventory) => {
                      const available = inventory.quantity - inventory.reservedQuantity;
                      return (
                        <Tr key={inventory.id} className="transition-colors hover:bg-[var(--surface-sunken)]/50">
                          {nhapXuatDuoc && (
                            <Td>
                              <input
                                type="checkbox"
                                data-chon-ton={inventory.id}
                                data-bang={bangTon}
                                data-nhom={`${vessel.id}-${dept.key}`}
                                aria-label={inventory.material.code}
                                className={O_TICK}
                              />
                            </Td>
                          )}
                          {/* Bấm thẳng vào mục: mã / tên → thẻ kho của mặt hàng ở đúng kho này; kho / vị trí →
                              trang Tồn kho chỉ kho đó (tên gọn, không lặp tên tàu của chính trang này). */}
                          <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                            <Link href={duongDanTheKho(inventory.materialId, inventory.warehouseId)} prefetch={false} className={LINK} title={t("inventory.moTheKho")}>
                              {inventory.material.code}
                            </Link>
                          </Td>
                          <Td>
                            {/* Tên rất dài (tới ~90 ký tự) xuống dòng thay vì đẩy Kho / Tồn / Khả dụng ra ngoài khung. */}
                            <div className="max-w-md">
                              <Link href={duongDanTheKho(inventory.materialId, inventory.warehouseId)} prefetch={false} className={LINK_AN}>
                                {inventory.material.nameVn}
                              </Link>
                            </div>
                          </Td>
                          <Td className="text-[var(--text-secondary)]">
                            <Link
                              href={`/inventory?vessel=${vessel.id}&wh=${inventory.warehouseId}`}
                              prefetch={false}
                              className={LINK_AN}
                              title={`${inventory.warehouse.code} — ${t("inventory.xemHangCuaKho")}`}
                            >
                              {tenKhoNgan(inventory.warehouse.name, vessel.name)}
                            </Link>
                          </Td>
                          <Td>
                            <span className="text-xs text-[var(--text-secondary)]">{inventory.material.uom}</span>
                          </Td>
                          <Td align="right">{inventory.quantity}</Td>
                          <Td align="right">
                            <span className="text-[var(--text-muted)]">{inventory.reservedQuantity}</span>
                          </Td>
                          <Td align="right">
                            <span
                              className={cn(
                                "font-semibold",
                                available <= inventory.material.minStock ? "text-[var(--text-danger)]" : "text-[var(--text-success)]"
                              )}
                            >
                              {available}
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                    {/* Đọc hết trang này của bộ phận thì sang trang sau ngay tại đây, không phải cuộn ngược lên. */}
                    {dept.soTrang > 1 && (
                      <tr className="no-print">
                        <td colSpan={soCot} className="border-t border-[var(--border-subtle)] px-4 py-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-xs text-[var(--text-muted)]">
                              {t("materials.cuoiTrangBoPhan", {
                                bp: tTuDo(`labels.dept_${dept.key}`),
                                tu: dept.tu + 1,
                                den: dept.tu + dept.dong.length,
                                tong: dept.tong,
                              })}
                            </span>
                            <PhanTrang trang={dept.trang} soTrang={dept.soTrang} href={(n) => hrefBoPhan(dept.key, n)} nhan={nhanTrang(dept)} coChu />
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </Table>
          </KhungBang>
        )}
        {nhapXuatDuoc && tongTonKho > 0 && <NhapXuatHangLoat key={`${vessel.id}-${boPhan.map((d) => d.trang).join(".")}`} />}
      </MucGap>

      {/* 5) Yêu cầu — mở sẵn, gập được. Tạo, duyệt, xóa yêu cầu làm ở module Yêu cầu vật tư. */}
      <MucGap
        mo
        icon={<ClipboardList className="size-4 text-[var(--text-muted)]" />}
        tieuDe={t("vessels.yeuCauCuaTau", { ten: vessel.name })}
        ghiChu={t("vessels.nYeuCauTau", { n: requests.length })}
        nut={
          <Link href={`/requests?vessel=${vessel.id}`} className={buttonClass("secondary", "sm")}>
            {t("vessels.taoDuyetYeuCau")}
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        {requests.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={t("vessels.chuaCoYeuCau")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotSoHieuYeuCau")}</Th>
                  <Th>{t("vessels.cotLoai")}</Th>
                  <Th>{t("vessels.cotNguoiYeuCau")}</Th>
                  <Th>{t("vessels.cotBoPhan")}</Th>
                  <Th>{t("vessels.cotUuTien")}</Th>
                  <Th>{t("vessels.cotNoiDung")}</Th>
                  <Th>{t("chung.trangThai")}</Th>
                  <Th>{t("chung.thaoTac")}</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <Tr
                    key={request.id}
                    className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                      <Link href={`/requests/${request.id}`} className={LINK}>
                        {request.requestNo}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={request.kind === "SPARE" ? "brand" : "neutral"}>
                        {tTuDo(`labels.type_${request.kind}`)}
                      </Badge>
                    </Td>
                    <Td>{request.requestedBy}</Td>
                    <Td>{tTuDo(`labels.reqDept_${request.department}`)}</Td>
                    <Td>
                      <Badge tone={TONE_UU_TIEN[request.priority] ?? "neutral"}>
                        {tTuDo(`labels.priority_${request.priority}`)}
                      </Badge>
                    </Td>
                    <Td>
                      {request.items.map((item) => (
                        <p key={item.id} className="whitespace-nowrap">
                          {item.material ? (
                            <span className="font-display text-xs tracking-wide">
                              {item.material.code}
                            </span>
                          ) : (
                            `${item.itemName ?? t("vessels.vatTuMoi")} ${t(
                              "vessels.vatTuMoi"
                            )}`
                          )}{" "}
                          <span className="tabular text-[var(--text-secondary)]">
                            x {item.quantity}
                          </span>
                        </p>
                      ))}
                    </Td>
                    <Td>
                      <Badge tone={TONE_YEU_CAU[request.status] ?? "neutral"} dot>
                        {tTuDo(`labels.reqStatus_${request.status}`)}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/requests/${request.id}`}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Printer className="size-4" />
                          {t("vessels.xemIn")}
                        </Link>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </MucGap>
    </div>
  );
}
