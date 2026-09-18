/**
 * Kiểm bộ đọc AI cho phiếu giao (lib/docPhieuBangAi.ts) mà KHÔNG gọi mạng:
 * fetch được thay bằng hàm giả để soi đúng nội dung gửi đi (nhà cung cấp,
 * mô hình, khuôn JSON, tài liệu PDF base64, khóa ở header) và cách bóc kết
 * quả trả về, kể cả lỗi — cho cả Claude lẫn Gemini, và phần kiểm tra kết nối.
 *
 * Chạy:  npx tsx scripts/kiem-tra-doc-ai.ts
 */
import {
  CONG_CU_GHI_PHIEU,
  DIA_CHI_CLAUDE,
  DIA_CHI_CLAUDE_MODELS,
  DIA_CHI_GEMINI,
  chuanHoaKetQuaAi,
  docPhieuGiaoBangAi,
  kiemTraKetNoiAi,
  schemaGemini,
  type CauHinhAi,
} from "@/lib/docPhieuBangAi";

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

// 2) Khuôn JSON cho Gemini: kiểu viết HOA, ["string","null"] -> nullable.
kiemTra("schema nullable", schemaGemini({ type: ["string", "null"], description: "x" }), { nullable: true, type: "STRING", description: "x" });
kiemTra(
  "schema object",
  schemaGemini({ type: "object", properties: { a: { type: "integer" }, b: { type: "array", items: { type: "number" } } }, required: ["a"] }),
  { type: "OBJECT", required: ["a"], properties: { a: { type: "INTEGER" }, b: { type: "ARRAY", items: { type: "NUMBER" } } } }
);
const sg = schemaGemini(CONG_CU_GHI_PHIEU.input_schema) as { properties: { dong: { items: { properties: { loai: unknown; partNo: unknown } } } } };
kiemTra("schema enum giu", sg.properties.dong.items.properties.loai, {
  type: "STRING",
  description: "STORE = vật tư tiêu hao / ship stores (hàng theo IMPA, boong, buồng, bếp, dụng cụ). SPARE = phụ tùng máy móc, thiết bị.",
  enum: ["STORE", "SPARE"],
});

