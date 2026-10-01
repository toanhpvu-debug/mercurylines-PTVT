"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselIdWhere, vesselScopeDayDu } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU } from "@/lib/roles";
import { tauTuTenTep } from "@/lib/kiemKe";
import { MAX_UPLOAD_BYTES, ensureUploadDir, fileExtension, getUploadDir } from "@/lib/uploads";
import { DUOI_YEU_CAU, dauTuAiYeuCau, dongTuAiYeuCau, gopDauYeuCau, type DauYeuCauFile, type DongYeuCauFile } from "@/lib/yeuCauNhap";

/*
 * YÊU CẦU NHANH TỪ FILE MLS-11-05B / MLS-11-05A:
 *   1. taiFileYeuCau — lưu file, đọc đầu phiếu + dòng (Word / Excel / PDF có chữ
 *      đọc ngay; PDF scan để bộ đọc AI đọc nền), nhận ra tàu, rồi chuyển về
 *      /requests?tuTep=<id> — trang ghép dòng với danh mục và điền sẵn form.
 *   2. Người lập soát form và bấm tạo như mọi yêu cầu khác (POST
 *      /api/material-requests kèm tuTep → ghi requestId vào file).
 *   3. boFileYeuCau — bỏ file chưa dùng.
 * Chưa có gì được ghi vào yêu cầu / danh mục cho tới khi người lập bấm tạo.
 */

export type KetQuaYeuCauTep = { message: string; success?: boolean };

const TIEN_TO_TEP = "yeu-cau-";

type NguoiThaoTac = { id: number; email: string; role: string; name: string };

const loaiTepCua = (ext: string) => (ext === ".pdf" ? "PDF" : ext === ".xlsx" || ext === ".xls" ? "EXCEL" : "WORD");

/** Tàu ghi trên file (ô "Vsl./Tàu", rồi tên file) trong các tàu người này phụ trách; phụ trách đúng một tàu thì lấy tàu đó. */
type TauPhamVi = { id: number; code: string; name: string };

function nhanTau(tau: TauPhamVi[], tenTau: string | null, fileName: string): number | null {
  const theoO = tenTau ? tauTuTenTep(`${tenTau}.x`, tau) : null;
  const theoTen = theoO ?? tauTuTenTep(fileName, tau);
  if (theoTen) return theoTen.id;
  return tau.length === 1 ? tau[0].id : null;
}

/** Chữ tách sẵn cho nhà cung cấp AI chỉ đọc chữ (DeepSeek): lớp chữ PDF, không có thì OCR (Windows). */
async function chuChoAi(nhaCungCap: string, buffer: Buffer, fullPath: string): Promise<string | null> {
  const { CHI_DOC_CHU } = await import("@/lib/docPhieuBangAi");
  if (!(CHI_DOC_CHU as readonly string[]).includes(nhaCungCap)) return null;
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 100);
  if (lop.ok) return lop.text;
  if (process.platform === "win32") {
    const { docPdfBangOcr } = await import("@/lib/pdfOcr");
    const ocr = await docPdfBangOcr(fullPath, 30);
    if (ocr.ok && ocr.text.trim().length >= 10) return ocr.text;
  }
  return null;
}

