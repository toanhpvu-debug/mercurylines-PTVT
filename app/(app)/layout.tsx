import { cookies } from "next/headers";
import { logout } from "@/app/actions";
import AppShell, { type NhomMenu } from "@/components/AppShell";
import { requireScopedUser, vesselIdWhere } from "@/lib/auth";
import { COOKIE_CHU_DE, docChuDe } from "@/lib/chuDe";
import { layT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { vesselScopeDayDu } from "@/lib/roles";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  // Danh sách tàu cho mục sổ xuống ở thanh bên. Đúng phạm vi của người dùng:
  // người của một tàu chỉ thấy tàu mình, không thấy cả đội.
  const scope = vesselScopeDayDu(user);
  const [vessels, kho] = await Promise.all([
    prisma.vessel.findMany({
      where: { ...vesselIdWhere(scope), status: "ACTIVE" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    cookies(),
  ]);

  // Menu chia nhóm theo cách người trên tàu nghĩ về công việc, không theo thứ
  // tự trang được viết ra. Nhãn dịch ở đây (server) rồi trao xuống vỏ client;
  // biểu tượng chỉ truyền TÊN, vỏ client tự tra bộ lucide.
  const nhom: NhomMenu[] = [
    {
      label: t("menu.nhomVanHanh"),
      items: [
        { href: "/dashboard", label: t("menu.dashboard"), icon: "dashboard", end: true },
        { href: "/vessels", label: t("menu.doiTau"), icon: "fleet", doiTau: true },
        { href: "/materials", label: t("menu.vatTu"), icon: "materials" },
        { href: "/inventory", label: t("menu.tonKho"), icon: "inventory" },
      ],
    },
    {
      label: t("menu.nhomYeuCauMuaSam"),
      items: [
        { href: "/requests", label: t("menu.yeuCau"), icon: "requests" },
        { href: "/purchasing", label: t("menu.muaSam"), icon: "purchasing" },
        { href: "/reports", label: t("menu.baoCao"), icon: "reports" },
      ],
    },
    {
      label: t("menu.nhomChuyenNganh"),
      items: [
        { href: "/paint", label: t("menu.son"), icon: "paint" },
        { href: "/consumables", label: t("menu.dauHoaChat"), icon: "consumables" },
        { href: "/lashing", label: t("menu.changBuoc"), icon: "lashing" },
        { href: "/documents", label: t("menu.baoCaoTuTau"), icon: "documents" },
      ],
    },
    ...(user.role === "ADMIN"
      ? [
          {
            label: t("menu.nhomQuanTri"),
            items: [
              { href: "/users", label: t("menu.nguoiDung"), icon: "users" as const },
              { href: "/audit", label: t("menu.nhatKy"), icon: "audit" as const },
            ],
          },
        ]
      : []),
  ];

  const phamVi =
    user.role === "ADMIN"
      ? t("menu.phamViToanDoi")
      : user.vessel?.name
        ? t("menu.tau", { ten: user.vessel.name })
        : user.role === "CREW"
          ? t("menu.chuaGanTau")
          : t("menu.phamViToanDoi");

  return (
    <AppShell
      nhom={nhom}
      tau={vessels}
      taiKhoan={{
        name: user.name,
        vaiTro: tTuDo(`labels.role_${user.role}`),
        phamVi,
      }}
      nhan={{
        heThong: t("chung.moTaApp"),
        dangXuat: t("menu.dangXuat"),
        tatCaDoiTau: t("menu.tatCaDoiTau"),
        moMenu: t("menu.moMenu"),
        dongMenu: t("menu.dongMenu"),
        cheDoSang: t("menu.cheDoSang"),
        cheDoToi: t("menu.cheDoToi"),
      }}
      chuDeBanDau={docChuDe(kho.get(COOKIE_CHU_DE)?.value)}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
