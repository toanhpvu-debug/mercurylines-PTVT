import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { SI_QUAN, trangThaiUyQuyen } from "@/lib/roles";
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
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireScopedUser();
  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const { t, tTuDo, ngay } = await layT();
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
        <h2 className="text-2xl font-bold text-blue-950">
          {t("vessels.nguoiDungTieuDe")}
        </h2>
        <p className="text-slate-600">{t("vessels.nguoiDungMoTa")}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-4 text-lg font-semibold">
            {t("vessels.taoNguoiDungMoi")}
          </h3>
          <UserForm vessels={vesselOptions} />
          <div className="mt-6 rounded bg-slate-50 p-3 text-xs text-slate-600">
            <p className="mb-1 font-semibold">{t("vessels.quyenTheoVaiTro")}</p>
            {["ADMIN", "TECH_MANAGER", "MASTER", "CHIEF_ENGINEER"].map((r) => (
              <p key={r}>
                <b>{tTuDo(`labels.role_${r}`)}</b> —{" "}
                {tTuDo(`vessels.roleDesc_${r}`)}
              </p>
            ))}
            <p>
              <b>
                {SI_QUAN.filter((r) => r !== "CREW")
                  .map((r) => tTuDo(`labels.role_${r}`))
                  .join(", ")}
                , {tTuDo("labels.role_CREW")}
              </b>{" "}
              — {t("vessels.roleDesc_CREW")}
            </p>
            <p className="mt-2 font-semibold">
              {t("vessels.duongDiPheDuyet")}
            </p>
            <p>
              {t("vessels.luongNhap")} <b>{t("vessels.luongTauDuyet")}</b>{" "}
              {t("vessels.luongTauDuyetGhiChu")}{" "}
              <b>{t("vessels.luongCongTyDuyet")}</b>{" "}
              {t("vessels.luongCongTyGhiChu")}
            </p>
            <p className="mt-2 font-semibold">{t("vessels.tauPhuTrach")}</p>
            <p>{t("vessels.ganTauMoTa")}</p>
            <p>{t("vessels.adminToanDoi")}</p>
            <p>{t("vessels.techManagerMoTa")}</p>
            <p>{t("vessels.masterKhongGanTau")}</p>
            <p>{t("vessels.crewKhongGanTau")}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">
            {t("vessels.danhSachNguoiDung")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("vessels.cotHoTen")}</th>
                  <th className="p-2">{t("login.email")}</th>
                  <th className="p-2">{t("vessels.cotVaiTroTau")}</th>
                  <th className="p-2">{t("chung.trangThai")}</th>
                  <th className="p-2">{t("chung.thaoTac")}</th>
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
                            {t("vessels.laBan")}
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
                            {t("vessels.tkHoatDong")}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-200 px-2 py-1 text-slate-600">
                            {t("vessels.tkDaKhoa")}
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
        <h3 className="text-lg font-semibold">
          {t("vessels.phanCongDoiTauTieuDe")}
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          {t("vessels.phanCongMoTa")}
        </p>
        {quanLyKyThuat.length === 0 ? (
          <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
            {t("vessels.chuaCoTaiKhoanVaiTro", {
              ten: tTuDo("labels.role_TECH_MANAGER"),
            })}
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
          <h3 className="text-lg font-semibold">{t("vessels.uyQuyenTieuDe")}</h3>
          <p className="mb-4 text-sm text-slate-600">
            {t("vessels.uyQuyenMoTa1")} <b>{t("vessels.uyQuyenMoTaDam")}</b>{" "}
            {t("vessels.uyQuyenMoTa2")}
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
            {t("vessels.uyQuyenDaLap", { n: uyQuyens.length })}
          </h3>
          {uyQuyens.length === 0 ? (
            <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
              {t("vessels.chuaCoUyQuyen")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border text-sm">
                <thead>
                  <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                    <th className="p-2">{t("vessels.cotNguoiGiaoQuyen")}</th>
                    <th className="p-2">{t("vessels.cotNguoiNhan")}</th>
                    <th className="p-2">{t("vessels.cotThoiHan")}</th>
                    <th className="p-2">{t("vessels.cotLyDo")}</th>
                    <th className="p-2">{t("chung.trangThai")}</th>
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
                            {tTuDo(`labels.role_${u.delegator.role}`)}
                          </span>
                        </td>
                        <td className="p-2">
                          {u.delegate.name}
                          <span className="block text-xs text-slate-500">
                            {tTuDo(`labels.role_${u.delegate.role}`)}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {ngay(u.startAt)} → {ngay(u.endAt)}
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
