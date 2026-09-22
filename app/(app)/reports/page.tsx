import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { FileText } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import BaoCaoVatTuSua, { type DongBaoCao1101 } from "@/components/BaoCaoVatTuSua";
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

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(String(params.month ?? ""));
  const monthStr =
    monthMatch && Number(monthMatch[2]) >= 1 && Number(monthMatch[2]) <= 12
      ? String(params.month)
      : defaultMonth;
  const [yearNum, monthNum] = monthStr.split("-").map(Number);
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 1);
  const lastDay = new Date(yearNum, monthNum, 0);

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
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        occurredAt: { gte: monthStart },
      },
      orderBy: { occurredAt: "asc" },
    }),
    // Báo cáo chỉ đọc 8 cột — kéo cả 21 cột của 606 dòng là 243 KB thay vì 68 KB.
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
      },
    }),
  ]);

  type Row = {
    currentQty: number;
    netAfterMonth: number;
    received: number;
    used: number;
    lastReceivedAt: Date | null;
    lastUsedAt: Date | null;
  };
  const rowsByMaterial = new Map<number, Row>();
  const getRow = (materialId: number): Row => {
    let row = rowsByMaterial.get(materialId);
    if (!row) {
      row = {
        currentQty: 0,
        netAfterMonth: 0,
        received: 0,
        used: 0,
        lastReceivedAt: null,
        lastUsedAt: null,
      };
      rowsByMaterial.set(materialId, row);
    }
    return row;
  };
  for (const inventory of inventories) {
    getRow(inventory.materialId).currentQty += inventory.quantity;
  }
  for (const tx of transactions) {
    const row = getRow(tx.materialId);
    const signed = tx.type === "IN" ? tx.quantity : -tx.quantity;
    if (tx.occurredAt >= monthEnd) {
      row.netAfterMonth += signed;
    } else {
      if (tx.type === "IN") {
        row.received += tx.quantity;
        row.lastReceivedAt = tx.occurredAt;
      } else {
        row.used += tx.quantity;
        row.lastUsedAt = tx.occurredAt;
      }
    }
  }
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const reportRows = [...rowsByMaterial.entries()]
    .map(([materialId, row]) => {
      const material = materialById.get(materialId);
      const closing = row.currentQty - row.netAfterMonth;
      const opening = closing - row.received + row.used;
      return {
        material,
        ...row,
        received: round2(row.received),
        used: round2(row.used),
        closing: round2(closing),
        opening: round2(opening),
      };
    })
    .filter(
      (row) =>
        row.material &&
        (row.opening !== 0 ||
          row.received !== 0 ||
          row.used !== 0 ||
          row.closing !== 0)
    )
    .sort((a, b) => (a.material!.code < b.material!.code ? -1 : 1));

  const fmtDate = (d: Date | null) => (d ? ngay(d) : "");

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
  const dongGoc: DongBaoCao1101[] = reportRows.map((row) => ({
    id: String(row.material!.id),
    ten: `${row.material!.nameVn}${row.material!.nameEn ? ` (${row.material!.nameEn})` : ""}`,
    kyHieu: soHieuHang(row.material!),
    donVi: row.material!.uom,
    tonTruoc: String(row.opening),
    nhan: soChu(row.received),
    ngayNhan: fmtDate(row.lastReceivedAt),
    dung: soChu(row.used),
    ngayDung: fmtDate(row.lastUsedAt),
    ton: String(row.closing),
    ghiChu: "",
  }));

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
    </div>
  );
}