/** Bộ đọc AI đọc phiếu yêu cầu (PDF scan) ở chế độ nền; mọi đường ra đều gỡ dấu aiDangDocTu. */
async function chayDocAiYeuCau(id: number, actor: NguoiThaoTac, tauPhamVi: TauPhamVi[]): Promise<void> {
  const tep = await prisma.yeuCauTep.findUnique({ where: { id }, select: { id: true, vesselId: true, storedName: true, fileName: true, dau: true } }).catch(() => null);
  if (!tep) return;
  const ketThuc = (data: { loiAi?: string | null; dong?: DongYeuCauFile[]; dau?: DauYeuCauFile; ghiChuDoc?: string | null; vesselId?: number | null }) =>
    prisma.yeuCauTep.update({ where: { id: tep.id }, data: { ...data, aiDangDocTu: null, aiTienDo: null } }).catch(() => undefined);
  try {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    const cauHinh = await layCauHinhAi();
    if (!cauHinh) {
      await ketThuc({ loiAi: "Chưa cấu hình bộ đọc AI." });
      return;
    }
    const fullPath = path.join(getUploadDir(), path.basename(tep.storedName));
    const buffer = await readFile(fullPath);
    const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
    const { demTrangPdf } = await import("@/lib/pdfChu");
    const bd = Date.now();
    const ai = await docPhieuGiaoBangAi(buffer, cauHinh, {
      banDoc: "yeuCau",
      fileName: tep.fileName,
      soTrang: await demTrangPdf(buffer),
      chuPdf: await chuChoAi(cauHinh.nhaCungCap, buffer, fullPath),
      onTienDo: (xong, tong) => {
        void prisma.yeuCauTep.update({ where: { id: tep.id }, data: { aiTienDo: `${xong}/${tong}` } }).catch(() => undefined);
      },
    });
    const giay = Math.round((Date.now() - bd) / 1000);
    if (!ai.ok) {
      console.error(`[yeu-cau-tep] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi #${tep.id} sau ${giay}s: ${ai.loi}`);
      await ketThuc({ loiAi: ai.loi.slice(0, 500) });
      return;
    }
    const dong = dongTuAiYeuCau(ai.dong);
    const { docDauYeuCau } = await import("@/lib/yeuCauNhap");
    const dau = gopDauYeuCau(dauTuAiYeuCau(ai), docDauYeuCau(tep.dau));
    const vesselId = tep.vesselId ?? nhanTau(tauPhamVi, dau.tau, tep.fileName);
    await ketThuc({
      dong,
      dau,
      vesselId,
      loiAi: !dong.length ? "Bộ đọc AI không thấy dòng hàng nào trong file." : ai.canhBaoChung ? ai.canhBaoChung.slice(0, 500) : null,
      ghiChuDoc: `AI (${ai.model}, ${ai.soLuotGoi} lượt, ${giay}s) đọc ${dong.length} dòng, ${ai.soDongCanKiem} dòng cần kiểm.`.slice(0, 1000),
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "yeu-cau-tep-doc-ai",
      path: `/requests?tuTep=${tep.id}`,
      vesselId,
      detail: `AI (${ai.model}, ${giay}s) đọc phiếu yêu cầu ${tep.fileName}: ${dong.length} dòng, token ${ai.tokenVao}/${ai.tokenRa}`,
    });
  } catch (e) {
    console.error(`[yeu-cau-tep] Đọc nền #${tep.id} lỗi:`, e);
    await ketThuc({ loiAi: `Lỗi khi đọc file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
  }
}

// ─── 1. Tải file ─────────────────────────────────────────────────────────────

export async function taiFileYeuCau(_prev: KetQuaYeuCauTep, formData: FormData): Promise<KetQuaYeuCauTep> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_YEU_CAU]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  const ext = fileExtension(file.name);
  if (!(DUOI_YEU_CAU as readonly string[]).includes(ext)) return { message: t("requests.tepSaiDinhDang") };
  if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };

  const buffer = Buffer.from(await file.arrayBuffer());
  const laPdf = ext === ".pdf";
  // Đọc không AI trước (Word / Excel / lớp chữ PDF — nhanh, không tốn lượt AI).
  // PDF: lớp chữ không đọc được, hoặc đọc ra mà quá nửa dòng phải đoán cột,
  // thì để bộ đọc AI đọc (nếu đã cấu hình).
  const { docYeuCauKhongAi } = await import("@/lib/yeuCauTep");
  const kq = await docYeuCauKhongAi(buffer, file.name);
  const tamTam = kq.ok && kq.dong.filter((d) => d.canhBao).length * 2 > kq.dong.length;
  let dungAi = false;
  if (laPdf && (!kq.ok || tamTam)) {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    dungAi = Boolean(await layCauHinhAi());
  }
  if (!kq.ok && !dungAi) return { message: laPdf ? `${kq.loi} ${t("requests.tepPdfCanAi")}` : kq.loi };
  const dau: DauYeuCauFile | null = kq.ok ? kq.dau : null;
  const tauPhamVi = await prisma.vessel.findMany({ where: vesselIdWhere(vesselScopeDayDu(actor)), select: { id: true, code: true, name: true } });
  const vesselId = nhanTau(tauPhamVi, dau?.tau ?? null, file.name);

  const dir = await ensureUploadDir();
  const storedName = `${TIEN_TO_TEP}${randomUUID()}${ext}`;
  await writeFile(path.join(dir, storedName), buffer);
  const tep = await prisma.yeuCauTep.create({
    data: {
      vesselId,
      fileName: file.name.slice(0, 200),
      storedName,
      loaiTep: loaiTepCua(ext),
      size: file.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      dau: dau ?? {},
      dong: kq.ok && !dungAi ? kq.dong : [],
      ghiChuDoc: kq.ok && !dungAi ? kq.ghiChu : null,
      aiDangDocTu: dungAi ? new Date() : null,
      aiTienDo: dungAi ? "0" : null,
      nguoiTaiId: actor.id,
      nguoiTai: actor.name,
    },
    select: { id: true },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "yeu-cau-tep-tai-len",
    path: `/requests?tuTep=${tep.id}`,
    vesselId,
    detail: `Tải phiếu yêu cầu ${file.name} (${dungAi ? "PDF — AI đọc nền" : `${kq.ok ? kq.dong.length : 0} dòng`})`,
  });
  if (dungAi) {
    const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
    after(() => chayDocAiYeuCau(tep.id, nguoi, tauPhamVi));
  }
  redirect(`/requests?tuTep=${tep.id}`);
}

// ─── 3. Bỏ file chưa dùng ────────────────────────────────────────────────────

export async function boFileYeuCau(id: number): Promise<KetQuaYeuCauTep> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_YEU_CAU]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const tep = Number.isInteger(id) && id > 0 ? await prisma.yeuCauTep.findUnique({ where: { id }, select: { id: true, nguoiTaiId: true, storedName: true, fileName: true, requestId: true, vesselId: true } }) : null;
  if (!tep || (tep.nguoiTaiId !== actor.id && actor.role !== "ADMIN")) return { message: t("requests.tepKhongThay") };
  if (tep.requestId) redirect("/requests");
  await prisma.yeuCauTep.delete({ where: { id: tep.id } });
  try {
    await unlink(path.join(getUploadDir(), path.basename(tep.storedName)));
  } catch {
    /* tệp đã không còn */
  }
  await ghiNhatKyNguoiDung(actor, {
    action: "yeu-cau-tep-bo",
    path: "/requests",
    vesselId: tep.vesselId,
    detail: `Bỏ phiếu yêu cầu chưa dùng ${tep.fileName} (#${tep.id})`,
  });
  revalidatePath("/requests");
  redirect("/requests");
}
