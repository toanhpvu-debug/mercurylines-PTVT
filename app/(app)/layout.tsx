import Sidebar from "@/components/Sidebar";
import { requireScopedUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireScopedUser();
  return (
    <div className="flex">
      <Sidebar
        user={{
          name: user.name,
          role: user.role,
          vesselName: user.vessel?.name ?? null,
        }}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
