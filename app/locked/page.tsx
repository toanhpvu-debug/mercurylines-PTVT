import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LockedPage() {
  const user = await getCurrentUser();
  if (user && user.isActive) {
    redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow">
        <h1 className="mb-2 text-xl font-bold text-red-600">
          Tài khoản không khả dụng
        </h1>
        <p className="mb-6 text-slate-600">
          Tài khoản của bạn đã bị khóa hoặc không còn tồn tại. Vui lòng liên hệ
          quản trị viên.
        </p>
        <form action={logout}>
          <button className="w-full rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
