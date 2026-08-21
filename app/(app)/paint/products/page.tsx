import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { PAINT_TYPES, PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import {
  PaintProductAddForm,
  PaintProductRowActions,
} from "@/components/PaintProductManager";

export const dynamic = "force-dynamic";

const TYPE_LABEL = PAINT_TYPE_LABEL;

export default async function PaintProductsPage() {
  const user = await requireScopedUser();
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
    <div className="space-y-6">
      <div>
        <Link href="/paint" className="text-sm text-blue-700 hover:underline">
          ← Quay lại quản lý sơn
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">Danh mục sơn</h2>
        <p className="text-slate-600">
          Định nghĩa dùng chung cho cả đội tàu: hãng, loại sơn, mã màu, độ phủ
          và DFT. Mỗi tàu chỉ tham chiếu tới đây khi lập sơ đồ sơn và ghi tồn.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PaintProductAddForm types={PAINT_TYPES} />
        <Link
          href="/paint/import"
          className="rounded border border-blue-300 bg-white px-4 py-2 text-sm text-blue-800 hover:bg-blue-50"
        >
          ⬆ Nhập từ file Excel / PDF
        </Link>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <p className="mb-3 font-semibold text-blue-950">
          Danh sách ({products.length})
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có loại sơn nào. Bấm &quot;Thêm loại sơn&quot; để bắt đầu.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-blue-900 text-left text-white">
                <tr>
                  <th className="p-2">Mã</th>
                  <th className="p-2">Tên sơn</th>
                  <th className="p-2">Hãng</th>
                  <th className="p-2">Loại</th>
                  <th className="p-2">Màu</th>
                  <th className="p-2 text-right">Độ phủ (m²/L)</th>
                  <th className="p-2 text-right">DFT (µm)</th>
                  <th className="p-2 text-right">Tổng tồn</th>
                  <th className="p-2">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {products.map((p) => {
                  const total = p.stocks.reduce((s, x) => s + x.quantity, 0);
                  return (
                    <tr
                      key={p.id}
                      className={p.isActive ? "" : "bg-slate-50 text-slate-400"}
                    >
                      <td className="p-2 font-mono text-xs">{p.code}</td>
                      <td className="p-2">
                        {p.name}
                        {!p.isActive && (
                          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                            ngừng dùng
                          </span>
                        )}
                      </td>
                      <td className="p-2">{p.maker ?? "—"}</td>
                      <td className="p-2">
                        {TYPE_LABEL[p.paintType] ?? p.paintType}
                      </td>
                      <td className="p-2">
                        {[p.colorName, p.colorCode].filter(Boolean).join(" · ") ||
                          "—"}
                      </td>
                      <td className="p-2 text-right">
                        {p.coverage || "—"}
                      </td>
                      <td className="p-2 text-right">{p.dftPerCoat || "—"}</td>
                      <td className="p-2 text-right">
                        {total ? `${total} ${p.uom}` : "—"}
                      </td>
                      <td className="p-2">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
