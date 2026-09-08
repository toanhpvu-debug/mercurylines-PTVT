import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import {
  ROLE_DESC,
  ROLE_LABEL,
  SI_QUAN,
  trangThaiUyQuyen,
} from "@/lib/roles";
import UserForm from "@/components/UserForm";
import {
  UserActiveToggle,
  UserDeleteButton,
  UserRoleForm,
} from "@/components/UserRowActions";
import {
  LapUyQuyen,
  NhanTrangThaiUyQuyen,
  PhanCongDoiTau,
  ThuHoiUyQuyen,
} from "@/components/QuyenNangCao";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireScopedUser();
  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const [users, vessels, uyQuyens] = await Promise.all([
    prisma.user.findMany({
      orderBy: { id: "asc" },
      include: { vessel: true, fleetAssignments: { select: { vesselId: true } } },
    }),
    prisma.vessel.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Lấy cả ủy quyền đã hết hạn / đã thu hồi: hồ sơ phải trả lời được "ngày
    // đó ai có quyền ký thay ai", nên không giấu bớt dòng cũ đi.
    prisma.delegation.findMany({
      orderBy: [{ revokedAt: "asc" }, { endAt: "desc" }],
      take: 50,
      include: {
        delegator: { select: { id: true, name: true, email: true, role: true } },
        delegate: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);
  // Một mốc thời gian dùng chung cho cả bảng: mỗi dòng tự lấy giờ riêng thì
  // hai dòng cạnh nhau có thể rơi vào hai phía của cùng một mốc hết hạn.
  const bayGio = new Date();
  const quanLyKyThuat = users.filter((u) => u.role === "TECH_MANAGER");
  const nguoiDangHoatDong = users
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
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
            {["ADMIN", "TECH_MANAGER", "MASTER", "CHIEF_ENGINEER"].map((r) => (
              <p key={r}>
                <b>{ROLE_LABEL[r]}</b> — {ROLE_DESC[r]}
              </p>
            ))}
            <p>
              <b>
                {SI_QUAN.filter((r) => r !== "CREW")
                  .map((r) => ROLE_LABEL[r])
                  .join(", ")}
                , Thuyền viên
              </b>{" "}
              — lập và trình yêu cầu vật tư của tàu mình. Không duyệt.
            </p>
            <p className="mt-2 font-semibold">Đường đi phê duyệt yêu cầu:</p>
            <p>
              Nháp → <b>tàu duyệt</b> (thuyền trưởng, hoặc máy trưởng với bộ
              phận Máy/Điện) → <b>công ty duyệt</b> (quản lý kỹ thuật) → mua sắm
            </p>
            <p className="mt-2 font-semibold">Tàu phụ trách:</p>
            <p>Gán tàu: chỉ thấy và thao tác trên tàu đó</p>
            <p>ADMIN: luôn toàn đội</p>
            <p>
              TECH_MANAGER: toàn đội, trừ khi được phân công đội tàu riêng ở
              bảng dưới
            </p>
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
                          rankCode={user.rankCode}
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
                        <div className="flex items-center gap-2">
                          <UserActiveToggle
                            id={user.id}
                            isActive={user.isActive}
                            disabled={isSelf}
                          />
                          <UserDeleteButton
                            id={user.id}
                            email={user.email}
                            disabled={isSelf}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="text-lg font-semibold">Phân công đội tàu cho văn phòng</h3>
        <p className="mb-4 text-sm text-slate-600">
          Quản lý kỹ thuật chỉ thấy — và chỉ duyệt được — yêu cầu của những tàu
          mình phụ trách. Không phân công tàu nào thì giữ nguyên toàn đội.
        </p>
        {quanLyKyThuat.length === 0 ? (
          <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
            Chưa có tài khoản {ROLE_LABEL.TECH_MANAGER} nào.
          </p>
        ) : (
          <div className="space-y-5">
            {quanLyKyThuat.map((u) => (
              <div key={u.id} className="rounded border border-slate-200 p-4">
                <p className="mb-2 font-medium">
                  {u.name}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    {u.email}
                  </span>
                </p>
                <PhanCongDoiTau
                  user={{ id: u.id, name: u.name, email: u.email, role: u.role }}
                  vessels={vesselOptions}
                  daChon={u.fleetAssignments.map((f) => f.vesselId)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="text-lg font-semibold">Ủy quyền khi nghỉ ca</h3>
          <p className="mb-4 text-sm text-slate-600">
            Người nhận giữ nguyên chức danh của mình, chỉ <b>mượn thêm</b> quyền
            của người ủy quyền trong khoảng thời gian đã khai. Nhật ký ghi rõ ký
            thay ai.
          </p>
          <LapUyQuyen
            nguoiCoQuyen={nguoiDangHoatDong}
            nguoiNhan={nguoiDangHoatDong}
            laAdmin
            toiId={currentUser.id}
          />
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">
            Ủy quyền đã lập ({uyQuyens.length})
          </h3>
          {uyQuyens.length === 0 ? (
            <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
              Chưa có ủy quyền nào.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border text-sm">
                <thead>
                  <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                    <th className="p-2">Người giao quyền</th>
                    <th className="p-2">Người nhận</th>
                    <th className="p-2">Thời hạn</th>
                    <th className="p-2">Lý do</th>
                    <th className="p-2">Trạng thái</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {uyQuyens.map((u) => {
                    const trangThai = trangThaiUyQuyen(u, bayGio);
                    const conHieuLuc =
                      trangThai === "HIEU_LUC" || trangThai === "CHUA_TOI";
                    return (
                      <tr key={u.id} className="border-b align-top">
                        <td className="p-2">
                          {u.delegator.name}
                          <span className="block text-xs text-slate-500">
                            {ROLE_LABEL[u.delegator.role] ?? u.delegator.role}
                          </span>
                        </td>
                        <td className="p-2">
                          {u.delegate.name}
                          <span className="block text-xs text-slate-500">
                            {ROLE_LABEL[u.delegate.role] ?? u.delegate.role}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {u.startAt.toLocaleDateString("vi-VN")} →{" "}
                          {u.endAt.toLocaleDateString("vi-VN")}
                        </td>
                        <td className="p-2 text-slate-600">{u.reason ?? "—"}</td>
                        <td className="p-2">
                          <NhanTrangThaiUyQuyen
                            trangThai={trangThai}
                            revokedAt={u.revokedAt}
                          />
                        </td>
                        <td className="p-2">
                          {conHieuLuc && <ThuHoiUyQuyen id={u.id} />}
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
    </div>
  );
}
