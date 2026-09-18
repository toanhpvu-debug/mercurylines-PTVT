/**
 * Thử bộ đọc AI với một PDF THẬT (gọi Claude API thật, tốn phí nhỏ).
 *
 * Chạy:  npx tsx scripts/thu-doc-ai.ts "duong\dan\phieu-giao.pdf"
 *
 * Lấy ANTHROPIC_API_KEY từ biến môi trường, không có thì đọc từ .env cạnh
 * package.json. Không bao giờ in khóa ra màn hình. In ra dòng hàng đọc được
 * để so với bản scan — đây là cách nhanh nhất để biết mô hình đọc đúng chưa
 * trước khi tin vào nó trên app.
 */
import { existsSync, readFileSync } from "fs";
import path from "path";

function napEnv() {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return;
  const f = path.join(process.cwd(), ".env");
  if (!existsSync(f)) return;
  for (const dong of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = dong.match(/^\s*(ANTHROPIC_API_KEY|PHIEU_GIAO_AI_MODEL)\s*=\s*"?([^"#]*)"?\s*(#.*)?$/);
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
  const { aiDaCauHinh, docPhieuGiaoBangAi, tenModelAi } = await import("@/lib/docPhieuBangAi");
  if (!aiDaCauHinh()) {
    console.log("Chưa có ANTHROPIC_API_KEY (đặt trong .env hoặc biến môi trường).");
    process.exit(2);
  }
  const pdf = readFileSync(tep);
  console.log(`Gửi ${path.basename(tep)} (${Math.round(pdf.length / 1024)} KB) cho ${tenModelAi()}...`);
  const bd = Date.now();
  const kq = await docPhieuGiaoBangAi(pdf, { fileName: path.basename(tep) });
  const giay = ((Date.now() - bd) / 1000).toFixed(1);
  if (!kq.ok) {
    console.log(`LỖI sau ${giay}s: ${kq.loi}`);
    process.exit(1);
  }
  console.log(`Xong sau ${giay}s — token vào ${kq.tokenVao}, ra ${kq.tokenRa}`);
  console.log(kq.chuTomTat);
}
main();
