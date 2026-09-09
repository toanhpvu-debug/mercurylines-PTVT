import { redirect } from "next/navigation";
import {
  ArrowRight,
  History,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
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
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/** Vai trò có mô tả quyền riêng, xếp theo thứ tự quyền giảm dần. */
const VAI_TRO_CO_MO_TA = [
  "ADMIN",
  "TECH_MANAGER",
  "MASTER",
  "CHIEF_ENGINEER",
] as const;

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
    <div className="space-y-5">
      <PageHeader
        title={t("vessels.nguoiDungTieuDe")}
        subtitle={t("vessels.nguoiDungMoTa")}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<UserPlus className="size-4" />}
              title={t("vessels.taoNguoiDungMoi")}
            />
            <UserForm vessels={vesselOptions} />
          </Card>
          {/* Bảng tra quyền — trước đây là một hộp màu nhồi chữ; giờ là danh
              sách định nghĩa, đọc theo cặp "vai trò — làm được gì". */}
          <Card>
            <CardHeader
              icon={<ShieldCheck className="size-4" />}
              title={t("vessels.quyenTheoVaiTro")}
            />
            <dl className="space-y-2 text-xs">
              {VAI_TRO_CO_MO_TA.map((r) => (
                <div
                  key={r}
                  className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3"
                >
                  <dt className="font-medium text-[var(--text-primary)]">
                    {tTuDo(`labels.role_${r}`)}
                  </dt>
                  <dd className="text-[var(--text-secondary)]">
                    {tTuDo(`vessels.roleDesc_${r}`)}
                  </dd>
                </div>
              ))}
              <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                <dt className="font-medium text-[var(--text-primary)]">
                  {SI_QUAN.filter((r) => r !== "CREW")
                    .map((r) => tTuDo(`labels.role_${r}`))
                    .join(", ")}
                  , {tTuDo("labels.role_CREW")}
                </dt>
                <dd className="text-[var(--text-secondary)]">
                  {t("vessels.roleDesc_CREW")}
                </dd>
              </div>
            </dl>

            <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              {t("vessels.duongDiPheDuyet")}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span>{t("vessels.luongNhap")}</span>
              <ArrowRight className="size-3.5 shrink-0 text-[var(--text-muted)]" />
              <span>
                <b className="font-semibold text-[var(--text-primary)]">
                  {t("vessels.luongTauDuyet")}
                </b>{" "}
                {t("vessels.luongTauDuyetGhiChu")}
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-[var(--text-muted)]" />
              <span>
                <b className="font-semibold text-[var(--text-primary)]">
                  {t("vessels.luongCongTyDuyet")}
                </b>{" "}
                {t("vessels.luongCongTyGhiChu")}
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-[var(--text-muted)]" />
              <span>{t("vessels.luongMuaSam")}</span>
            </div>

            <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              {t("vessels.tauPhuTrach")}
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-[var(--text-secondary)]">
              <li>{t("vessels.ganTauMoTa")}</li>
              <li>{t("vessels.adminToanDoi")}</li>
              <li>{t("vessels.techManagerMoTa")}</li>
              <li>{t("vessels.masterKhongGanTau")}</li>
              <li>{t("vessels.crewKhongGanTau")}</li>
            </ul>
          </Card>
        </div>
        <Card className="xl:col-span-2">
          <CardHeader
            icon={<Users className="size-4" />}
            title={t("vessels.danhSachNguoiDung")}
          />
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotHoTen")}</Th>
                  <Th>{t("login.email")}</Th>
                  <Th>{t("vessels.cotVaiTroTau")}</Th>
                  <Th>{t("chung.trangThai")}</Th>
                  <Th>{t("chung.thaoTac")}</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  return (
                    <Tr
                      key={user.id}
                      className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={user.name} size={28} />
                          <span className="font-medium">
                            {user.name}
                            {isSelf && (
                              <span className="ml-1 text-xs text-[var(--text-muted)]">
                                {t("vessels.laBan")}
                              </span>
                            )}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-[var(--text-secondary)]">
                        {user.email}
                      </Td>
                      <Td>
                        <UserRoleForm
                          id={user.id}
                          role={user.role}
                          rankCode={user.rankCode}
                          vesselId={user.vesselId}
                          vessels={vesselOptions}
                          disabled={isSelf}
                        />
                      </Td>
                      <Td>
                        <Badge tone={user.isActive ? "success" : "danger"} dot>
                          {user.isActive
                            ? t("vessels.tkHoatDong")
                            : t("vessels.tkDaKhoa")}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
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
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<Users className="size-4" />}
          title={t("vessels.phanCongDoiTauTieuDe")}
          subtitle={t("vessels.phanCongMoTa")}
        />
        {quanLyKyThuat.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={t("vessels.chuaCoTaiKhoanVaiTro", {
              ten: tTuDo("labels.role_TECH_MANAGER"),
            })}
          />
        ) : (
          <div className="space-y-4">
            {quanLyKyThuat.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-[var(--border-subtle)] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Avatar name={u.name} size={28} />
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {u.name}{" "}
                    <span className="font-normal text-[var(--text-muted)]">
                      {u.email}
                    </span>
                  </p>
                </div>
                <PhanCongDoiTau
                  user={{ id: u.id, name: u.name, email: u.email, role: u.role }}
                  vessels={vesselOptions}
                  daChon={u.fleetAssignments.map((f) => f.vesselId)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<ShieldCheck className="size-4" />}
            title={t("vessels.uyQuyenTieuDe")}
            subtitle={
              <>
                {t("vessels.uyQuyenMoTa1")}{" "}
                <b className="font-semibold text-[var(--text-primary)]">
                  {t("vessels.uyQuyenMoTaDam")}
                </b>{" "}
                {t("vessels.uyQuyenMoTa2")}
              </>
            }
          />
          <LapUyQuyen
            nguoiCoQuyen={nguoiDangHoatDong}
            nguoiNhan={nguoiDangHoatDong}
            laAdmin
            toiId={currentUser.id}
          />
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            icon={<History className="size-4" />}
            title={t("vessels.uyQuyenDaLap", { n: uyQuyens.length })}
          />
          {uyQuyens.length === 0 ? (
            <EmptyState
              icon={<History className="size-5" />}
              title={t("vessels.chuaCoUyQuyen")}
            />
          ) : (
            <TableWrap>
              <Table dense>
                <thead>
                  <tr>
                    <Th>{t("vessels.cotNguoiGiaoQuyen")}</Th>
                    <Th>{t("vessels.cotNguoiNhan")}</Th>
                    <Th>{t("vessels.cotThoiHan")}</Th>
                    <Th>{t("vessels.cotLyDo")}</Th>
                    <Th>{t("chung.trangThai")}</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {uyQuyens.map((u) => {
                    const trangThai = trangThaiUyQuyen(u, bayGio);
                    const conHieuLuc =
                      trangThai === "HIEU_LUC" || trangThai === "CHUA_TOI";
                    return (
                      <Tr
                        key={u.id}
                        className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                      >
                        <Td>
                          {u.delegator.name}
                          <span className="block text-xs text-[var(--text-muted)]">
                            {tTuDo(`labels.role_${u.delegator.role}`)}
                          </span>
                        </Td>
                        <Td>
                          {u.delegate.name}
                          <span className="block text-xs text-[var(--text-muted)]">
                            {tTuDo(`labels.role_${u.delegate.role}`)}
                          </span>
                        </Td>
                        <Td className="tabular whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {ngay(u.startAt)}
                            <ArrowRight className="size-3.5 shrink-0 text-[var(--text-muted)]" />
                            {ngay(u.endAt)}
                          </span>
                        </Td>
                        <Td className="text-[var(--text-secondary)]">
                          {u.reason ?? "—"}
                        </Td>
                        <Td>
                          <NhanTrangThaiUyQuyen
                            trangThai={trangThai}
                            revokedAt={u.revokedAt}
                          />
                        </Td>
                        <Td>{conHieuLuc && <ThuHoiUyQuyen id={u.id} />}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
