import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScope } from "@/lib/auth";
import VesselFormStandardRow from "@/components/VesselFormStandardRow";
import {
  FormStandardAddForm,
  FormStandardEditForm,
  FormStandardRowActions,
} from "@/components/FormStandardManager";

export const dynamic = "force-dynamic";

export default async function VesselFormsPage() {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canManage = user.role === "ADMIN";
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/purchasing");
  }
  const [vessels, allStandards] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
    }),
    prisma.formStandard.findMany({ orderBy: { code: "asc" } }),
  ]);
  const activeStandards = allStandards.filter((s) => s.isActive);
  const stdByCode = new Map(allStandards.map((s) => [s.code, s]));
  const standardOptions = activeStandards.map((s) => ({
    key: s.code,
    label: s.label,
  }));
  const usageByCode = new Map<string, number>();
  for (const v of vessels) {
    usageByCode.set(
      v.formStandard,
      (usageByCode.get(v.formStandard) ?? 0) + 1
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/purchasing"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Quay lại mua sắm
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">Biểu mẫu chứng từ theo tàu</h2>
        <p className="text-slate-600">
          Quản lý danh sách biểu mẫu (công ty quản lý) và gán cho từng tàu —
          quyết định đầu & chữ ký của Yêu cầu báo giá (RFQ), Đơn mua hàng (PO).
        </p>
      </div>

      {/* Quản lý danh sách biểu mẫu */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {canManage && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">Thêm biểu mẫu mới</h3>
            <FormStandardAddForm />
          </div>
        )}
        <div
          className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 ${
            canManage ? "xl:col-span-2" : "xl:col-span-3"
          }`}
        >
          <h3 className="mb-4 text-lg font-semibold">
            Danh sách biểu mẫu ({allStandards.length})
          </h3>
          <div className="space-y-3">
            {allStandards.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border p-4 ${
                  s.isActive
                    ? "border-blue-100"
                    : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#0c2a5c] px-2 py-0.5 text-xs font-bold text-white">
                        {s.code}
                      </span>
                      <span className="font-semibold">{s.label}</span>
                      {s.isActive ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Đang dùng
                        </span>
                      ) : (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          Ngừng dùng
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {usageByCode.get(s.code) ?? 0} tàu đang gán
                      </span>
                    </div>
                    <p className="text-sm">{s.companyName}</p>
                    <p className="text-xs text-slate-500">{s.address}</p>
                    {s.repAddress && (
                      <p className="text-xs text-slate-500">{s.repAddress}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {[
                        s.tel ? `Tel: ${s.tel}` : null,
                        s.email,
                        s.website,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canManage && (
                    <FormStandardRowActions id={s.id} isActive={s.isActive} />
                  )}
                </div>
                {canManage && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-blue-700 hover:underline">
                      Sửa thông tin biểu mẫu
                    </summary>
                    <FormStandardEditForm
                      standard={{
                        id: s.id,
                        code: s.code,
                        label: s.label,
                        companyName: s.companyName,
                        address: s.address,
                        repAddress: s.repAddress,
                        tel: s.tel,
                        email: s.email,
                        website: s.website,
                      }}
                    />
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gán biểu mẫu cho tàu */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-4 text-lg font-semibold">Gán biểu mẫu cho tàu</h3>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">Mã tàu</th>
                <th className="p-2">Tên tàu</th>
                <th className="p-2">IMO</th>
                <th className="p-2">Biểu mẫu hiện tại</th>
                {canManage && <th className="p-2">Đổi biểu mẫu / Hull No.</th>}
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => {
                const std = stdByCode.get(v.formStandard);
                return (
                  <tr key={v.id} className="border-b">
                    <td className="p-2 font-medium">{v.code}</td>
                    <td className="p-2">{v.name}</td>
                    <td className="p-2">{v.imo}</td>
                    <td className="p-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          std
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {std ? std.label : `${v.formStandard} (không tồn tại)`}
                      </span>
                    </td>
                    {canManage && (
                      <td className="p-2">
                        <VesselFormStandardRow
                          id={v.id}
                          formStandard={v.formStandard}
                          hullNo={v.hullNo}
                          standards={standardOptions}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
