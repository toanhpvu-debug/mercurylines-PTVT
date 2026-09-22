import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScopeDayDu } from "@/lib/auth";
import { ROLES, trongPhamVi } from "@/lib/roles";
import { BIEU_MAU_TEP, MA_BIEU_MAU_CHANG_BUOC, MIME_BIEU_MAU_WORD } from "@/lib/bieuMau";
import { dienBieuMauChangBuoc, type DongChangBuoc } from "@/lib/bieuMauChangBuoc";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Xuất báo cáo dụng cụ chằng buộc ra TỆP WORD theo đúng mẫu MLS-11-13 của công
 * ty. Số liệu và cách tính (tổng, thiếu, yêu cầu) y hệt trang in
 * app/(app)/lashing/[id]/page.tsx — hai nơi phải ra cùng một con số.
 *
 * Mẫu lấy ở database trước (quản trị tải lên ở Mua sắm → Biểu mẫu), đĩa sau
 * (templates/, cho máy văn phòng). Không có thì báo rõ thay vì tự vẽ: tệp Word
 * dựng lại không bao giờ giống mẫu công ty bằng chính tệp mẫu.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { t } = await layT();
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) return new Response("Not found", { status: 404 });
  const report = await prisma.lashingReport.findUnique({
    where: { id: reportId },
    include: { vessel: true, lines: { include: { gear: true } } },
  });
  if (!report || !trongPhamVi(vesselScopeDayDu(actor), report.vesselId)) return new Response("Not found", { status: 404 });

  const banTrongDb = await prisma.bieuMauTep.findUnique({ where: { code: MA_BIEU_MAU_CHANG_BUOC }, select: { data: true } });
  let template: Buffer | null = banTrongDb ? Buffer.from(banTrongDb.data) : null;
  if (!template) {
    try {
      template = await readFile(path.join(process.cwd(), "templates", BIEU_MAU_TEP[MA_BIEU_MAU_CHANG_BUOC].tep));
    } catch {
      template = null;
    }
  }
  if (!template) {
    return new Response(t("vessels.thieuBieuMauWord"), {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const lines = [...report.lines].sort((a, b) => a.gear.sortOrder - b.gear.sortOrder);
  const dong: DongChangBuoc[] = lines.map((line, i) => ({
    stt: i + 1,
    ten: line.gearName,
    kyHieu: line.partNo ?? "",
    toiThieu: line.minQty,
    chuan: line.standardQty,
    conDung: line.inOrder,
    hong: line.outOfOrder,
    tong: line.inOrder + line.outOfOrder,
    thieu: Math.max(0, line.minQty - line.inOrder),
    yeuCau: Math.max(0, line.standardQty - line.inOrder),
  }));
  const d = report.reportDate;
  const ngay = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const tep = await dienBieuMauChangBuoc(template, {
    tenTau: report.vessel.name,
    cang: report.position ?? "",
    ngay,
    dong,
  });

  await ghiNhatKyNguoiDung(actor, {
    action: "xuat-word-chang-buoc",
    path: `/lashing/${report.id}`,
    vesselId: report.vesselId,
    detail: `Xuất Word MLS-11-13 báo cáo #${report.id} (${report.vessel.code}, ${ngay}) — ${dong.length} dòng`,
  });
  const tenTep = `MLS-11-13_${report.vessel.code}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.docx`;
  return new Response(new Uint8Array(tep), {
    headers: {
      "Content-Type": MIME_BIEU_MAU_WORD,
      "Content-Disposition": `attachment; filename="${tenTep}"`,
      "Content-Length": String(tep.length),
      "Cache-Control": "private, no-store",
    },
  });
}
