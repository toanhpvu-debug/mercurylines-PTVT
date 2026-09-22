/**
 * Cấu hình bộ đọc AI (nhà cung cấp, khóa API, mô hình) — nguồn:
 *   1. Database, bảng CauHinhHeThong, do quản trị nhập tại /cai-dat/ai. Khóa
 *      được mã hóa bằng lib/maHoaBiMat.ts. ƯU TIÊN.
 *   2. Biến môi trường ANTHROPIC_API_KEY (Claude) hoặc GOOGLE_AI_API_KEY /
 *      GEMINI_API_KEY (Gemini), mô hình PHIEU_GIAO_AI_MODEL. Dự phòng cho ai
 *      thích đặt ở Dokploy / .env.
 *
 * Mọi hàm ở đây trả khóa đã giải chỉ cho server action / trang server dùng
 * ngay; không có hàm nào trả khóa cho trình duyệt — trạng thái cho giao diện
 * (trangThaiCauHinhAi) chỉ mang 4 ký tự cuối.
 */
import { prisma } from "@/lib/prisma";
import { duoiKhoa, giaiMa, maHoa } from "@/lib/maHoaBiMat";
import {
  CHE_DO_DOC_AI,
  MODEL_MAC_DINH,
  NHA_CUNG_CAP_AI,
  type CauHinhAi,
  type CheDoDocAi,
  type NhaCungCapAi,
} from "@/lib/docPhieuBangAi";

export type { CauHinhAi, CheDoDocAi, NhaCungCapAi };

const KHOA_NCC = "ai.nhaCungCap";
const KHOA_API = "ai.apiKey";
const KHOA_MODEL = "ai.model";
const KHOA_CHE_DO = "ai.cheDo";

function laCheDo(s: unknown): s is CheDoDocAi {
  return typeof s === "string" && (CHE_DO_DOC_AI as readonly string[]).includes(s);
}

export type TrangThaiCauHinhAi = {
  bat: boolean;
  nguon: "db" | "env" | null;
  nhaCungCap: NhaCungCapAi | null;
  model: string | null;
  cheDo: CheDoDocAi;
  duoiKhoa: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
  /** Có bản ghi trong database nhưng không giải mã được (SESSION_SECRET đã đổi). */
  loiGiaiMa: boolean;
  /** Biến môi trường cũng có khóa (bị database che nếu cả hai cùng có). */
  coEnv: boolean;
};

function laNhaCungCap(s: unknown): s is NhaCungCapAi {
  return typeof s === "string" && (NHA_CUNG_CAP_AI as readonly string[]).includes(s);
}

/** Thuần env — export để kiểm thử. */
export function cauHinhTuEnv(env: Record<string, string | undefined> = process.env): CauHinhAi | null {
  const claude = env.ANTHROPIC_API_KEY?.trim();
  const gemini = (env.GOOGLE_AI_API_KEY ?? env.GEMINI_API_KEY)?.trim();
  const deepseek = env.DEEPSEEK_API_KEY?.trim();
  const nhaCungCap: NhaCungCapAi | null = claude ? "claude" : gemini ? "gemini" : deepseek ? "deepseek" : null;
  if (!nhaCungCap) return null;
  const cheDoEnv = env.PHIEU_GIAO_AI_CHE_DO?.trim();
  return {
    nhaCungCap,
    apiKey: (nhaCungCap === "claude" ? claude : nhaCungCap === "gemini" ? gemini : deepseek) as string,
    model: env.PHIEU_GIAO_AI_MODEL?.trim() || MODEL_MAC_DINH[nhaCungCap],
    cheDo: laCheDo(cheDoEnv) ? cheDoEnv : "ky",
    nguon: "env",
  };
}

async function docDb() {
  const rows = await prisma.cauHinhHeThong.findMany({
    where: { khoa: { in: [KHOA_NCC, KHOA_API, KHOA_MODEL, KHOA_CHE_DO] } },
  });
  const m = new Map(rows.map((r) => [r.khoa, r]));
  return { ncc: m.get(KHOA_NCC), api: m.get(KHOA_API), model: m.get(KHOA_MODEL), cheDo: m.get(KHOA_CHE_DO) };
}

export async function layCauHinhAi(): Promise<CauHinhAi | null> {
  const db = await docDb();
  if (db.api && laNhaCungCap(db.ncc?.giaTri)) {
    const apiKey = giaiMa(db.api.giaTri);
    if (apiKey) {
      return {
        nhaCungCap: db.ncc!.giaTri as NhaCungCapAi,
        apiKey,
        model: db.model?.giaTri?.trim() || MODEL_MAC_DINH[db.ncc!.giaTri as NhaCungCapAi],
        cheDo: laCheDo(db.cheDo?.giaTri) ? db.cheDo!.giaTri : "ky",
        nguon: "db",
      };
    }
    // Không giải mã được: KHÔNG rơi xuống env một cách im lặng — trang cấu hình
    // sẽ báo; nhưng bộ đọc vẫn dùng env nếu có để không chết việc.
  }
  return cauHinhTuEnv();
}

