import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { FileText } from "lucide-react";
import PrintButton from "@/components/PrintButton";
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

      <div className="print-area surface rounded-xl border p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <table className="w-full border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="w-40 border border-black p-2 align-middle">
                <p className="text-lg font-black italic">Mercury Lines</p>
              </td>
              <td className="border border-black p-2 text-center">
                <p className="font-bold">CÔNG TY TNHH MERCURY LINES</p>
                <p className="font-bold">MERCURY LINES COMPANY LIMITED</p>
                <p className="text-xs italic">
                  Phù hợp: Bộ luật ISM 5.2, 6.1.3, 10.1
                </p>
              </td>
              <td className="w-44 border border-black p-2 text-xs">
                <p>MLS-11-01</p>
                <p>Ngày ban hành: 10/01/2024</p>
                <p>Soát xét: 00</p>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">
                <p className="text-base font-bold">
                  BÁO CÁO NHẬN VÀ SỬ DỤNG VẬT TƯ
                </p>
                <p className="text-base font-bold">
                  MATERIALS RECEIVING &amp; USING REPORT
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <p>
            <span className="font-semibold">Tên tàu (Ships name):</span>{" "}
            {selectedVessel.name}
          </p>
          <p>
            <span className="font-semibold">Date (Ngày):</span> {ngay(lastDay)}
          </p>
          <p>
            <span className="font-semibold">Bộ phận (Dep.):</span>{" "}
            {t(dept.khoa)}
          </p>
          <p>
            <span className="font-semibold">Tại cảng (At Sea):</span>{" "}
            ..........................
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-2 border-black text-xs">
            <thead>
              <tr className="text-center">
                <th rowSpan={2} className="border border-black p-1">
                  Stt
                  <br />
                  No
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Tên vật tư
                  <br />
                  Material Name
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Ký hiệu
                  <br />
                  Spare part No.
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Đơn vị
                  <br />
                  Unit
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  SL tồn đợt trước
                  <br />
                  Last ROB
                </th>
                <th colSpan={2} className="border border-black p-1">
                  Vật tư nhận
                  <br />
                  Received
                </th>
                <th colSpan={2} className="border border-black p-1">
                  Vật tư sử dụng
                  <br />
                  Used Materials
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Vật tư tồn
                  <br />
                  Remain on board
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Ghi chú
                  <br />
                  Remarks
                </th>
              </tr>
              <tr className="text-center">
                <th className="border border-black p-1">
                  S.Lượng
                  <br />
                  Q.ty
                </th>
                <th className="border border-black p-1">
                  Ngày
                  <br />
                  Date
                </th>
                <th className="border border-black p-1">
                  S.Lượng
                  <br />
                  Q.ty
                </th>
                <th className="border border-black p-1">
                  Ngày
                  <br />
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="border border-black p-3 text-center text-slate-500"
                  >
                    {t("inventory.khongCoDuLieuKy")}
                  </td>
                </tr>
              ) : (
                reportRows.map((row, index) => (
                  <tr key={row.material!.id} className="text-center">
                    <td className="border border-black p-1">{index + 1}</td>
                    <td className="border border-black p-1 text-left">
                      {row.material!.nameVn}
                      {row.material!.nameEn ? ` (${row.material!.nameEn})` : ""}
                    </td>
                    <td className="border border-black p-1">
                      {soHieuHang(row.material!)}
                    </td>
                    <td className="border border-black p-1">
                      {row.material!.uom}
                    </td>
                    <td className="border border-black p-1">{row.opening}</td>
                    <td className="border border-black p-1">
                      {row.received || ""}
                    </td>
                    <td className="border border-black p-1">
                      {fmtDate(row.lastReceivedAt)}
                    </td>
                    <td className="border border-black p-1">
                      {row.used || ""}
                    </td>
                    <td className="border border-black p-1">
                      {fmtDate(row.lastUsedAt)}
                    </td>
                    <td className="border border-black p-1 font-semibold">
                      {row.closing}
                    </td>
                    <td className="border border-black p-1"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between text-xs text-slate-700">
          <div>
            <p>Người làm báo cáo: CE, CO</p>
            <p>Thời điểm làm báo cáo: Hàng tháng</p>
          </div>
          <div>
            <p>Thời gian lưu: 3 năm</p>
            <p>Lưu VP: Vật tư</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <p className="font-bold">NGƯỜI LÀM BÁO CÁO</p>
            <p className="italic">CE / CO</p>
            <div className="mt-16" />
          </div>
          <div>
            <p className="font-bold">THUYỀN TRƯỞNG</p>
            <p className="italic">Captain</p>
            <div className="mt-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
