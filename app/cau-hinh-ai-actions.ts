"use server";

import { revalidatePath } from "next/cache";
import { requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import {
  MODEL_MAC_DINH,
  NHA_CUNG_CAP_AI,
  TEN_NHA_CUNG_CAP,
  docPhieuGiaoBangAi,
  kiemTraKetNoiAi,
  type CheDoDocAi,
  type NhaCungCapAi,
} from "@/lib/docPhieuBangAi";
import { layCauHinhAi, luuCauHinhAi, xoaCauHinhAi } from "@/lib/cauHinhAi";
import { duoiKhoa } from "@/lib/maHoaBiMat";
import { PDF_MAU_DONG_HANG, taoPdfMauPhieuGiao } from "@/lib/pdfMauPhieuGiao";

/*
 * Trang /cai-dat/ai — chỉ ADMIN. Khóa API đi từ ô nhập → server action → mã
 * hóa → database; không bao giờ quay lại trình duyệt, không vào nhật ký (nhật
 * ký chỉ ghi 4 ký tự cuối để nhận ra khóa nào).
 */

export type KetQuaCauHinhAi = {
  message: string;
  success?: boolean;
  /** Danh sách mô hình khóa này dùng được (từ "Kiểm tra kết nối"). */
  models?: string[];
  coModel?: boolean;
};

function docForm(formData: FormData) {
  const nccRaw = String(formData.get("nhaCungCap") || "");
  const nhaCungCap: NhaCungCapAi = (NHA_CUNG_CAP_AI as readonly string[]).includes(nccRaw)
    ? (nccRaw as NhaCungCapAi)
    : "gemini";
  const apiKey = String(formData.get("apiKey") || "").trim();
  const model = String(formData.get("model") || "").trim().slice(0, 100);
  const cheDo: CheDoDocAi = String(formData.get("cheDo") || "") === "nhanh" ? "nhanh" : "ky";
  return { nhaCungCap, apiKey, model, cheDo };
}

export async function luuCauHinhAiAction(_prev: KetQuaCauHinhAi, formData: FormData): Promise<KetQuaCauHinhAi> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const { nhaCungCap, apiKey, model, cheDo } = docForm(formData);
  const r = await luuCauHinhAi({ nhaCungCap, apiKey, model, cheDo }, actor.name);
  if (!r.ok) {
    const khoa = r.loi === "thieuKhoa" ? "loiThieuKhoa" : r.loi === "khoaSai" ? "loiKhoaSai" : "loiKhongMaHoaDuoc";
    return { message: t(`cauHinhAi.${khoa}`) };
  }
  const modelDung = model || MODEL_MAC_DINH[nhaCungCap];
  await ghiNhatKyNguoiDung(actor, {
    action: "cau-hinh-ai-luu",
    path: "/cai-dat/ai",
    vesselId: null,
    detail: `${TEN_NHA_CUNG_CAP[nhaCungCap]} · ${modelDung} · chế độ ${cheDo}${apiKey ? ` · khóa ${duoiKhoa(apiKey)}` : " · giữ khóa cũ"}`,
  });
  revalidatePath("/cai-dat/ai");
  revalidatePath("/materials/phieu-giao");
  return {
    message: t("cauHinhAi.daLuu", { ncc: TEN_NHA_CUNG_CAP[nhaCungCap], model: modelDung }),
    success: true,
  };
}

export async function kiemTraKetNoiAiAction(_prev: KetQuaCauHinhAi, formData: FormData): Promise<KetQuaCauHinhAi> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const { nhaCungCap, model } = docForm(formData);
  let { apiKey } = docForm(formData);
  if (!apiKey) {
    // Không dán khóa mới: thử bằng khóa đã lưu, nếu cùng nhà cung cấp.
    const luu = await layCauHinhAi();
    if (luu && luu.nhaCungCap === nhaCungCap) apiKey = luu.apiKey;
    else return { message: t("cauHinhAi.loiThieuKhoa") };
  }
  const modelDung = model || MODEL_MAC_DINH[nhaCungCap];
  const r = await kiemTraKetNoiAi({ nhaCungCap, apiKey, model: modelDung, nguon: "db" });
  await ghiNhatKyNguoiDung(actor, {
    action: "cau-hinh-ai-kiem-tra",
    path: "/cai-dat/ai",
    vesselId: null,
    detail: r.ok
      ? `${TEN_NHA_CUNG_CAP[nhaCungCap]} · khóa ${duoiKhoa(apiKey)} hợp lệ · ${r.models.length} mô hình · ${modelDung} ${r.coModel ? "có" : "KHÔNG có"}`
      : `${TEN_NHA_CUNG_CAP[nhaCungCap]} · khóa ${duoiKhoa(apiKey)} · lỗi: ${r.loi.slice(0, 200)}`,
  });
  if (!r.ok) return { message: t("cauHinhAi.kiemTraLoi", { loi: r.loi }) };
  return {
    message: r.coModel
      ? t("cauHinhAi.kiemTraOk", { n: r.models.length })
      : t("cauHinhAi.kiemTraModelKhongCo", { model: modelDung }),
    success: r.coModel,
    models: r.models,
    coModel: r.coModel,
  };
}

