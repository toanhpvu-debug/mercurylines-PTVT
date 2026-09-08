import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

const SO_DONG = 200;

// Tên nghiệp vụ do server action tự ghi → chữ tiếng Việt cho người đọc.
// Mã server action của Next là chuỗi băm nên để nguyên, chỉ rút ngắn lại.
const TEN_VIEC: Record<string, string> = {
  "dang-nhap": "Đăng nhập",
  "chua-dang-nhap": "Chưa đăng nhập",
  "khong-du-quyen": "Vào đường dẫn không đủ quyền",
  request: "Gửi biểu mẫu",
  "phan-cong-doi-tau": "Phân công đội tàu",
  "tao-uy-quyen": "Lập ủy quyền",
  "thu-hoi-uy-quyen": "Thu hồi ủy quyền",
  "duyet-yeu-cau": "Duyệt yêu cầu vật tư",
  "tu-choi-yeu-cau": "Từ chối yêu cầu vật tư",
  "xoa-yeu-cau": "Xóa yêu cầu vật tư",
  "doi-tai-khoan": "Đổi email / mật khẩu tài khoản",
  "xoa-tai-khoan": "Xóa tài khoản",
  "doi-ma-phu-tung": "Đổi mã phụ tùng",
};

function nhan(action: string | null): string {
  if (!action) return "—";
  if (TEN_VIEC[action]) return TEN_VIEC[action];
  // Mã server action: dài, không có nghĩa với người đọc.
  return action.length > 12 ? `Thao tác (${action.slice(0, 8)}…)` : action;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ nguoi?: string; viec?: string }>;
}) {
  const me = await requireScopedUser();
  // Nhật ký là hồ sơ kiểm soát nội bộ: chỉ quản trị đọc. proxy.ts cũng chặn
  // đường dẫn này một lần nữa để gõ thẳng URL không lọt.
  if (me.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const sp = await searchParams;
  const nguoi = (sp.nguoi ?? "").trim();
  const viec = (sp.viec ?? "").trim();

  const where = {
    ...(nguoi ? { email: { contains: nguoi, mode: "insensitive" as const } } : {}),
    ...(viec ? { action: { contains: viec } } : {}),
  };

  const [dong, tong, nguoiDung] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      take: SO_DONG,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
    }),
  ]);
  const tenTheoId = new Map(nguoiDung.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">Nhật ký thao tác</h2>
        <p className="text-slate-600">
          Mọi request làm thay đổi dữ liệu đều được ghi lại — ai, lúc nào, từ máy
          nào, và kết quả ra sao.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Email người thao tác
          </label>
          <input
            name="nguoi"
            defaultValue={nguoi}
            placeholder="vd: admin@"
            className="rounded border p-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Nghiệp vụ
          </label>
          <input
            name="viec"
            defaultValue={viec}
            placeholder="vd: uy-quyen"
            className="rounded border p-2 text-sm"
          />
        </div>
        <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          Lọc
        </button>
        <span className="text-sm text-slate-500">
          {tong.toLocaleString("vi-VN")} dòng khớp
          {tong > SO_DONG ? ` — đang hiện ${SO_DONG} dòng mới nhất` : ""}
        </span>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
              <th className="p-2 whitespace-nowrap">Thời điểm</th>
              <th className="p-2">Người thao tác</th>
              <th className="p-2">Việc</th>
              <th className="p-2">Đường dẫn</th>
              <th className="p-2">Chi tiết</th>
              <th className="p-2">Kết quả</th>
              <th className="p-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {dong.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  Chưa có dòng nhật ký nào khớp.
                </td>
              </tr>
            )}
            {dong.map((d) => (
              <tr key={d.id} className="border-b align-top">
                <td className="p-2 whitespace-nowrap text-slate-600">
                  {d.at.toLocaleString("vi-VN")}
                </td>
                <td className="p-2">
                  {d.email ?? "—"}
                  {d.role && (
                    <span className="block text-xs text-slate-500">
                      {ROLE_LABEL[d.role] ?? d.role}
                    </span>
                  )}
                  {d.onBehalfOfId && (
                    <span className="block text-xs text-amber-700">
                      ký thay {tenTheoId.get(d.onBehalfOfId) ?? `#${d.onBehalfOfId}`}
                    </span>
                  )}
                </td>
                <td className="p-2">{nhan(d.action)}</td>
                <td className="p-2 font-mono text-xs text-slate-600">
                  {d.method} {d.path}
                </td>
                <td className="p-2 text-slate-600">{d.detail ?? "—"}</td>
                <td className="p-2">
                  {d.ketQua === "OK" ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      OK
                    </span>
                  ) : (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      {d.ketQua === "TU_CHOI" ? "Bị từ chối" : "Lỗi"}
                    </span>
                  )}
                </td>
                <td className="p-2 font-mono text-xs text-slate-500">
                  {d.ip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
