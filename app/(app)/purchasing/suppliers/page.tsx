import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import {
  SupplierActiveToggle,
  SupplierDeleteButton,
  SupplierEditForm,
  SupplierForm,
} from "@/components/SupplierForm";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const user = await requireScopedUser();
  const canManage = user.role === "ADMIN";
  const suppliers = await prisma.supplier.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { purchaseOrders: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/purchasing"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Quay lại mua sắm
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">Nhà cung cấp</h2>
        <p className="text-slate-600">Danh sách nhà cung cấp cho mua sắm</p>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {canManage && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">Thêm nhà cung cấp</h3>
            <SupplierForm />
          </div>
        )}
        <div
          className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 ${
            canManage ? "xl:col-span-2" : "xl:col-span-3"
          }`}
        >
          <h3 className="mb-4 text-lg font-semibold">
            Danh sách ({suppliers.length})
          </h3>
          {suppliers.length === 0 ? (
            <p className="text-slate-600">Chưa có nhà cung cấp nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border text-sm">
                <thead>
                  <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                    <th className="p-2">Mã</th>
                    <th className="p-2">Tên</th>
                    <th className="p-2">Liên hệ</th>
                    <th className="p-2">Email / ĐT</th>
                    <th className="p-2">Số PO</th>
                    <th className="p-2">Trạng thái</th>
                    {canManage && <th className="p-2">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <Fragment key={s.id}>
                      <tr
                        className={`border-b ${
                          s.isActive ? "" : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        <td className="p-2 font-medium">{s.code}</td>
                        <td className="p-2">{s.name}</td>
                        <td className="p-2">{s.contact}</td>
                        <td className="p-2">
                          <p>{s.email}</p>
                          <p className="text-xs text-slate-500">{s.phone}</p>
                        </td>
                        <td className="p-2">{s._count.purchaseOrders}</td>
                        <td className="p-2">
                          {s.isActive ? (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                              Đang dùng
                            </span>
                          ) : (
                            <span className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-600">
                              Ngừng dùng
                            </span>
                          )}
                        </td>
                        {canManage && (
                          <td className="p-2">
                            <div className="flex flex-wrap items-start gap-2">
                              <SupplierActiveToggle
                                id={s.id}
                                isActive={s.isActive}
                              />
                              <SupplierDeleteButton id={s.id} />
                            </div>
                          </td>
                        )}
                      </tr>
                      {canManage && (
                        <tr className="border-b">
                          <td colSpan={7} className="p-2 pt-0">
                            <details>
                              <summary className="cursor-pointer text-xs text-blue-700 hover:underline">
                                Sửa thông tin nhà cung cấp
                              </summary>
                              <SupplierEditForm
                                supplier={{
                                  id: s.id,
                                  code: s.code,
                                  name: s.name,
                                  contact: s.contact,
                                  email: s.email,
                                  phone: s.phone,
                                  address: s.address,
                                }}
                              />
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