const pdf = Buffer.from("%PDF-1.4 gia");
const traVe = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const CLAUDE: CauHinhAi = { nhaCungCap: "claude", apiKey: "khoa-gia-claude", model: "claude-sonnet-5", nguon: "db" };
const GEMINI: CauHinhAi = { nhaCungCap: "gemini", apiKey: "khoa-gia-gemini", model: "gemini-2.5-pro", nguon: "db" };
const ketQuaClaude = {
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
const ketQuaGemini = {
  candidates: [
    {
      content: { parts: [{ text: JSON.stringify({ soPhieu: "20260412", dong: [{ ten: "Rubber pads", impa: "591041", soLuong: 100, donVi: "PCS", loai: "STORE" }] }) }] },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 70 },
};

type YeuCau = { url: string; init: RequestInit };

async function main() {
  // 3) Claude: soi yêu cầu và bóc kết quả.
  // Gán qua "as" để TypeScript không thu hẹp biến thành null sau mỗi lần đặt
  // lại (giá trị thật được gán trong fetch giả, ngoài tầm theo dõi của nó).
  let yeuCau = null as YeuCau | null;
  const tot = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    fileName: "DELIVERY NOTE - 20260412.pdf",
    fetchFn: async (url, init) => {
      yeuCau = { url, init };
      return traVe(200, ketQuaClaude);
    },
  });
  kiemTra("claude ok", tot.ok, true);
  if (tot.ok) {
    kiemTra("claude so phieu", tot.soPhieu, "DN-1");
    kiemTra("claude dong", tot.dong.map((d) => [d.ten, d.impa, d.soLuong]), [["Grease gun", "550102", 1]]);
    kiemTra("claude token", [tot.tokenVao, tot.tokenRa], [1200, 80]);
    kiemTra("claude model", tot.model, "claude-sonnet-5");
  }
  kiemTra("claude dia chi", yeuCau?.url, DIA_CHI_CLAUDE);
  const h1 = (yeuCau?.init.headers ?? {}) as Record<string, string>;
  kiemTra("claude khoa o header", h1["x-api-key"], "khoa-gia-claude");
  kiemTra("claude phien ban api", h1["anthropic-version"], "2023-06-01");
  const b1 = JSON.parse(String(yeuCau?.init.body));
  kiemTra("claude model gui di", b1.model, "claude-sonnet-5");
  kiemTra("claude bat buoc cong cu", b1.tool_choice, { type: "tool", name: "ghi_phieu_giao" });
  const tep = b1.messages[0].content[0];
  kiemTra("claude tai lieu pdf base64", [tep.type, tep.source.media_type, tep.source.data], ["document", "application/pdf", pdf.toString("base64")]);
  kiemTra("claude ten tep", tep.title, "DELIVERY NOTE - 20260412.pdf");
  kiemTra("claude khoa khong lot vao body", String(yeuCau?.init.body).includes("khoa-gia-claude"), false);

  // 4) Gemini: soi yêu cầu và bóc kết quả.
  yeuCau = null as YeuCau | null;
  const g = await docPhieuGiaoBangAi(pdf, GEMINI, {
    fileName: "DN.pdf",
    fetchFn: async (url, init) => {
      yeuCau = { url, init };
      return traVe(200, ketQuaGemini);
    },
  });
  kiemTra("gemini ok", g.ok, true);
  if (g.ok) {
    kiemTra("gemini so phieu", g.soPhieu, "20260412");
    kiemTra("gemini dong", g.dong.map((d) => [d.ten, d.impa, d.soLuong, d.loai]), [["Rubber pads", "591041", 100, "STORE"]]);
    kiemTra("gemini token", [g.tokenVao, g.tokenRa], [900, 70]);
  }
  kiemTra("gemini dia chi", yeuCau?.url, `${DIA_CHI_GEMINI}/models/gemini-2.5-pro:generateContent`);
  const h2 = (yeuCau?.init.headers ?? {}) as Record<string, string>;
  kiemTra("gemini khoa o header", h2["x-goog-api-key"], "khoa-gia-gemini");
  kiemTra("gemini khoa khong o url", String(yeuCau?.url).includes("khoa-gia"), false);
  const b2 = JSON.parse(String(yeuCau?.init.body));
  kiemTra("gemini json bat buoc", b2.generationConfig.responseMimeType, "application/json");
  kiemTra("gemini schema nullable", b2.generationConfig.responseSchema.properties.dong.items.properties.partNo.nullable, true);
  kiemTra("gemini schema kieu HOA", b2.generationConfig.responseSchema.type, "OBJECT");
  kiemTra("gemini pdf inline", [b2.contents[0].parts[0].inlineData.mimeType, b2.contents[0].parts[0].inlineData.data], ["application/pdf", pdf.toString("base64")]);
  kiemTra("gemini system instruction", typeof b2.systemInstruction.parts[0].text, "string");

  // Gemini lỗi khóa → báo rõ, không thử lại.
  let soLan = 0;
  const gSai = await docPhieuGiaoBangAi(pdf, GEMINI, {
    fetchFn: async () => {
      soLan++;
      return traVe(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid." } });
    },
  });
  kiemTra("gemini 400 -> ok:false", gSai.ok, false);
  kiemTra("gemini 400 khong thu lai", soLan, 1);
  if (!gSai.ok) kiemTra("gemini 400 thong bao", gSai.loi, "Gemini API 400 INVALID_ARGUMENT: API key not valid.");
  // Gemini JSON hỏng (bị cắt).
  const gHong = await docPhieuGiaoBangAi(pdf, GEMINI, {
    fetchFn: async () => traVe(200, { candidates: [{ content: { parts: [{ text: '{"dong": [{"ten": "abc' }] }, finishReason: "MAX_TOKENS" }] }),
  });
  kiemTra("gemini json hong -> ok:false", gHong.ok, false);
  // Gemini PDF quá lớn: không gọi mạng.
  soLan = 0;
  const gTo = await docPhieuGiaoBangAi(Buffer.alloc(15 * 1024 * 1024), GEMINI, {
    fetchFn: async () => {
      soLan++;
      return traVe(200, ketQuaGemini);
    },
  });
  kiemTra("gemini pdf qua lon -> ok:false, khong goi", [gTo.ok, soLan], [false, 0]);

  // 5) Claude lỗi xác thực: báo rõ mã + loại, không thử lại.
  soLan = 0;
  const sai = await docPhieuGiaoBangAi(pdf, { ...CLAUDE, apiKey: "sai-khoa-de-thu-nghiem" }, {
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
  const lai = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    fetchFn: async () => {
      soLan++;
      return soLan === 1 ? traVe(529, { error: { type: "overloaded_error", message: "Overloaded" } }) : traVe(200, ketQuaClaude);
    },
  });
  kiemTra("529 roi ok", [lai.ok, soLan], [true, 2]);

  // Mạng đứt cả hai lần.
  const dut = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    fetchFn: async () => {
      throw new Error("ECONNRESET");
    },
  });
  kiemTra("mang dut -> ok:false", dut.ok, false);
  if (!dut.ok) kiemTra("mang dut thong bao", dut.loi.includes("ECONNRESET"), true);

  // Không có tool_use.
  const khong = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    fetchFn: async () => traVe(200, { content: [{ type: "text", text: "..." }], stop_reason: "max_tokens" }),
  });
  kiemTra("khong tool_use -> ok:false", khong.ok, false);

  // Chưa cấu hình: không gọi mạng.
  soLan = 0;
  const chuaKhoa = await docPhieuGiaoBangAi(pdf, null, {
    fetchFn: async () => {
      soLan++;
      return traVe(200, ketQuaClaude);
    },
  });
  kiemTra("chua cau hinh -> ok:false, khong goi", [chuaKhoa.ok, soLan], [false, 0]);

  // 6) Kiểm tra kết nối / liệt kê mô hình.
  yeuCau = null as YeuCau | null;
  const kg = await kiemTraKetNoiAi(GEMINI, {
    fetchFn: async (url, init) => {
      yeuCau = { url, init };
      return traVe(200, {
        models: [
          { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent", "countTokens"] },
          { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
        ],
      });
    },
  });
  kiemTra("gemini models", kg, { ok: true, models: ["gemini-2.5-flash", "gemini-2.5-pro"], coModel: true });
  kiemTra("gemini models dia chi", String(yeuCau?.url).startsWith(`${DIA_CHI_GEMINI}/models?`), true);
  kiemTra("gemini models khoa o header", ((yeuCau?.init.headers ?? {}) as Record<string, string>)["x-goog-api-key"], "khoa-gia-gemini");
  yeuCau = null as YeuCau | null;
  const kc = await kiemTraKetNoiAi({ ...CLAUDE, model: "claude-khong-co" }, {
    fetchFn: async (url, init) => {
      yeuCau = { url, init };
      return traVe(200, { data: [{ id: "claude-sonnet-5" }, { id: "claude-opus-5" }] });
    },
  });
  kiemTra("claude models, model khong co", kc, { ok: true, models: ["claude-opus-5", "claude-sonnet-5"], coModel: false });
  kiemTra("claude models dia chi", yeuCau?.url, DIA_CHI_CLAUDE_MODELS);
  yeuCau = null as YeuCau | null;
  const kSai = await kiemTraKetNoiAi(CLAUDE, {
    fetchFn: async () => traVe(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }),
  });
  kiemTra("models 401 -> ok:false", kSai.ok, false);
  kiemTra("models khong khoa -> ok:false", (await kiemTraKetNoiAi({ ...CLAUDE, apiKey: " " })).ok, false);

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
}
main();