export async function aiDaCauHinh(): Promise<boolean> {
  return (await layCauHinhAi()) !== null;
}

export async function trangThaiCauHinhAi(): Promise<TrangThaiCauHinhAi> {
  const db = await docDb();
  const env = cauHinhTuEnv();
  if (db.api && laNhaCungCap(db.ncc?.giaTri)) {
    const apiKey = giaiMa(db.api.giaTri);
    const nhaCungCap = db.ncc!.giaTri as NhaCungCapAi;
    if (apiKey) {
      return {
        bat: true,
        nguon: "db",
        nhaCungCap,
        model: db.model?.giaTri?.trim() || MODEL_MAC_DINH[nhaCungCap],
        cheDo: laCheDo(db.cheDo?.giaTri) ? db.cheDo!.giaTri : "ky",
        duoiKhoa: duoiKhoa(apiKey),
        updatedBy: db.api.updatedBy,
        updatedAt: db.api.updatedAt,
        loiGiaiMa: false,
        coEnv: env !== null,
      };
    }
    return {
      bat: env !== null,
      nguon: env ? "env" : null,
      nhaCungCap: env?.nhaCungCap ?? nhaCungCap,
      model: env?.model ?? null,
      cheDo: env?.cheDo ?? "ky",
      duoiKhoa: env ? duoiKhoa(env.apiKey) : null,
      updatedBy: db.api.updatedBy,
      updatedAt: db.api.updatedAt,
      loiGiaiMa: true,
      coEnv: env !== null,
    };
  }
  return {
    bat: env !== null,
    nguon: env ? "env" : null,
    nhaCungCap: env?.nhaCungCap ?? null,
    model: env?.model ?? null,
    cheDo: env?.cheDo ?? "ky",
    duoiKhoa: env ? duoiKhoa(env.apiKey) : null,
    updatedBy: null,
    updatedAt: null,
    loiGiaiMa: false,
    coEnv: env !== null,
  };
}

/**
 * Lưu cấu hình. apiKey rỗng = giữ khóa đang có (chỉ đổi nhà cung cấp / mô hình);
 * nhưng đổi nhà cung cấp mà không đưa khóa mới thì từ chối — khóa Claude không
 * dùng được cho Gemini và ngược lại.
 */
export async function luuCauHinhAi(
  input: { nhaCungCap: NhaCungCapAi; apiKey: string; model: string; cheDo?: CheDoDocAi },
  actorName: string
): Promise<{ ok: true } | { ok: false; loi: "thieuKhoa" | "khoaSai" | "khongMaHoaDuoc" }> {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim().slice(0, 100) || MODEL_MAC_DINH[input.nhaCungCap];
  const cheDo: CheDoDocAi = laCheDo(input.cheDo) ? input.cheDo : "ky";
  const db = await docDb();
  const nccCu = laNhaCungCap(db.ncc?.giaTri) ? (db.ncc!.giaTri as NhaCungCapAi) : null;
  const khoaCuConDoc = db.api ? giaiMa(db.api.giaTri) !== null : false;
  if (!apiKey && (!khoaCuConDoc || nccCu !== input.nhaCungCap)) return { ok: false, loi: "thieuKhoa" };
  if (apiKey && (apiKey.length < 20 || /\s/.test(apiKey))) return { ok: false, loi: "khoaSai" };
  let giaTriKhoa: string | null = null;
  if (apiKey) {
    try {
      giaTriKhoa = maHoa(apiKey);
    } catch {
      return { ok: false, loi: "khongMaHoaDuoc" };
    }
  }
  const ghi = (khoa: string, giaTri: string, biMat: boolean) =>
    prisma.cauHinhHeThong.upsert({
      where: { khoa },
      update: { giaTri, biMat, updatedBy: actorName },
      create: { khoa, giaTri, biMat, updatedBy: actorName },
    });
  await prisma.$transaction([
    ghi(KHOA_NCC, input.nhaCungCap, false),
    ghi(KHOA_MODEL, model, false),
    ghi(KHOA_CHE_DO, cheDo, false),
    ...(giaTriKhoa ? [ghi(KHOA_API, giaTriKhoa, true)] : []),
  ]);
  return { ok: true };
}

export async function xoaCauHinhAi(): Promise<void> {
  await prisma.cauHinhHeThong.deleteMany({ where: { khoa: { in: [KHOA_NCC, KHOA_API, KHOA_MODEL, KHOA_CHE_DO] } } });
}
