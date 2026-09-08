import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions";
import ChonNgonNgu from "@/components/ChonNgonNgu";
import { MercuryMark } from "@/components/MercuryLogo";
import NhomDoiTau, { type TauTrongMenu } from "@/components/NhomDoiTau";
import { layT } from "@/lib/i18n/server";
import type { KhoaDich } from "@/lib/i18n/tuDien";

// "Đội tàu" không nằm trong mảng này: nó là mục sổ xuống, dựng riêng ở dưới
// để chèn đúng vị trí thứ hai như cũ. Nhãn là KHÓA từ điển, dịch lúc dựng.
const linksTruoc: { href: string; khoa: KhoaDich; icon: string }[] = [
  { href: "/dashboard", khoa: "menu.dashboard", icon: "▦" },
];

const links: { href: string; khoa: KhoaDich; icon: string }[] = [
  { href: "/materials", khoa: "menu.vatTu", icon: "🧰" },
  { href: "/inventory", khoa: "menu.tonKho", icon: "📦" },
  { href: "/requests", khoa: "menu.yeuCau", icon: "📝" },
  { href: "/purchasing", khoa: "menu.muaSam", icon: "🛒" },
  { href: "/reports", khoa: "menu.baoCao", icon: "📊" },
  { href: "/paint", khoa: "menu.son", icon: "🎨" },
  { href: "/consumables", khoa: "menu.dauHoaChat", icon: "🛢️" },
  { href: "/lashing", khoa: "menu.changBuoc", icon: "🔗" },
  { href: "/documents", khoa: "menu.baoCaoTuTau", icon: "📄" },
];

const linksAdmin: { href: string; khoa: KhoaDich; icon: string }[] = [
  { href: "/users", khoa: "menu.nguoiDung", icon: "👥" },
  { href: "/audit", khoa: "menu.nhatKy", icon: "🕵" },
];

const kieuDong =
  "group flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-blue-100/90 transition hover:border-sky-400 hover:bg-white/10 hover:text-white";

export default async function Sidebar({
  user,
  vessels,
}: {
  user: { name: string; role: string; vesselName: string | null };
  /** Các tàu trong phạm vi của người đang đăng nhập — để sổ ở mục "Đội tàu". */
  vessels: TauTrongMenu[];
}) {
  const { t, tTuDo } = await layT();
  const MucMenu = ({ href, khoa, icon }: { href: string; khoa: KhoaDich; icon: string }) => (
    <Link href={href} className={kieuDong}>
      <span className="w-5 text-center text-base opacity-80 group-hover:opacity-100">
        {icon}
      </span>
      {t(khoa)}
    </Link>
  );
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
          <p className="text-xs text-sky-300/80">{t("menu.heThong")}</p>
        </div>
      </div>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-sky-400/70">
        {t("menu.nghiepVu")}
      </p>
      <nav className="space-y-1">
        {linksTruoc.map((link) => (
          <MucMenu key={link.href} {...link} />
        ))}
        <NhomDoiTau vessels={vessels} />
        {links.map((link) => (
          <MucMenu key={link.href} {...link} />
        ))}
        {user.role === "ADMIN" &&
          linksAdmin.map((link) => <MucMenu key={link.href} {...link} />)}
      </nav>
      <div className="mt-auto space-y-3">
        {/* Đổi ngôn ngữ đặt ngay trên thẻ tài khoản: là lựa chọn của người
            dùng, không phải một mục nghiệp vụ. */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-blue-200/70">{t("chung.ngonNgu")}</span>
          <Suspense>
            <ChonNgonNgu toi />
          </Suspense>
        </div>
        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-xs text-sky-300">
            {tTuDo(`labels.role_${user.role}`)}
          </p>
          <p className="mb-3 text-xs text-blue-200/70">
            {user.role === "ADMIN"
              ? t("menu.phamViToanDoi")
              : user.vesselName
                ? t("menu.tau", { ten: user.vesselName })
                : user.role === "CREW"
                  ? t("menu.chuaGanTau")
                  : t("menu.phamViToanDoi")}
          </p>
          <form action={logout}>
            <button className="w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-blue-100 transition hover:border-sky-400 hover:bg-sky-500/20 hover:text-white">
              {t("menu.dangXuat")}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
