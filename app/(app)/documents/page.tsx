import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
  vesselWhere,
} from "@/lib/auth";
import DocumentUploadForm from "@/components/DocumentUploadForm";
import DocumentDeleteButton from "@/components/DocumentDeleteButton";

export const dynamic = "force-dynamic";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function DocumentsPage() {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canDelete = user.role === "ADMIN";
  const [vessels, documents] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.reportDocument.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      include: {
        vessel: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">Báo cáo từ tàu</h2>
        <p className="text-slate-600">
          Tải lên file báo cáo vật tư (PDF / Excel) — bản lưu bất biến, có mã
          toàn vẹn SHA-256
        </p>
      </div>

      {scope.unassigned ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách nên chưa thể tải báo cáo lên. Vui
          lòng liên hệ quản trị viên.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">Tải báo cáo lên</h3>
            <DocumentUploadForm vessels={vessels} />
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
            <h3 className="mb-4 text-lg font-semibold">
              Hồ sơ đã lưu ({documents.length})
            </h3>
            {documents.length === 0 ? (
              <p className="text-slate-600">Chưa có báo cáo nào được tải lên.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">Ngày tải</th>
                      <th className="p-2">Tàu</th>
                      <th className="p-2">Loại</th>
                      <th className="p-2">Kỳ</th>
                      <th className="p-2">Tiêu đề / File</th>
                      <th className="p-2">Cỡ</th>
                      <th className="p-2">Người tải</th>
                      <th className="p-2">SHA-256</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b align-top">
                        <td className="p-2 whitespace-nowrap">
                          {doc.createdAt.toLocaleDateString("vi-VN")}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <Link
                            href={`/vessels/${doc.vessel.id}`}
                            className="text-blue-700 hover:underline"
                          >
                            {doc.vessel.code}
                          </Link>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {doc.reportType}
                        </td>
                        <td className="p-2 whitespace-nowrap">{doc.period}</td>
                        <td className="p-2">
                          <p className="font-medium">{doc.title}</p>
                          {doc.title !== doc.fileName && (
                            <p className="text-xs text-slate-500">
                              {doc.fileName}
                            </p>
                          )}
                          {doc.note && (
                            <p className="text-xs text-slate-500">
                              Ghi chú: {doc.note}
                            </p>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatSize(doc.size)}
                        </td>
                        <td className="p-2">{doc.uploadedBy.name}</td>
                        <td className="p-2">
                          <span
                            className="font-mono text-xs text-slate-500"
                            title={doc.sha256}
                          >
                            {doc.sha256.slice(0, 12)}…
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/documents/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                            >
                              Xem / Tải
                            </a>
                            {canDelete && (
                              <DocumentDeleteButton
                                id={doc.id}
                                fileName={doc.fileName}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              File đã tải lên không thể chỉnh sửa hay thay thế — mọi bản nộp
              đều được lưu vĩnh viễn kèm mã SHA-256 để đối chiếu toàn vẹn. Chỉ
              quản trị viên công ty có quyền xóa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