/**
 * Thử đọc THẬT: gửi phiếu mẫu 1 trang cho AI bằng đúng đường app dùng khi tải
 * phiếu — cách duy nhất kiểm được đủ khóa + mô hình + hạn mức + mạng từ máy
 * chủ trước khi người dùng tải phiếu thật. Trả lỗi nguyên văn của nhà cung cấp.
 */
export async function thuDocThatAction(_prev: KetQuaCauHinhAi, formData: FormData): Promise<KetQuaCauHinhAi> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const { nhaCungCap, model, cheDo } = docForm(formData);
  let { apiKey } = docForm(formData);
  if (!apiKey) {
    const luu = await layCauHinhAi();
    if (luu && luu.nhaCungCap === nhaCungCap) apiKey = luu.apiKey;
    else return { message: t("cauHinhAi.loiThieuKhoa") };
  }
  const modelDung = model || MODEL_MAC_DINH[nhaCungCap];
  const bd = Date.now();
  const kq = await docPhieuGiaoBangAi(taoPdfMauPhieuGiao(), { nhaCungCap, apiKey, model: modelDung, cheDo, nguon: "db" }, {
    fileName: "phieu-giao-mau.pdf",
    timeoutMs: 120_000,
    soTrang: 1,
  });
  const giay = ((Date.now() - bd) / 1000).toFixed(1);
  if (!kq.ok) {
    console.error(`[cau-hinh-ai] Thử đọc thật (${nhaCungCap} · ${modelDung}) lỗi: ${kq.loi}`);
    await ghiNhatKyNguoiDung(actor, {
      action: "cau-hinh-ai-thu-doc",
      path: "/cai-dat/ai",
      vesselId: null,
      detail: `${TEN_NHA_CUNG_CAP[nhaCungCap]} · ${modelDung} · lỗi sau ${giay}s: ${kq.loi.slice(0, 200)}`,
    });
    return { message: t("cauHinhAi.thuDocLoi", { loi: kq.loi }) };
  }
  // Đếm dòng mẫu đọc đúng (theo tên) — mô hình yếu có thể trả thiếu.
  const tenDung = new Set(PDF_MAU_DONG_HANG.map((d) => d.ten.toLowerCase()));
  const n = kq.dong.filter((d) => tenDung.has(d.ten.toLowerCase())).length;
  await ghiNhatKyNguoiDung(actor, {
    action: "cau-hinh-ai-thu-doc",
    path: "/cai-dat/ai",
    vesselId: null,
    detail: `${TEN_NHA_CUNG_CAP[nhaCungCap]} · ${modelDung} · ${n}/3 dòng sau ${giay}s · token ${kq.tokenVao}/${kq.tokenRa}`,
  });
  const tham = { giay, model: modelDung, n, vao: kq.tokenVao, ra: kq.tokenRa };
  return n >= 3
    ? { message: t("cauHinhAi.thuDocOk", tham), success: true }
    : { message: t("cauHinhAi.thuDocThieuDong", tham) };
}

export async function xoaCauHinhAiAction(): Promise<KetQuaCauHinhAi> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  await xoaCauHinhAi();
  await ghiNhatKyNguoiDung(actor, { action: "cau-hinh-ai-xoa", path: "/cai-dat/ai", vesselId: null, detail: "Xóa khóa API bộ đọc AI" });
  revalidatePath("/cai-dat/ai");
  revalidatePath("/materials/phieu-giao");
  return { message: t("cauHinhAi.daXoa"), success: true };
}
