import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import PrintButton from "@/components/PrintButton";
import { layT } from "@/lib/i18n/server";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LashingReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  const report = await prisma.lashingReport.findUnique({
    where: { id },
    include: {
      vessel: true,
      lines: {
        include: { gear: true },
      },
    },
  });
  if (!report) {
    notFound();
  }
  if (!trongPhamVi(scope, report.vesselId)) {
    notFound();
  }
  const lines = [...report.lines].sort(
    (a, b) => a.gear.sortOrder - b.gear.sortOrder
  );
  const rows = lines.map((line, index) => {
    const total = line.inOrder + line.outOfOrder;
    const shortOf = Math.max(0, line.minQty - line.inOrder);
    const orderQty = Math.max(0, line.standardQty - line.inOrder);
    return { line, index, total, shortOf, orderQty };
  });
  const needOrder = rows.filter((row) => row.orderQty > 0);
  const dateStr = report.reportDate.toLocaleDateString("vi-VN");

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/lashing"
          className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("vessels.quayLaiDsBaoCao")}
        </Link>
        <PrintButton label={t("vessels.inBaoCaoMLS1113")} />
      </div>

      <div className="print-area surface rounded-xl border p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none print:border-0">
        <table className="w-full border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="w-40 border border-black p-2 align-middle">
                <p className="text-lg font-black italic">Mercury Lines</p>
              </td>
              <td className="border border-black p-2 text-center">
                <p className="font-bold">CÔNG TY TNHH MERCURY LINES</p>
                <p className="font-bold">MERCURY LINES COMPANY LIMITED</p>
              </td>
              <td className="w-44 border border-black p-2 text-xs">
                <p>MLS-11-13</p>
                <p>Ngày ban hành: 10/01/2024</p>
                <p>Soát xét: 00</p>
                <p>Trang: 01 of 01</p>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">
                <p className="text-base font-bold">
                  BÁO CÁO DỤNG CỤ CHẰNG BUỘC CONTAINER
                </p>
                <p className="text-base font-bold">
                  CONTAINER LASHING GEAR RECORD
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-1 text-sm md:grid-cols-4">
          <p>
            <span className="font-semibold">Ship&apos;s Name (Tên tàu):</span>{" "}
            {report.vessel.name}
          </p>
          <p>
            <span className="font-semibold">Vị trí (Psn):</span>{" "}
            {report.position || "—"}
          </p>
          <p>
            <span className="font-semibold">Voy No. (Chuyến):</span>{" "}
            {report.voyageNo || "—"}
          </p>
          <p>
            <span className="font-semibold">Date (Ngày):</span> {dateStr}
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-2 border-black text-xs">
            <thead>
              <tr className="text-center">
                <th className="border border-black p-1">
                  No.
                  <br />
                  Stt
                </th>
                <th className="border border-black p-1">
                  TYPE OF FITTING GEAR
                  <br />
                  Dụng cụ chằng buộc
                </th>
                <th className="border border-black p-1">
                  PART NO./MARK
                  <br />
                  Ký hiệu
                </th>
                <th className="border border-black p-1">
                  Minimum Quantity for Full Load
                  <br />
                  SL tối thiểu
                  <br />1
                </th>
                <th className="border border-black p-1">
                  Standard Out-fitting
                  <br />
                  Trang bị chuẩn
                  <br />2
                </th>
                <th className="border border-black p-1">
                  In Order
                  <br />
                  Số lượng còn dùng được
                  <br />3
                </th>
                <th className="border border-black p-1">
                  Out of Order
                  <br />
                  Bị hỏng
                  <br />4
                </th>
                <th className="border border-black p-1">
                  Total Stock
                  <br />
                  Toàn bộ có trên tàu
                  <br />
                  5=(3+4)
                </th>
                <th className="border border-black p-1">
                  Short of Qty.
                  <br />
                  SL. Thiếu tối thiểu
                  <br />
                  6=(1-3)
                </th>
                <th className="border border-black p-1">
                  Order
                  <br />
                  Yêu cầu
                  <br />
                  7=(2-3)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.line.id} className="text-center">
                  <td className="border border-black p-1">{row.index + 1}</td>
                  <td className="border border-black p-1 text-left">
                    {row.line.gearName}
                  </td>
                  <td className="border border-black p-1 text-left">
                    {row.line.partNo}
                  </td>
                  <td className="border border-black p-1">
                    {row.line.minQty}
                  </td>
                  <td className="border border-black p-1">
                    {row.line.standardQty}
                  </td>
                  <td className="border border-black p-1">
                    {row.line.inOrder}
                  </td>
                  <td className="border border-black p-1">
                    {row.line.outOfOrder}
                  </td>
                  <td className="border border-black p-1">{row.total}</td>
                  <td
                    className={`border border-black p-1 ${
                      row.shortOf > 0 ? "font-bold text-red-600" : ""
                    }`}
                  >
                    {row.shortOf}
                  </td>
                  <td
                    className={`border border-black p-1 ${
                      row.orderQty > 0 ? "font-bold text-red-600" : ""
                    }`}
                  >
                    {row.orderQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <p className="font-bold">CHIEF OFFICER</p>
            <p className="italic">Đại Phó</p>
            <div className="mt-16" />
          </div>
          <div>
            <p className="font-bold">CAPTAIN</p>
            <p className="italic">Thuyền Trưởng</p>
            <div className="mt-16" />
          </div>
        </div>
      </div>

      {needOrder.length > 0 && (
        <Notice tone="danger" className="no-print">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            {t("vessels.canDatMuaBoSung", { n: needOrder.length })}
          </p>
          <ul className="list-inside list-disc">
            {needOrder.map((row) => (
              <li key={row.line.id}>
                {row.line.gearName} ({row.line.partNo}):{" "}
                {t("vessels.canNChiec", { n: row.orderQty })}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            {t("vessels.dungTrangTruoc")}{" "}
            <Link href="/requests" className="font-medium underline">
              {t("vessels.trangYeuCauVatTu")}
            </Link>{" "}
            {t("vessels.dungTrangSau")}
          </p>
        </Notice>
      )}
    </div>
  );
}
