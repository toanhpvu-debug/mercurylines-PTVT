import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { FileText } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import BaoCaoVatTuSua, { type DongBaoCao1101 } from "@/components/BaoCaoVatTuSua";
import PhuLuc1101, { type DongPhuLuc1101 } from "@/components/PhuLuc1101";
import { chuoiNgay1101, coSo1101, ghiChu1101, loaiGiaoDich, nhanNguonPO, tongHop1101 } from "@/lib/baoCao1101";
import { dauThangVN, ngayCuaVN } from "@/lib/kyQuy";
import { layT } from "@/lib/i18n/server";
import type { KhoaDich } from "@/lib/i18n/tuDien";
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
} from "@/components/ui";

export const dynamic = "force-dynamic";

// Hậu tố mã kho của từng bộ phận; NHÃN là khóa từ điển, dịch lúc dựng để đổi
// theo ngôn ngữ đang chọn.
const DEPT_OPTIONS: Record<string, { khoa: KhoaDich; suffix: string | null }> = {
  ENG: { khoa: "inventory.bpMay", suffix: "-ENG" },
  DECK: { khoa: "inventory.bpBoong", suffix: "-DECK" },
  STORE: { khoa: "inventory.bpKhoTieuHao", suffix: "-STORE" },
  ALL: { khoa: "inventory.bpTatCa", suffix: null },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; dept?: string; month?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const params = await searchParams;
  const requestedId = Number(params.vessel);
  const selectedVessel =
    vessels.find((v) => v.id === requestedId) ?? vessels[0] ?? null;
  const deptKey = Object.hasOwn(DEPT_OPTIONS, String(params.dept ?? ""))
    ? String(params.dept)
    : "ENG";
  const dept = DEPT_OPTIONS[deptKey];

  // Tháng theo giờ Việt Nam (máy chủ Dokploy chạy giờ UTC — mốc tháng theo giờ máy
  // lệch 7 tiếng, phiếu ghi 0–7 giờ sáng ngày 1 rơi sang tháng trước).
  const homNay = ngayCuaVN(new Date());
  const defaultMonth = `${homNay.nam}-${String(homNay.thang).padStart(2, "0")}`;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(String(params.month ?? ""));
  const monthStr =
    monthMatch && Number(monthMatch[2]) >= 1 && Number(monthMatch[2]) <= 12
      ? String(params.month)
      : defaultMonth;
  const [yearNum, monthNum] = monthStr.split("-").map(Number);
  const monthStart = dauThangVN(yearNum, monthNum);
  const monthEnd = dauThangVN(yearNum, monthNum + 1);
  const lastDay = new Date(monthEnd.getTime() - 12 * 3600_000);

  if (scope.unassigned || !selectedVessel) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={t("inventory.baoCaoTieuDe")}
          subtitle={t("inventory.baoCaoMoTa")}
        />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  const allWarehouses = await prisma.warehouse.findMany({
    where: { vesselId: selectedVessel.id },
  });
  const warehouses = dept.suffix
    ? allWarehouses.filter((w) => w.code.endsWith(dept.suffix as string))
    : allWarehouses;
  const warehouseIds = warehouses.map((w) => w.id);

  const [inventories, transactions, materials] = await Promise.all([
    prisma.inventory.findMany({
      where: { warehouseId: { in: warehouseIds } },
      select: { materialId: true, quantity: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        occurredAt: { gte: monthStart },
      },
      orderBy: { occurredAt: "asc" },
      select: { id: true, type: true, materialId: true, warehouseId: true, quantity: true, occurredAt: true, note: true, performedBy: true, cotBaoCao: true },
    }),
    // Báo cáo chỉ đọc vài cột — kéo cả 21 cột của 606 dòng là 243 KB thay vì 68 KB.
    prisma.material.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        nameVn: true,
        nameEn: true,
        uom: true,
        materialType: true,
        partNumber: true,
        impa: true,
        minStock: true,
      },
    }),
  ]);

  // Nguồn nhận theo PO: "Nhận hàng PO-…" → kèm tên nhà cung cấp.
  const giaoDichTrongThang = transactions.filter((g) => g.occurredAt < monthEnd);
  const soPo = [...new Set(giaoDichTrongThang.map((g) => /^Nhận hàng\s+(\S+)/i.exec(g.note ?? "")?.[1]).filter((x): x is string => Boolean(x)))];
  // Mặt hàng "mới nhận lần đầu": có nhận trong tháng mà trước tháng chưa từng
  // có giao dịch nào ở các kho này.
  const nhanTrongThang = [...new Set(giaoDichTrongThang.filter((g) => loaiGiaoDich(g) === "NHAN").map((g) => g.materialId))];
  const [donPo, coTruocThang] = await Promise.all([
    soPo.length
      ? prisma.purchaseOrder.findMany({ where: { poNo: { in: soPo } }, select: { poNo: true, supplier: { select: { name: true } } } })
      : Promise.resolve([]),
    nhanTrongThang.length
      ? prisma.inventoryTransaction.findMany({
          where: { warehouseId: { in: warehouseIds }, materialId: { in: nhanTrongThang }, occurredAt: { lt: monthStart } },
          distinct: ["materialId"],
          select: { materialId: true },
        })
      : Promise.resolve([]),
  ]);
  const nccTheoPo = new Map(donPo.map((p) => [p.poNo, p.supplier.name]));
  const daCoTruoc = new Set(coTruocThang.map((g) => g.materialId));
  const nhanDauTien = new Map<number, Date>();
  for (const g of giaoDichTrongThang) {
    if (loaiGiaoDich(g) === "NHAN" && !daCoTruoc.has(g.materialId) && !nhanDauTien.has(g.materialId)) nhanDauTien.set(g.materialId, g.occurredAt);
  }
  const nguonCua = (g: { note: string | null }) => nhanNguonPO(g.note, nccTheoPo) ?? g.note;

  const tonHienTai = new Map<number, number>();
  for (const r of inventories) tonHienTai.set(r.materialId, (tonHienTai.get(r.materialId) ?? 0) + r.quantity);
  const tongHop = tongHop1101({ tonHienTai, giaoDich: transactions, dau: monthStart, cuoi: monthEnd, nhanDauTien, nguonCua });

  const materialById = new Map(materials.map((m) => [m.id, m]));
  const reportRows = [...tongHop.values()]
    .filter((d) => materialById.has(d.materialId) && coSo1101(d))
    .map((d) => ({ d, material: materialById.get(d.materialId)! }))
    .sort((a, b) => (a.material.code < b.material.code ? -1 : 1));

  // Cột "Ký hiệu / Spare part No." trên MLS-11-01 là chỗ ghi SỐ CỦA HÃNG: phụ
  // tùng -> Part No. của nhà sản xuất, vật tư -> mã IMPA. KHÔNG in mã nội bộ
  // (E-SPR-0001…): mã đó do app tự cấp để quản lý và tra cứu, hãng, đại lý và
  // cảng không biết nó — in ra là người nhận báo cáo tra không ra món hàng.
  // Thiếu cả hai thì để trống, đúng như form viết tay; phiếu yêu cầu in ra
  // (/requests/[id]) và xuất kiểm kê MLS-11-06 cũng theo đúng lệ này.
  const soHieuHang = (m: {
    materialType: string;
    partNumber: string | null;
    impa: string | null;
  }) => {
    const partNo = (m.partNumber ?? "").trim();
    const impa = (m.impa ?? "").trim();
    return m.materialType === "SPARE" ? partNo || impa : impa || partNo;
  };
  const soChu = (n: number) => (n ? String(n) : "");
  // Ngày nhận / dùng: MỌI ngày trong tháng (trước chỉ hiện lần cuối); Ghi chú tự
  // điền nguồn nhận, mục đích dùng, điều chỉnh kiểm kê, hàng mới, dưới tối thiểu.
  const dongGoc: DongBaoCao1101[] = reportRows.map(({ d, material }) => ({
    id: String(material.id),
    ten: `${material.nameVn}${material.nameEn ? ` (${material.nameEn})` : ""}`,
    kyHieu: soHieuHang(material),
    donVi: material.uom,
    tonTruoc: String(d.tonDau),
    nhan: soChu(d.nhan),
    ngayNhan: chuoiNgay1101(d.ngayNhan),
    dung: soChu(d.dung),
    ngayDung: chuoiNgay1101(d.ngayDung),
    ton: String(d.tonCuoi),
    ghiChu: ghiChu1101(d, material.minStock),
  }));

  // Phụ lục: từng giao dịch trong tháng (theo thời gian), để đối chiếu từng con số.
  const khoTheoId = new Map(warehouses.map((w) => [w.id, w.code]));
  const phuLuc: DongPhuLuc1101[] = giaoDichTrongThang.flatMap((g) => {
    const m = materialById.get(g.materialId);
    if (!m) return [];
    const loai = loaiGiaoDich(g);
    return [
      {
        id: g.id,
        ngay: ngay(g.occurredAt),
        ma: m.code,
        ten: m.nameVn,
        donVi: m.uom,
        loai,
        // Điều chỉnh có dấu; dòng "bớt nhận / bớt tiêu thụ" của file kiểm kê theo kỳ cũng âm ở cột của nó.
        so: loai === "KIEM_KE" ? (g.type === "IN" ? g.quantity : -g.quantity) : (loai === "NHAN") === (g.type === "IN") ? g.quantity : -g.quantity,
        nguon: (loai === "NHAN" ? nguonCua(g) : g.note) ?? "",
        nguoi: g.performedBy ?? "",
        kho: khoTheoId.get(g.warehouseId) ?? "",
      },
    ];
  });

  return (
    <div className="space-y-5">
      <div className="no-print">
        <PageHeader
          title={t("inventory.baoCaoTieuDe")}
          subtitle={t("inventory.baoCaoMoTa")}
        />
      </div>

      <Card className="no-print">
        <form className="flex flex-wrap items-end gap-3">
          {scope.all ? (
            <Field label={t("chung.tau")} className="w-64">
              <Select name="vessel" defaultValue={selectedVessel.id}>
                {vessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.code} - {vessel.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="vessel" value={selectedVessel.id} />
          )}
          <Field label={t("inventory.boPhan")} className="w-48">
            <Select name="dept" defaultValue={deptKey}>
              {Object.entries(DEPT_OPTIONS).map(([key, option]) => (
                <option key={key} value={key}>
                  {t(option.khoa)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("inventory.thang")} className="w-44">
            <Input name="month" type="month" defaultValue={monthStr} />
          </Field>
          <Button
            type="submit"
            variant="primary"
            icon={<FileText className="size-4" />}
          >
            {t("inventory.xemBaoCao")}
          </Button>
          <PrintButton label={t("inventory.inBaoCaoMLS1101")} />
        </form>
      </Card>

      {/* Bản in sửa được trước khi in: số liệu server là điểm xuất phát, người
          làm báo cáo chỉnh tay (ghi chú, ngày, dòng nhận ngoài sổ) rồi mới in;
          bản sửa chỉ nằm trong trình duyệt theo tàu / bộ phận / tháng. */}
      <BaoCaoVatTuSua
        khoaLuu={`mercury.bao-cao-1101.${selectedVessel.id}.${deptKey}.${monthStr}`}
        dauGoc={{
          tenTau: selectedVessel.name,
          ngay: ngay(lastDay),
          boPhan: t(dept.khoa),
          taiCang: "",
        }}
        dongGoc={dongGoc}
      />

      <PhuLuc1101 dong={phuLuc} tenTau={selectedVessel.name} thang={`${String(monthNum).padStart(2, "0")}/${yearNum}`} />
    </div>
  );
}
