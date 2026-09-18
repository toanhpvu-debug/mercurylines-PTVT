/**
 * Thử bộ đọc AI với một PDF THẬT (gọi API thật, tốn phí nhỏ).
 *
 * Chạy:  npx tsx scripts/thu-doc-ai.ts "duong\dan\phieu-giao.pdf"
 *
 * Dùng khóa từ biến môi trường (ANTHROPIC_API_KEY hoặc GOOGLE_AI_API_KEY /
 * GEMINI_API_KEY, mô hình PHIEU_GIAO_AI_MODEL); không có thì đọc .env cạnh
 * package.json. Khóa nhập trong app (database) KHÔNG được dùng ở đây — script
 * chạy ngoài app. Không bao giờ in khóa ra màn hình. In ra dòng hàng đọc
 * được để so với bản scan — cách nhanh nhất để biết mô hình đọc đúng chưa.
 */
import { existsSync, readFileSync } from "fs";
import path from "path";

function napEnv() {
  const f = path.join(process.cwd(), ".env");
  if (!existsSync(f)) return;
  for (const dong of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = dong.match(/^\s*(ANTHROPIC_API_KEY|GOOGLE_AI_API_KEY|GEMINI_API_KEY|PHIEU_GIAO_AI_MODEL)\s*=\s*"?([^"#]*)"?\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  const tep = process.argv[2];
  if (!tep || !existsSync(tep)) {
    console.log("Cách dùng: npx tsx scripts/thu-doc-ai.ts <duong-dan-pdf>");
    process.exit(2);
  }
  napEnv();
  const { cauHinhTuEnv } = await import("@/lib/cauHinhAi");
  const { docPhieuGiaoBangAi, TEN_NHA_CUNG_CAP } = await import("@/lib/docPhieuBangAi");
  const ch = cauHinhTuEnv();
  if (!ch) {
    console.log("Chưa có khóa: đặt ANTHROPIC_API_KEY hoặc GOOGLE_AI_API_KEY trong .env hoặc biến môi trường.");
    process.exit(2);
  }
  const pdf = readFileSync(tep);
  console.log(`Gửi ${path.basename(tep)} (${Math.round(pdf.length / 1024)} KB) cho ${TEN_NHA_CUNG_CAP[ch.nhaCungCap]} · ${ch.model}...`);
  const bd = Date.now();
  const kq = await docPhieuGiaoBangAi(pdf, ch, { fileName: path.basename(tep) });
  const giay = ((Date.now() - bd) / 1000).toFixed(1);
  if (!kq.ok) {
    console.log(`LỖI sau ${giay}s: ${kq.loi}`);
    process.exit(1);
  }
  console.log(`Xong sau ${giay}s — token vào ${kq.tokenVao}, ra ${kq.tokenRa}`);
  console.log(kq.chuTomTat);
}
main();
