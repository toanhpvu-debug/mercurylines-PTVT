import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ROLES, trongPhamVi, vesselScopeDayDu } from "@/lib/roles";
import { BIEU_MAU_TEP, MA_BIEU_MAU_THIET_YEU, MIME_BIEU_MAU_WORD } from "@/lib/bieuMau";
import { dienBieuMauThietYeu, type DuLieuThietYeu } from "@/lib/bieuMauThietYeu";
import { layBangThietYeu } from "@/lib/thietYeuServer";
import { dongInTu, ngayBaoCao, sachBanIn, thangHopLe } from "@/lib/thietYeu";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Xuất báo cáo phụ tùng thiết yếu ra TỆP WORD theo đúng mẫu MLS-11-04 của công
 * ty. Mẫu lấy ở database trước (quản trị tải lên ở Mua sắm → Biểu mẫu), đĩa sau.
 *   - GET ?vessel=<id>&thang=YYYY-MM: số liệu hệ thống (layBangThietYeu, như trang).
 *   - POST { vessel, thang, tenTau, ngay, dong }: BẢN IN người dùng đã sửa tay
 *     trước khi in — chỉ điền vào tệp, không ghi gì vào số liệu hệ thống.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return xuat(Number(url.searchParams.get("vessel")), url.searchParams.get("thang"), null);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;
  const ban = sachBanIn(body);
  if (!ban) return new Response("Bad request", { status: 400 });
  return xuat(Number(o.vessel), typeof o.thang === "string" ? o.thang : null, ban);
}

async function xuat(vesselId: number, thangRaw: string | null, banSua: DuLieuThietYeu | null) {
  const { t } = await layT();
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const thang = thangHopLe(thangRaw);
  if (!Number.isInteger(vesselId) || vesselId <= 0) return new Response("Not found", { status: 404 });
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true, name: true } });
  if (!vessel || !trongPhamVi(vesselScopeDayDu(actor), vessel.id)) return new Response("Not found", { status: 404 });

  const banTrongDb = await prisma.bieuMauTep.findUnique({ where: { code: MA_BIEU_MAU_THIET_YEU }, select: { data: true } });
  let template: Buffer | null = banTrongDb ? Buffer.from(banTrongDb.data) : null;
  if (!template) {
    try {
      template = await readFile(path.join(process.cwd(), "templates", BIEU_MAU_TEP[MA_BIEU_MAU_THIET_YEU].tep));
    } catch {
      template = null;
    }
  }
  if (!template) {
    return new Response(t("thietYeu.thieuBieuMauWord"), { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const du: DuLieuThietYeu =
    banSua ?? { tenTau: vessel.name, ngay: ngayBaoCao(thang), dong: (await layBangThietYeu(vessel.id, thang)).map(dongInTu) };
  const tep = await dienBieuMauThietYeu(template, du);
  await ghiNhatKyNguoiDung(actor, {
    action: "xuat-word-thiet-yeu",
    path: "/materials/thiet-yeu",
    vesselId: vessel.id,
    detail: `Xuất Word MLS-11-04 ${vessel.code} tháng ${thang} — ${du.dong.length} dòng${banSua ? " (bản in đã sửa tay)" : ""}`,
  });
  return new Response(new Uint8Array(tep), {
    headers: {
      "Content-Type": MIME_BIEU_MAU_WORD,
      "Content-Disposition": `attachment; filename="MLS-11-04_${vessel.code}_${thang}.docx"`,
      "Content-Length": String(tep.length),
      "Cache-Control": "private, no-store",
    },
  });
}
