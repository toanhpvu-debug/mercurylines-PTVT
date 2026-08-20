import Link from "next/link";
import { logout } from "@/app/actions";
import { MercuryMark } from "@/components/MercuryLogo";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/vessels", label: "Đội tàu", icon: "⚓" },
  { href: "/materials", label: "Vật tư", icon: "🧰" },
  { href: "/inventory", label: "Tồn kho", icon: "📦" },
  { href: "/requests", label: "Yêu cầu vật tư", icon: "📝" },
  { href: "/purchasing", label: "Mua sắm (Purchasing)", icon: "🛒" },
  { href: "/reports", label: "Báo cáo vật tư", icon: "📊" },
  { href: "/lashing", label: "Chằng buộc container", icon: "🔗" },
  { href: "/documents", label: "Báo cáo từ tàu", icon: "📄" },
];

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MASTER: "Thuyền trưởng",
  CREW: "Thuyền viên",
};

export default function Sidebar({
  user,
}: {
  user: { name: string; role: string; vesselName: string | null };
}) {
  return (
    <aside className="flex min-h-screen w-64 flex-col bg-gradient-to-b from-[#0a1f44] via-[#0c2a5c] to-[#0a1f44] p-4 text-blue-50">
      <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg shadow-blue-950/50">
          <MercuryMark className="h-full w-auto" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-white">
            Mercury Lines
          </h1>
          <p className="text-xs text-sky-300/80">Fleet Inventory System</p>
        </div>
      </div>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-sky-400/70">
        Nghiệp vụ
      </p>
      <nav className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-blue-100/90 transition hover:border-sky-400 hover:bg-white/10 hover:text-white"
          >
            <span className="w-5 text-center text-base opacity-80 group-hover:opacity-100">
              {link.icon}
            </span>
            {link.label}
          </Link>
        ))}
        {user.role === "ADMIN" && (
          <Link
            href="/users"
            className="group flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-blue-100/90 transition hover:border-sky-400 hover:bg-white/10 hover:text-white"
          >
            <span className="w-5 text-center text-base opacity-80 group-hover:opacity-100">
              👥
            </span>
            Người dùng
          </Link>
        )}
      </nav>
      <div className="mt-auto rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
        <p className="font-medium text-white">{user.name}</p>
        <p className="text-xs text-sky-300">
          {roleLabels[user.role] ?? user.role}
        </p>
        <p className="mb-3 text-xs text-blue-200/70">
          {user.role === "ADMIN"
            ? "Phạm vi: toàn đội"
            : user.vesselName
              ? `Tàu: ${user.vesselName}`
              : user.role === "CREW"
                ? "Chưa được gán tàu"
                : "Phạm vi: toàn đội"}
        </p>
        <form action={logout}>
          <button className="w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-blue-100 transition hover:border-sky-400 hover:bg-sky-500/20 hover:text-white">
            Đăng xuất
          </button>
        </form>
      </div>
    </aside>
  );
}
