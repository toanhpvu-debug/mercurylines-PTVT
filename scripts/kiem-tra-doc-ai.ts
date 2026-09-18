/**
 * Kiểm bộ đọc AI cho phiếu giao (lib/docPhieuBangAi.ts) mà KHÔNG gọi mạng:
 * fetch được thay bằng hàm giả để soi đúng nội dung gửi đi (model, công cụ,
 * tài liệu PDF base64, khóa ở header) và cách bóc kết quả trả về, kể cả lỗi.
 *
 * Chạy:  npx tsx scripts/kiem-tra-doc-ai.ts
 */
import { CONG_CU_GHI_PHIEU, chuanHoaKetQuaAi, docPhieuGiaoBangAi } from "@/lib/docPhieuBangAi";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}

// 1) Chuẩn hóa JSON "bẩn" mà mô hình có thể trả về.
const c = chuanHoaKetQuaAi({
  nhaCungCap: "  Golden Marine Service Group Co.,Limited ",
  soPhieu: "20260412",
  ngayGiao: "2026-04-12",
  tau: "M. ODYSSEY",
  dong: [
    { stt: 1, ten: "Abrasive discs (Đĩa mài)", impa: "IMPA 570284", soLuong: "25", donVi: "pcs" },
    { stt: 2, ten: "Piston ring set", partNo: "21001-1234", soLuong: 2, donVi: "Set", loai: "SPARE", thietBi: "MAIN ENGINE" },
    { ten: "Bearing", impa: "ABC-12", soLuong: 1, donVi: "ea", loai: "spare" },
    { ten: "", soLuong: 3 },
    { ten: "Cotton rags", impa: 190405, soLuong: null, donVi: null, loai: "STORE", ghiChu: "giao thiếu" },
    "khong phai object",
  ],
});
kiemTra("ncc trim", c.nhaCungCap, "Golden Marine Service Group Co.,Limited");
kiemTra("ngay giu nguyen", c.ngayGiao, "2026-04-12");
kiemTra("so dong (bo ten rong + phan tu rac)", c.dong.length, 4);
kiemTra(
  "dong",
  c.dong.map((d) => [d.ten, d.partNo, d.impa, d.soLuong, d.donVi, d.loai, d.thietBi]),
  [
    ["Abrasive discs (Đĩa mài)", null, "570284", 25, "PCS", "STORE", null],
    ["Piston ring set", "21001-1234", null, 2, "SET", "SPARE", "MAIN ENGINE"],
    ["Bearing", "ABC-12", null, 1, "PCS", "SPARE", null],
    ["Cotton rags", null, "190405", 0, "PCS", "STORE", null],
  ]
);
kiemTra("chuGoc co ghi chu", c.dong[3].chuGoc.includes("(giao thiếu)"), true);
kiemTra("tom tat co dau phieu", c.chuTomTat.startsWith("Nhà cung cấp: Golden"), true);
kiemTra("rong -> 0 dong", chuanHoaKetQuaAi(null).dong.length, 0);

// 2) Gọi API với fetch giả: soi yêu cầu và bóc kết quả.
const pdf = Buffer.from("%PDF-1.4 gia");
let yeuCau: { url: string; init: RequestInit } | null = null;
const traVe = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ketQuaTot = {
  content: [
    { type: "text", text: "Đã đọc." },
    {
      type: "tool_use",
      name: CONG_CU_GHI_PHIEU.name,
      input: { soPhieu: "DN-1", dong: [{ ten: "Grease gun", impa: "550102", soLuong: 1, donVi: "PCS", loai: "STORE" }] },
    },
  ],
  stop_reason: "tool_use",
  usage: { input_tokens: 1200, output_tokens: 80 },
};

