import Sidebar from "@/components/Sidebar";
import { requireScopedUser, vesselIdWhere } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vesselScopeDayDu } from "@/lib/roles";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireScopedUser();
  // Danh sách tàu cho mục sổ xuống ở thanh bên. Đúng phạm vi của người dùng:
  // người của một tàu chỉ thấy tàu mình, không thấy cả đội.
  const scope = vesselScopeDayDu(user);
  const vessels = await prisma.vessel.findMany({
    where: { ...vesselIdWhere(scope), status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return (
    <div className="flex">
      <Sidebar
        user={{
          name: user.name,
          role: user.role,
          vesselName: user.vessel?.name ?? null,
        }}
        vessels={vessels}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
