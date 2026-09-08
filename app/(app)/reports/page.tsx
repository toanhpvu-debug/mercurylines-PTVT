import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const DEPT_OPTIONS: Record<string, { label: string; suffix: string | null }> = {
  ENG: { label: "MÁY", suffix: "-ENG" },
  DECK: { label: "BOONG", suffix: "-DECK" },
  STORE: { label: "KHO TIÊU HAO", suffix: "-STORE" },
  ALL: { label: "TẤT CẢ", suffix: null },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; dept?: string; month?: string }>;
}) {
  const user = await requireScopedUser();
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
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-blue-950">Báo cáo nhận và sử dụng vật tư</h2>
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách. Vui lòng liên hệ quản trị viên.
        </div>
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
    prisma.material.findMany({ orderBy: { code: "asc" } }),
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

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("vi-VN") : "";

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h2 className="text-2xl font-bold text-blue-950">Báo cáo nhận và sử dụng vật tư</h2>
        <p className="text-slate-600">
          Tự động tổng hợp từ giao dịch nhập/xuất kho — mẫu MLS-11-01
        </p>
      </div>

      <form className="no-print flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        {scope.all ? (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Tàu</label>
            <select
              name="vessel"
              defaultValue={selectedVessel.id}
              className="rounded border p-2"
            >
              {vessels.map((vessel) => (
                <option key={vessel.id} value={vessel.id}>
                  {vessel.code} - {vessel.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="vessel" value={selectedVessel.id} />
        )}
        <div>
          <label className="mb-1 block text-sm text-slate-600">Bộ phận</label>
          <select name="dept" defaultValue={deptKey} className="rounded border p-2">
            {Object.entries(DEPT_OPTIONS).map(([key, option]) => (
              <option key={key} value={key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Tháng</label>
          <input
            name="month"
            type="month"
            defaultValue={monthStr}
            className="rounded border p-2"
          />
        </div>
        <button className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
          Xem báo cáo
        </button>
        <PrintButton label="In báo cáo MLS-11-01" />
      </form>

      <div className="print-area rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 print:rounded-none print:p-0 print:shadow-none">
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
            <span className="font-semibold">Date (Ngày):</span>{" "}
            {lastDay.toLocaleDateString("vi-VN")}
          </p>
          <p>
            <span className="font-semibold">Bộ phận (Dep.):</span> {dept.label}
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
                    Không có dữ liệu vật tư trong kỳ này.
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
                      {row.material!.code}
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
