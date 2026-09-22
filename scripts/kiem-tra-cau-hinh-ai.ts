/**
 * Kiểm phần THUẦN của cấu hình bộ đọc AI: mã hóa/giải mã bí mật
 * (lib/maHoaBiMat.ts) và đọc cấu hình từ biến môi trường (lib/cauHinhAi.ts).
 * Không đụng database.
 *
 * Chạy:  npx tsx scripts/kiem-tra-cau-hinh-ai.ts
 */
import { duoiKhoa, giaiMa, maHoa } from "@/lib/maHoaBiMat";
import { cauHinhTuEnv } from "@/lib/cauHinhAi";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}

const S1 = "bi-mat-kiem-thu-dai-hon-ba-muoi-hai-ky-tu-0001";
const S2 = "bi-mat-kiem-thu-dai-hon-ba-muoi-hai-ky-tu-0002";
const KHOA = "sk-test-abcdefghijklmnopqrstuvwxyz0123456789";

// 1) Mã hóa / giải mã.
const luu = maHoa(KHOA, S1);
kiemTra("dang luu v1:", luu.startsWith("v1:"), true);
kiemTra("khong lo khoa", luu.includes("abcdefghij"), false);
kiemTra("giai ma dung", giaiMa(luu, S1), KHOA);
kiemTra("moi lan ma hoa moi khac (iv ngau nhien)", maHoa(KHOA, S1) === luu, false);
kiemTra("sai secret -> null", giaiMa(luu, S2), null);
const [v, iv, tag, ct] = luu.split(":");
const ctHong = Buffer.from(ct, "base64");
ctHong[0] ^= 0xff;
kiemTra("sua noi dung -> null", giaiMa([v, iv, tag, ctHong.toString("base64")].join(":"), S1), null);
kiemTra("chuoi thuong -> null", giaiMa("sk-khong-ma-hoa", S1), null);
kiemTra("chuoi rong -> null", giaiMa("", S1), null);
kiemTra("unicode", giaiMa(maHoa("khóa có dấu — ✓", S1), S1), "khóa có dấu — ✓");
let nem = false;
try {
  maHoa(KHOA, "ngan");
} catch {
  nem = true;
}
kiemTra("secret ngan -> nem loi", nem, true);
kiemTra("duoi khoa", duoiKhoa(KHOA), "••••6789");
kiemTra("duoi khoa ngan", duoiKhoa("ab"), "••••");

// 2) Cấu hình từ biến môi trường.
const K = "x".repeat(30);
kiemTra("env trong -> null", cauHinhTuEnv({}), null);
kiemTra("env claude", cauHinhTuEnv({ ANTHROPIC_API_KEY: ` ${K} ` }), {
  nhaCungCap: "claude",
  apiKey: K,
  model: "claude-sonnet-5",
  cheDo: "ky",
  nguon: "env",
});
kiemTra("env gemini + model + che do", cauHinhTuEnv({ GOOGLE_AI_API_KEY: K, PHIEU_GIAO_AI_MODEL: "gemini-2.5-flash", PHIEU_GIAO_AI_CHE_DO: "nhanh" }), {
  nhaCungCap: "gemini",
  apiKey: K,
  model: "gemini-2.5-flash",
  cheDo: "nhanh",
  nguon: "env",
});
kiemTra("env che do la -> ky", cauHinhTuEnv({ GOOGLE_AI_API_KEY: K, PHIEU_GIAO_AI_CHE_DO: "sieu" })?.cheDo, "ky");
kiemTra("env GEMINI_API_KEY cung nhan", cauHinhTuEnv({ GEMINI_API_KEY: K })?.nhaCungCap, "gemini");
kiemTra("env deepseek", cauHinhTuEnv({ DEEPSEEK_API_KEY: K }), { nhaCungCap: "deepseek", apiKey: K, model: "deepseek-chat", cheDo: "ky", nguon: "env" });
kiemTra("env gemini + deepseek -> gemini", cauHinhTuEnv({ GOOGLE_AI_API_KEY: K, DEEPSEEK_API_KEY: K })?.nhaCungCap, "gemini");
kiemTra("env ca hai -> claude", cauHinhTuEnv({ ANTHROPIC_API_KEY: K, GOOGLE_AI_API_KEY: K })?.nhaCungCap, "claude");
kiemTra("env khoa rong -> null", cauHinhTuEnv({ ANTHROPIC_API_KEY: "   " }), null);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
