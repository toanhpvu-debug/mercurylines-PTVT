import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { QUAN_DANH_MUC_NHIEN_LIEU, VAN_HANH_HOA_CHAT } from "@/lib/roles";
import {
  CATEGORY_ICON,
  CONSUMABLE_CATEGORIES,
  GRADE_LABEL,
} from "@/lib/consumables";
import {
  ConsumableProductActions,
  ConsumableProductForm,
} from "@/components/ConsumableProductManager";

export const dynamic = "force-dynamic";

export default async function ConsumableProductsPage() {
  const user = await requireScopedUser();
  // Vào xem và THÊM mới thì người quản nhóm trên tàu cũng được; sửa/xóa một mặt
  // hàng đang dùng chung thì server chặn riêng ở từng action.
  if (!VAN_HANH_HOA_CHAT.includes(user.role)) {
    redirect("/consumables");
  }
  // Máy trưởng sửa/ngừng/xóa được mặt hàng như quản trị — danh mục dầu và hóa
  // chất là nghiệp vụ buồng máy.
  const laVanPhong = QUAN_DANH_MUC_NHIEN_LIEU.includes(user.role);

  const products = await prisma.consumableProduct.findMany({
    orderBy: [{ category: "asc" }, { grade: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { stocks: true, receipts: true, transactions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/consumables"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Quay lại Dầu · Dầu nhờn · Hóa chất
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          Danh mục dầu &amp; hóa chất
        </h2>
        <p className="text-slate-600">
          Định nghĩa dùng chung toàn đội. Đặc tính thực của từng lô ghi ở phiếu
          nhận của tàu, không ghi ở đây.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-4 text-lg font-semibold">Thêm mặt hàng</h3>
          <ConsumableProductForm />
          {!laVanPhong && (
            <p className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">
              Bạn thêm được mặt hàng mới. Sửa hoặc xóa một mặt hàng đang dùng
              chung là việc của thuyền trưởng hoặc văn phòng — sửa định nghĩa
              dùng chung thì đổi luôn số liệu của cả đội.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">
            Danh sách ({products.length})
          </h3>
          {products.length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có mặt hàng nào. Thêm ở form bên trái.
            </p>
          ) : (
            CONSUMABLE_CATEGORIES.map((c) => {
              const rows = products.filter((p) => p.category === c.value);
              if (rows.length === 0) return null;
              return (
                <div key={c.value} className="mb-6">
                  <h4 className="mb-2 font-semibold text-blue-950">
                    {c.icon} {c.label} ({rows.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border text-sm">
                      <thead>
                        <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                          <th className="p-2">Mã</th>
                          <th className="p-2">Tên</th>
                          <th className="p-2">Chủng loại</th>
                          <th className="p-2">Hãng</th>
                          <th className="p-2">ĐVT</th>
                          <th className="p-2">Đặc tính</th>
                          <th className="p-2">Trạng thái</th>
                          {laVanPhong && <th className="p-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p) => (
                          <tr key={p.id} className="border-b align-top">
                            <td className="p-2 font-mono text-xs">{p.code}</td>
                            <td className="p-2">
                              {p.name}
                              {p.nameEn && (
                                <span className="block text-xs text-slate-500">
                                  {p.nameEn}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600">
                              {GRADE_LABEL[p.grade] ?? p.grade}
                            </td>
                            <td className="p-2 text-slate-600">
                              {p.maker ?? "—"}
                            </td>
                            <td className="p-2">{p.uom}</td>
                            <td className="p-2 text-xs text-slate-600">
                              {p.sulphurMax !== null && <>S ≤ {p.sulphurMax}% </>}
                              {p.viscosity !== null && <>· {p.viscosity} cSt </>}
                              {p.bnValue !== null && <>· TBN {p.bnValue} </>}
                              {p.shelfLifeMonths !== null && (
                                <>· HD {p.shelfLifeMonths} tháng </>
                              )}
                              {p.hazardClass && <>· {p.hazardClass}</>}
                              {p.sulphurMax === null &&
                                p.viscosity === null &&
                                p.bnValue === null &&
                                p.shelfLifeMonths === null &&
                                !p.hazardClass &&
                                "—"}
                            </td>
                            <td className="p-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                  p.isActive
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {p.isActive ? "Đang dùng" : "Ngừng dùng"}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {p._count.receipts} phiếu ·{" "}
                                {p._count.transactions} giao dịch
                              </span>
                            </td>
                            {laVanPhong && (
                              <td className="p-2">
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
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {CATEGORY_ICON.FUEL} Dầu đốt · {CATEGORY_ICON.LUBE} dầu nhờn ·{" "}
        {CATEGORY_ICON.CHEMICAL} hóa chất dùng chung một danh mục vì vòng đời
        giống nhau: nhận theo lô có chứng từ → nằm trong két/kho → tiêu thụ dần.
      </p>
    </div>
  );
}