async function main() {
  const tot = await docPhieuGiaoBangAi(pdf, {
    apiKey: "khoa-gia-de-kiem-thu",
    model: "claude-sonnet-5",
    fileName: "DELIVERY NOTE - 20260412.pdf",
    fetchFn: async (url, init) => {
      yeuCau = { url, init };
      return traVe(200, ketQuaTot);
    },
  });
  kiemTra("ok", tot.ok, true);
  if (tot.ok) {
    kiemTra("so phieu", tot.soPhieu, "DN-1");
    kiemTra("dong", tot.dong.map((d) => [d.ten, d.impa, d.soLuong]), [["Grease gun", "550102", 1]]);
    kiemTra("token", [tot.tokenVao, tot.tokenRa], [1200, 80]);
    kiemTra("model", tot.model, "claude-sonnet-5");
  }
  kiemTra("goi dung dia chi", yeuCau?.url, "https://api.anthropic.com/v1/messages");
  const headers = (yeuCau?.init.headers ?? {}) as Record<string, string>;
  kiemTra("khoa o header", headers["x-api-key"], "khoa-gia-de-kiem-thu");
  kiemTra("phien ban api", headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(String(yeuCau?.init.body));
  kiemTra("model gui di", body.model, "claude-sonnet-5");
  kiemTra("bat buoc cong cu", body.tool_choice, { type: "tool", name: "ghi_phieu_giao" });
  kiemTra("schema cong cu", body.tools[0].input_schema.required, ["dong"]);
  const tep = body.messages[0].content[0];
  kiemTra("tai lieu pdf base64", [tep.type, tep.source.media_type, tep.source.data], [
    "document",
    "application/pdf",
    pdf.toString("base64"),
  ]);
  kiemTra("ten tep", tep.title, "DELIVERY NOTE - 20260412.pdf");
  kiemTra("khoa khong lot vao body", String(yeuCau?.init.body).includes("khoa-gia-de-kiem-thu"), false);

  // Lỗi xác thực: báo rõ mã + loại, không thử lại.
  let soLan = 0;
  const sai = await docPhieuGiaoBangAi(pdf, {
    apiKey: "sai",
    fetchFn: async () => {
      soLan++;
      return traVe(401, { error: { type: "authentication_error", message: "invalid x-api-key" } });
    },
  });
  kiemTra("401 -> ok:false", sai.ok, false);
  kiemTra("401 khong thu lai", soLan, 1);
  if (!sai.ok) kiemTra("401 thong bao", sai.loi, "Claude API 401 authentication_error: invalid x-api-key");

  // Quá tải lần 1 rồi thành công lần 2.
  soLan = 0;
  const lai = await docPhieuGiaoBangAi(pdf, {
    apiKey: "k",
    fetchFn: async () => {
      soLan++;
      return soLan === 1 ? traVe(529, { error: { type: "overloaded_error", message: "Overloaded" } }) : traVe(200, ketQuaTot);
    },
  });
  kiemTra("529 roi ok", [lai.ok, soLan], [true, 2]);

  // Mạng đứt cả hai lần.
  const dut = await docPhieuGiaoBangAi(pdf, {
    apiKey: "k",
    fetchFn: async () => {
      throw new Error("ECONNRESET");
    },
  });
  kiemTra("mang dut -> ok:false", dut.ok, false);
  if (!dut.ok) kiemTra("mang dut thong bao", dut.loi.includes("ECONNRESET"), true);

  // Không có tool_use.
  const khong = await docPhieuGiaoBangAi(pdf, {
    apiKey: "k",
    fetchFn: async () => traVe(200, { content: [{ type: "text", text: "..." }], stop_reason: "max_tokens" }),
  });
  kiemTra("khong tool_use -> ok:false", khong.ok, false);

  // Chưa cấu hình khóa.
  const luu = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const chuaKhoa = await docPhieuGiaoBangAi(pdf, { fetchFn: async () => traVe(200, ketQuaTot) });
  if (luu !== undefined) process.env.ANTHROPIC_API_KEY = luu;
  kiemTra("chua khoa -> ok:false", chuaKhoa.ok, false);

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
}
main();
