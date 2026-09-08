import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { danhTinhHieuLuc, requireScopedUser } from "@/lib/auth";
import { QUAN_DANH_MUC_NHIEN_LIEU, VAN_HANH_HOA_CHAT } from "@/lib/roles";
import { CONSUMABLE_CATEGORIES } from "@/lib/consumables";
import {
  ConsumableProductActions,
  ConsumableProductForm,
} from "@/components/ConsumableProductManager";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ConsumableProductsPage() {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  // Vào xem và THÊM mới thì người quản nhóm trên tàu cũng được; sửa/xóa một mặt
  // hàng đang dùng chung thì server chặn riêng ở từng action.
  //
  // Xét cả danh tính MƯỢN qua ủy quyền chứ không chỉ user.role thô, vì hai lý
  // do: các server action của trang này đi qua requireActiveRole nên vốn đã
  // nhận vai trò mượn — đọc user.role thô ở cổng là người được máy trưởng ủy
  // quyền không vào nổi cái trang chứa đúng những action họ gọi được; và nút
  // dẫn tới đây ở /consumables cũng tính theo danhTinhHieuLuc, lệch nhau thì họ
  // thấy nút, bấm vào bị redirect ngược về chỗ vừa bấm, bấm mãi một vòng câm.
  const danhTinh = danhTinhHieuLuc(user);
  if (!danhTinh.some((d) => VAN_HANH_HOA_CHAT.includes(d.role))) {
    redirect("/consumables");
  }
  // Máy trưởng sửa/ngừng/xóa được mặt hàng như quản trị — danh mục dầu và hóa
  // chất là nghiệp vụ buồng máy. Cũng tính vai trò mượn, để khớp requireFleet()
  // ở consumable-actions: nếu không, người nhận ủy quyền của máy trưởng sửa
  // được thật mà giao diện lại giấu nút và báo họ chỉ thêm mới được.
  const laVanPhong = danhTinh.some((d) =>
    QUAN_DANH_MUC_NHIEN_LIEU.includes(d.role)
  );

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
          ← {t("consumables.quayLaiTieuHao")}
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          {t("consumables.tieuDeDanhMuc")}
        </h2>
        <p className="text-slate-600">{t("consumables.moTaDanhMuc")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-4 text-lg font-semibold">
            {t("consumables.themMatHang")}
          </h3>
          <ConsumableProductForm />
          {!laVanPhong && (
            <p className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">
              {t("consumables.luuYQuyenSua")}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">
            {t("consumables.danhSachN", { n: products.length })}
          </h3>
          {products.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("consumables.chuaCoMatHangNao")}
            </p>
          ) : (
            CONSUMABLE_CATEGORIES.map((c) => {
              const rows = products.filter((p) => p.category === c.value);
              if (rows.length === 0) return null;
              return (
                <div key={c.value} className="mb-6">
                  <h4 className="mb-2 font-semibold text-blue-950">
                    {c.icon} {tTuDo(`consumables.nhom_${c.value}`)} (
                    {rows.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border text-sm">
                      <thead>
                        <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                          <th className="p-2">{t("chung.ma")}</th>
                          <th className="p-2">{t("chung.ten")}</th>
                          <th className="p-2">{t("consumables.chungLoai")}</th>
                          <th className="p-2">{t("consumables.cotHang")}</th>
                          <th className="p-2">{t("chung.donVi")}</th>
                          <th className="p-2">{t("consumables.cotDacTinh")}</th>
                          <th className="p-2">{t("chung.trangThai")}</th>
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
                              {tTuDo(`consumables.loai_${p.grade}`)}
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
                                <>
                                  ·{" "}
                                  {t("consumables.hdNThang", {
                                    n: p.shelfLifeMonths,
                                  })}{" "}
                                </>
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
                                {tTuDo(`labels.active_${p.isActive}`)}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {t("consumables.nPhieuNGiaoDich", {
                                  p: p._count.receipts,
                                  g: p._count.transactions,
                                })}
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
        {t("consumables.chuThichVongDoi")}
      </p>
    </div>
  );
}
