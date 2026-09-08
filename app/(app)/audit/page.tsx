import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import type { HamDich, HamDichTuDo } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const SO_DONG = 200;

// Tên nghiệp vụ do server action tự ghi → chữ cho người đọc, tra ở từ điển.
// Mã server action của Next là chuỗi băm nên để nguyên, chỉ rút ngắn lại.
const KHOA_VIEC: Record<string, string> = {
  "dang-nhap": "viecDangNhap",
  "chua-dang-nhap": "viecChuaDangNhap",
  "khong-du-quyen": "viecKhongDuQuyen",
  request: "viecGuiBieuMau",
  "phan-cong-doi-tau": "viecPhanCongDoiTau",
  "tao-uy-quyen": "viecTaoUyQuyen",
  "thu-hoi-uy-quyen": "viecThuHoiUyQuyen",
  "duyet-yeu-cau": "viecDuyetYeuCau",
  "tu-choi-yeu-cau": "viecTuChoiYeuCau",
  "xoa-yeu-cau": "viecXoaYeuCau",
  "doi-tai-khoan": "viecDoiTaiKhoan",
  "xoa-tai-khoan": "viecXoaTaiKhoan",
  "doi-ma-phu-tung": "viecDoiMaPhuTung",
};

function nhan(
  action: string | null,
  t: HamDich,
  tTuDo: HamDichTuDo
): string {
  if (!action) return "—";
  const khoa = KHOA_VIEC[action];
  if (khoa) return tTuDo(`vessels.${khoa}`);
  // Mã server action: dài, không có nghĩa với người đọc.
  return action.length > 12
    ? t("vessels.thaoTacMa", { ma: action.slice(0, 8) })
    : action;
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
  const { t, tTuDo, ngayGio, so } = await layT();
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
        <h2 className="text-2xl font-bold text-blue-950">
          {t("vessels.auditTieuDe")}
        </h2>
        <p className="text-slate-600">{t("vessels.auditMoTa")}</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t("vessels.nhanEmailNguoi")}
          </label>
          <input
            name="nguoi"
            defaultValue={nguoi}
            placeholder={t("vessels.phEmailNguoi")}
            className="rounded border p-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t("vessels.nhanNghiepVu")}
          </label>
          <input
            name="viec"
            defaultValue={viec}
            placeholder={t("vessels.phNghiepVu")}
            className="rounded border p-2 text-sm"
          />
        </div>
        <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          {t("chung.loc")}
        </button>
        <span className="text-sm text-slate-500">
          {t("vessels.nDongKhop", { n: so(tong) })}
          {tong > SO_DONG
            ? ` — ${t("vessels.dangHienMoiNhat", { n: SO_DONG })}`
            : ""}
        </span>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
              <th className="p-2 whitespace-nowrap">
                {t("vessels.cotThoiDiem")}
              </th>
              <th className="p-2">{t("vessels.cotNguoiThaoTac")}</th>
              <th className="p-2">{t("vessels.cotViec")}</th>
              <th className="p-2">{t("vessels.cotDuongDan")}</th>
              <th className="p-2">{t("vessels.cotChiTiet")}</th>
              <th className="p-2">{t("vessels.cotKetQua")}</th>
              <th className="p-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {dong.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  {t("vessels.chuaCoNhatKy")}
                </td>
              </tr>
            )}
            {dong.map((d) => (
              <tr key={d.id} className="border-b align-top">
                <td className="p-2 whitespace-nowrap text-slate-600">
                  {ngayGio(d.at)}
                </td>
                <td className="p-2">
                  {d.email ?? "—"}
                  {d.role && (
                    <span className="block text-xs text-slate-500">
                      {tTuDo(`labels.role_${d.role}`)}
                    </span>
                  )}
                  {d.onBehalfOfId && (
                    <span className="block text-xs text-amber-700">
                      {t("vessels.kyThay", {
                        ten:
                          tenTheoId.get(d.onBehalfOfId) ?? `#${d.onBehalfOfId}`,
                      })}
                    </span>
                  )}
                </td>
                <td className="p-2">{nhan(d.action, t, tTuDo)}</td>
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
                      {d.ketQua === "TU_CHOI"
                        ? t("vessels.biTuChoi")
                        : t("vessels.ketQuaLoi")}
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
