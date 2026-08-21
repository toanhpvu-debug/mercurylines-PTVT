import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { ROLE_DESC } from "@/lib/roles";
import UserForm from "@/components/UserForm";
import {
  UserActiveToggle,
  UserRoleForm,
} from "@/components/UserRowActions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireScopedUser();
  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const [users, vessels] = await Promise.all([
    prisma.user.findMany({
      orderBy: { id: "asc" },
      include: { vessel: true },
    }),
    prisma.vessel.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  const vesselOptions = vessels.map((vessel) => ({
    id: vessel.id,
    label: `${vessel.code} - ${vessel.name}`,
  }));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">Người dùng & phân quyền</h2>
        <p className="text-slate-600">
          Quản lý tài khoản đăng nhập và vai trò truy cập
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-4 text-lg font-semibold">Tạo người dùng mới</h3>
          <UserForm vessels={vesselOptions} />
          <div className="mt-6 rounded bg-slate-50 p-3 text-xs text-slate-600">
            <p className="mb-1 font-semibold">Quyền theo vai trò:</p>
            {["ADMIN", "TECH_MANAGER", "MASTER", "CHIEF_ENGINEER", "CREW"].map(
              (r) => (
                <p key={r}>
                  <b>{r}</b> — {ROLE_DESC[r]}
                </p>
              )
            )}
            <p className="mt-2 font-semibold">Đường đi phê duyệt yêu cầu:</p>
            <p>
              Nháp → <b>tàu duyệt</b> (thuyền trưởng, hoặc máy trưởng với bộ
              phận Máy/Điện) → <b>công ty duyệt</b> (quản lý kỹ thuật) → mua sắm
            </p>
            <p className="mt-2 font-semibold">Tàu phụ trách:</p>
            <p>Gán tàu: chỉ thấy và thao tác trên tàu đó</p>
            <p>ADMIN, TECH_MANAGER: luôn toàn đội</p>
            <p>MASTER không gán tàu: quản lý toàn đội (văn phòng)</p>
            <p>CREW / CHIEF_ENGINEER không gán tàu: chưa xem được dữ liệu tàu</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">Danh sách người dùng</h3>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Họ tên</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Vai trò & tàu phụ trách</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  return (
                    <tr key={user.id} className="border-b align-top">
                      <td className="p-2 font-medium">
                        {user.name}
                        {isSelf && (
                          <span className="ml-1 text-xs text-slate-400">
                            (bạn)
                          </span>
                        )}
                      </td>
                      <td className="p-2">{user.email}</td>
                      <td className="p-2">
                        <UserRoleForm
                          id={user.id}
                          role={user.role}
                          vesselId={user.vesselId}
                          vessels={vesselOptions}
                          disabled={isSelf}
                        />
                      </td>
                      <td className="p-2">
                        {user.isActive ? (
                          <span className="rounded bg-green-100 px-2 py-1 text-green-700">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="rounded bg-slate-200 px-2 py-1 text-slate-600">
                            Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <UserActiveToggle
                          id={user.id}
                          isActive={user.isActive}
                          disabled={isSelf}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
