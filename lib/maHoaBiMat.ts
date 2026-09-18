/**
 * Mã hóa bí mật (khóa API...) trước khi cất vào database: AES-256-GCM với khóa
 * dẫn xuất từ SESSION_SECRET (SHA-256). Thuần Node crypto, kiểm ở
 * scripts/kiem-tra-cau-hinh-ai.ts.
 *
 * Vì sao không ghi thẳng: bản sao lưu database đi khắp nơi (ổ USB, email),
 * và tài khoản chỉ đọc database cũng thấy được mọi cột. Với lớp mã hóa này, ai
 * có bản sao lưu mà không có SESSION_SECRET của bản cài thì chỉ thấy chuỗi rác.
 *
 * Hệ quả phải nhớ: ĐỔI SESSION_SECRET là mọi bí mật đã lưu không giải mã được
 * nữa — trang cấu hình phát hiện được (giaiMa trả null) và bảo nhập lại, không
 * bao giờ đưa chuỗi rác đi gọi API.
 *
 * Dạng lưu: "v1:<iv b64>:<tag b64>:<ciphertext b64>". Tiền tố phiên bản để sau
 * này đổi thuật toán vẫn đọc được bản cũ.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PHIEN_BAN = "v1";

function khoaTu(secret: string | undefined): Buffer {
  const s = (secret ?? process.env.SESSION_SECRET ?? "").trim();
  if (s.length < 32) {
    throw new Error("SESSION_SECRET chưa được cấu hình (cần từ 32 ký tự) — không mã hóa được bí mật.");
  }
  return createHash("sha256").update(s, "utf8").digest();
}

export function maHoa(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", khoaTu(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [PHIEN_BAN, iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

/** null = không giải mã được (sai SESSION_SECRET, chuỗi hỏng, hoặc không phải dạng đã mã hóa). */
export function giaiMa(luu: string, secret?: string): string | null {
  try {
    const [v, ivB64, tagB64, ctB64] = luu.split(":");
    if (v !== PHIEN_BAN || !ivB64 || !tagB64 || !ctB64) return null;
    const d = createDecipheriv("aes-256-gcm", khoaTu(secret), Buffer.from(ivB64, "base64"));
    d.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([d.update(Buffer.from(ctB64, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Phần đuôi để nhận ra khóa mà không lộ khóa: "••••" + 4 ký tự cuối. */
export function duoiKhoa(k: string): string {
  const s = k.trim();
  return s.length <= 4 ? "••••" : `••••${s.slice(-4)}`;
}
