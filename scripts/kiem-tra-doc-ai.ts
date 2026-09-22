/**
 * Kiểm bộ đọc AI cho phiếu giao (lib/docPhieuBangAi.ts) mà KHÔNG gọi mạng:
 * fetch được thay bằng hàm giả để soi đúng nội dung gửi đi (nhà cung cấp,
 * mô hình, khuôn JSON, tài liệu PDF base64, khóa ở header, phạm vi trang, lượt
 * kiểm lại) và cách bóc kết quả trả về, kể cả lỗi — cho cả Claude lẫn Gemini,
 * cùng các hàm thuần: chia cụm trang, gộp hai lượt, bộ soát cảnh báo.
 *
 * Chạy:  npx tsx scripts/kiem-tra-doc-ai.ts
 */
import {
  CONG_CU_GHI_PHIEU,
  DIA_CHI_CLAUDE,
  DIA_CHI_CLAUDE_MODELS,
  DIA_CHI_DEEPSEEK,
  DIA_CHI_GEMINI,
  LOI_DEEPSEEK_KHONG_CHU,
  catTrang,
  chiaTrang,
  chuanHoaKetQuaAi,
  demTrangTuChu,
  docPhieuGiaoBangAi,
  gopLuot,
  kiemTraKetNoiAi,
  loiNhac,
  schemaGemini,
  soatDong,
  type CauHinhAi,
  type DongAi,
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
const dongAi = (p: Partial<DongAi> & { ten: string }): DongAi => ({
  chuGoc: p.ten,
  partNo: null,
  impa: null,
  soLuong: 1,
  donVi: "PCS",
  loai: "STORE",
  thietBi: null,
  tenEn: null,
  trang: null,
  canhBao: null,
  ...p,
});

// 1) Chuẩn hóa JSON "bẩn" mà mô hình có thể trả về.
const c = chuanHoaKetQuaAi({
  nhaCungCap: "  Golden Marine Service Group Co.,Limited ",
  soPhieu: "20260412",
  ngayGiao: "2026-04-12",
  tau: "M. ODYSSEY",
  dong: [
    { stt: 1, ten: "Abrasive discs (Đĩa mài)", tenEn: "Abrasive discs", tenVi: "Đĩa mài", impa: "IMPA 570284", soLuong: "25", donVi: "pcs", trang: 1 },
    { stt: 2, ten: "Piston ring set", tenEn: "Piston ring set", partNo: "21001-1234", soLuong: 2, donVi: "Set", loai: "SPARE", thietBi: "MAIN ENGINE", trang: "2" },
    { ten: "Bearing", impa: "ABC-12", soLuong: 1, donVi: "ea", loai: "spare", canKiem: true, lyDoKiem: "số bị mờ" },
    { ten: "", soLuong: 3 },
    { ten: "Cotton rags", impa: 190405, soLuong: null, donVi: null, loai: "STORE", ghiChu: "giao thiếu 5" },
    "khong phai object",
  ],
});
kiemTra("ncc trim", c.nhaCungCap, "Golden Marine Service Group Co.,Limited");
kiemTra("ngay giu nguyen", c.ngayGiao, "2026-04-12");
kiemTra("so dong (bo ten rong + phan tu rac)", c.dong.length, 4);
kiemTra(
  "dong",
  c.dong.map((d) => [d.ten, d.tenEn, d.partNo, d.impa, d.soLuong, d.donVi, d.loai, d.thietBi, d.trang]),
  [
    ["Đĩa mài", "Abrasive discs", null, "570284", 25, "PCS", "STORE", null, 1],
    ["Piston ring set", null, "21001-1234", null, 2, "SET", "SPARE", "MAIN ENGINE", 2],
    ["Bearing", null, "ABC-12", null, 1, "PCS", "SPARE", null, null],
    ["Cotton rags", null, null, "190405", 0, "PCS", "STORE", null, null],
  ]
);
kiemTra("canKiem -> canh bao", c.dong[2].canhBao, "AI không chắc: số bị mờ");
kiemTra("ghi chu giao thieu -> canh bao", c.dong[3].canhBao, "Ghi chú trên phiếu: giao thiếu 5");
kiemTra("chuGoc giu ten in + trang", c.dong[0].chuGoc, "1. Abrasive discs (Đĩa mài) · IMPA 570284 — 25 PCS · tr.1");
kiemTra("tom tat co dau phieu", c.chuTomTat.startsWith("Nhà cung cấp: Golden"), true);
kiemTra("rong -> 0 dong", chuanHoaKetQuaAi(null).dong.length, 0);

// 2) Khuôn JSON cho Gemini: kiểu viết HOA, ["string","null"] -> nullable, enum kèm format.
kiemTra("schema nullable", schemaGemini({ type: ["string", "null"], description: "x" }), { nullable: true, type: "STRING", description: "x" });
const sg = schemaGemini(CONG_CU_GHI_PHIEU.input_schema) as { properties: { dong: { items: { properties: { loai: unknown; trang: unknown } } } } };
kiemTra("schema enum giu + format enum", (sg.properties.dong.items.properties.loai as { format?: string }).format, "enum");
kiemTra("schema trang integer nullable", sg.properties.dong.items.properties.trang, {
  nullable: true,
  type: "INTEGER",
  description: "Số trang của tài liệu (đánh từ 1) mà dòng này nằm.",
});

// 3) Chia cụm trang.
kiemTra("chia: khong biet so trang", chiaTrang(null), [null]);
kiemTra("chia: 4 trang doc mot lan", chiaTrang(4), [null]);
kiemTra("chia: 5 trang", chiaTrang(5), [[1, 3], [4, 5]]);
kiemTra("chia: 7 trang", chiaTrang(7), [[1, 3], [4, 6], [7, 7]]);

// 4) Lời nhắc: phạm vi trang + bảng lượt 1.
kiemTra("loi nhac ca phieu", loiNhac(null, null).includes("CHỈ đọc"), false);
kiemTra("loi nhac trang 4-6 de null dau phieu", /trang 4 đến 6/.test(loiNhac([4, 6], null)) && /để null/.test(loiNhac([4, 6], null)), true);
kiemTra("loi nhac trang 1-3 khong de null", /để null/.test(loiNhac([1, 3], null)), false);
const nhacKiem = loiNhac(null, [dongAi({ ten: "Bearing", soLuong: 2 })]);
kiemTra("loi nhac kiem lai co bang", nhacKiem.includes("LƯỢT 1") && nhacKiem.includes('"ten":"Bearing"'), true);

// 5) Gộp hai lượt.
const l1 = [dongAi({ ten: "Bearing", partNo: "6205", soLuong: 2 }), dongAi({ ten: "Gasket", soLuong: 1 }), dongAi({ ten: "Bolt M10", soLuong: 50 })];
const l2 = [dongAi({ ten: "Bearing", partNo: "6205", soLuong: 3 }), dongAi({ ten: "Gasket", soLuong: 1 }), dongAi({ ten: "Nut M10", soLuong: 50 })];
const gop = gopLuot(l1, l2);
kiemTra("gop: so dong = luot 2 + dong luot 1 mat", gop.length, 4);
kiemTra("gop: sua so luong duoc danh dau", gop[0].canhBao, "Lượt kiểm lại sửa số lượng/đơn vị (lượt 1: 2 PCS)");
kiemTra("gop: dong giu nguyen khong danh dau", gop[1].canhBao, null);
kiemTra("gop: dong moi danh dau", gop[2].canhBao, "Lượt kiểm lại thêm hoặc đổi tên dòng này");
kiemTra("gop: dong mat giu lai + danh dau", [gop[3].ten, gop[3].canhBao?.startsWith("Lượt kiểm lại không thấy")], ["Bolt M10", true]);

// 6) Bộ soát.
const soat = soatDong([
  dongAi({ ten: "Bearing", soLuong: 0 }),
  dongAi({ ten: "Rope", donVi: "DOZ" }),
  dongAi({ ten: "Bearing" }),
  dongAi({ ten: "Fil(?)ter", partNo: "AB-1" }),
  dongAi({ ten: "Ok item", soLuong: 5 }),
]);
kiemTra("soat: so luong 0", soat[0].canhBao, "Số lượng 0 hoặc trống");
kiemTra("soat: don vi la", soat[1].canhBao, 'Đơn vị lạ "DOZ"');
kiemTra("soat: trung", soat[2].canhBao, "Trùng với dòng 1");
kiemTra("soat: chu mo", soat[3].canhBao, "Có chỗ mờ (?)");
kiemTra("soat: dong tot khong danh dau", soat[4].canhBao, null);

const pdf = Buffer.from("%PDF-1.4 gia");
const traVe = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const NHANH = { choThuLaiMs: [10, 10] };
const CLAUDE: CauHinhAi = { nhaCungCap: "claude", apiKey: "khoa-gia-claude", model: "claude-sonnet-5", nguon: "db", cheDo: "nhanh" };
const GEMINI: CauHinhAi = { nhaCungCap: "gemini", apiKey: "khoa-gia-gemini", model: "gemini-2.5-pro", nguon: "db", cheDo: "nhanh" };
const ketQuaClaude = (dong: unknown[] = [{ ten: "Grease gun", impa: "550102", soLuong: 1, donVi: "PCS", loai: "STORE", trang: 1 }]) => ({
  content: [
    { type: "text", text: "Đã đọc." },
    { type: "tool_use", name: CONG_CU_GHI_PHIEU.name, input: { soPhieu: "DN-1", dong } },
  ],
  stop_reason: "tool_use",
  usage: { input_tokens: 1200, output_tokens: 80 },
});
const ketQuaGemini = (dong: unknown[] = [{ ten: "Rubber pads", impa: "591041", soLuong: 100, donVi: "PCS", loai: "STORE" }], soPhieu = "20260412") => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ soPhieu, dong }) }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 70 },
});
type YeuCau = { url: string; init: RequestInit };
const bodyCua = (yc: YeuCau) => JSON.parse(String(yc.init.body));
const textGemini = (yc: YeuCau): string => bodyCua(yc).contents[0].parts[1].text;
const textClaude = (yc: YeuCau): string => bodyCua(yc).messages[0].content[1].text;

async function main() {
  // 7) Claude một lượt: soi yêu cầu và bóc kết quả.
  const cacYc: YeuCau[] = [];
  const tot = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    fileName: "DELIVERY NOTE - 20260412.pdf",
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaClaude());
    },
  });
  kiemTra("claude ok", tot.ok, true);
  if (tot.ok) {
    kiemTra("claude so phieu", tot.soPhieu, "DN-1");
    kiemTra("claude dong", tot.dong.map((d) => [d.ten, d.impa, d.soLuong, d.trang]), [["Grease gun", "550102", 1, 1]]);
    kiemTra("claude token + luot", [tot.tokenVao, tot.tokenRa, tot.soLuotGoi, tot.soDongCanKiem], [1200, 80, 1, 0]);
    kiemTra("claude model", tot.model, "claude-sonnet-5");
  }
  kiemTra("claude 1 luot = 1 goi", cacYc.length, 1);
  kiemTra("claude dia chi", cacYc[0]?.url, DIA_CHI_CLAUDE);
  const h1 = (cacYc[0]?.init.headers ?? {}) as Record<string, string>;
  kiemTra("claude khoa o header", h1["x-api-key"], "khoa-gia-claude");
  kiemTra("claude phien ban api", h1["anthropic-version"], "2023-06-01");
  const b1 = bodyCua(cacYc[0]);
  kiemTra("claude model gui di", b1.model, "claude-sonnet-5");
  kiemTra("claude bat buoc cong cu", b1.tool_choice, { type: "tool", name: "ghi_phieu_giao" });
  const tep = b1.messages[0].content[0];
  kiemTra("claude tai lieu pdf base64", [tep.type, tep.source.media_type, tep.source.data], ["document", "application/pdf", pdf.toString("base64")]);
  kiemTra("claude ten tep", tep.title, "DELIVERY NOTE - 20260412.pdf");
  kiemTra("claude khoa khong lot vao body", String(cacYc[0]?.init.body).includes("khoa-gia-claude"), false);

  // 8) Claude chế độ Kỹ: 2 lượt, lượt 2 mang bảng lượt 1, dòng bị sửa được đánh dấu.
  cacYc.length = 0;
  const ky = await docPhieuGiaoBangAi(pdf, { ...CLAUDE, cheDo: "ky" }, {
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, cacYc.length === 1 ? ketQuaClaude() : ketQuaClaude([{ ten: "Grease gun", impa: "550102", soLuong: 2, donVi: "PCS", loai: "STORE" }]));
    },
  });
  kiemTra("ky: 2 goi", cacYc.length, 2);
  kiemTra("ky: luot 2 mang bang luot 1", textClaude(cacYc[1]).includes("LƯỢT 1") && textClaude(cacYc[1]).includes('"ten":"Grease gun"'), true);
  kiemTra("ky: luot 1 khong mang bang", textClaude(cacYc[0]).includes("LƯỢT 1"), false);
  if (ky.ok) {
    kiemTra("ky: lay so luot 2 + danh dau", [ky.dong[0].soLuong, ky.dong[0].canhBao, ky.soLuotGoi, ky.soDongCanKiem], [
      2,
      "Lượt kiểm lại sửa số lượng/đơn vị (lượt 1: 1 PCS)",
      2,
      1,
    ]);
    kiemTra("ky: token cong don", ky.tokenVao, 2400);
  } else kiemTra("ky ok", ky.ok, true);

  // Lượt kiểm lại hỏng (hết hạn mức) → vẫn trả lượt 1, ghi lỗi phụ.
  cacYc.length = 0;
  const kyHong = await docPhieuGiaoBangAi(pdf, { ...CLAUDE, cheDo: "ky" }, {
    ...NHANH,
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return cacYc.length === 1 ? traVe(200, ketQuaClaude()) : traVe(429, { error: { type: "rate_limit_error", message: "quota" } });
    },
  });
  kiemTra("ky hong: van ok voi luot 1", [kyHong.ok, kyHong.ok ? kyHong.dong.length : 0, kyHong.ok ? kyHong.loiPhu.length : 0], [true, 1, 1]);
  kiemTra("ky hong: 1 + 3 lan goi", cacYc.length, 4);

  // 9) Chia cụm trang: 7 trang, chế độ nhanh → 3 lượt, mỗi lượt đúng phạm vi; đầu phiếu lấy lượt đầu.
  cacYc.length = 0;
  const cum = await docPhieuGiaoBangAi(pdf, GEMINI, {
    soTrang: 7,
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      const n = cacYc.length;
      return traVe(200, ketQuaGemini([{ ten: `Hang cum ${n}`, soLuong: n, donVi: "PCS", loai: "STORE", trang: n * 3 - 2 }], n === 1 ? "DN-CUM" : null as unknown as string));
    },
  });
  kiemTra("cum: 3 goi", cacYc.length, 3);
  kiemTra("cum: pham vi trang", cacYc.map((yc) => (textGemini(yc).match(/trang (\d+) đến (\d+)/) ?? []).slice(1, 3)), [["1", "3"], ["4", "6"], ["7", "7"]]);
  kiemTra("cum: cum sau de null dau phieu", [textGemini(cacYc[0]).includes("để null"), textGemini(cacYc[1]).includes("để null")], [false, true]);
  if (cum.ok) {
    kiemTra("cum: gop dong theo thu tu", cum.dong.map((d) => d.ten), ["Hang cum 1", "Hang cum 2", "Hang cum 3"]);
    kiemTra("cum: so phieu tu cum dau", cum.soPhieu, "DN-CUM");
    kiemTra("cum: token cong don", [cum.tokenVao, cum.soLuotGoi], [2700, 3]);
  } else kiemTra("cum ok", cum.ok, true);
  // Kỹ + cụm: 5 trang → 2 cụm × 2 lượt.
  cacYc.length = 0;
  await docPhieuGiaoBangAi(pdf, { ...GEMINI, cheDo: "ky" }, {
    soTrang: 5,
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaGemini());
    },
  });
  kiemTra("ky + cum: 4 goi", cacYc.length, 4);

  // 10) Gemini một lượt: soi yêu cầu mức đủ đồ.
  cacYc.length = 0;
  const g = await docPhieuGiaoBangAi(pdf, { ...GEMINI, model: "gemini-2.5-flash" }, {
    fileName: "DN.pdf",
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaGemini());
    },
  });
  kiemTra("gemini ok", g.ok, true);
  if (g.ok) {
    kiemTra("gemini so phieu", g.soPhieu, "20260412");
    kiemTra("gemini dong", g.dong.map((d) => [d.ten, d.impa, d.soLuong, d.loai]), [["Rubber pads", "591041", 100, "STORE"]]);
    kiemTra("gemini token", [g.tokenVao, g.tokenRa], [900, 70]);
  }
  kiemTra("gemini dia chi", cacYc[0]?.url, `${DIA_CHI_GEMINI}/models/gemini-2.5-flash:generateContent`);
  const h2 = (cacYc[0]?.init.headers ?? {}) as Record<string, string>;
  kiemTra("gemini khoa o header", h2["x-goog-api-key"], "khoa-gia-gemini");
  kiemTra("gemini khoa khong o url", String(cacYc[0]?.url).includes("khoa-gia"), false);
  const b2 = bodyCua(cacYc[0]);
  kiemTra("gemini json bat buoc", b2.generationConfig.responseMimeType, "application/json");
  kiemTra("gemini schema nullable", b2.generationConfig.responseSchema.properties.dong.items.properties.partNo.nullable, true);
  kiemTra("gemini do phan giai cao", b2.generationConfig.mediaResolution, "MEDIA_RESOLUTION_HIGH");
  kiemTra("gemini flash co ngan sach suy nghi", b2.generationConfig.thinkingConfig, { thinkingBudget: 4096 });
  kiemTra("gemini pdf inline", [b2.contents[0].parts[0].inlineData.mimeType, b2.contents[0].parts[0].inlineData.data], ["application/pdf", pdf.toString("base64")]);
  kiemTra("gemini system instruction", typeof b2.systemInstruction.parts[0].text, "string");
  cacYc.length = 0;
  await docPhieuGiaoBangAi(pdf, GEMINI, {
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaGemini());
    },
  });
  kiemTra("gemini pro khong ep ngan sach suy nghi", bodyCua(cacYc[0]).generationConfig.thinkingConfig, undefined);
  // Gemini bỏ phần "suy nghĩ" khi bóc chữ.
  const gNghi = await docPhieuGiaoBangAi(pdf, GEMINI, {
    fetchFn: async () =>
      traVe(200, {
        candidates: [{ content: { parts: [{ text: "đang nghĩ...", thought: true }, { text: JSON.stringify({ dong: [{ ten: "Rope", soLuong: 1, donVi: "M", loai: "STORE" }] }) }] }, finishReason: "STOP" }],
      }),
  });
  kiemTra("gemini bo phan suy nghi", gNghi.ok && gNghi.dong[0].ten, "Rope");

  // 11) Gemini hạ mức khi API từ chối.
  let soLan = 0;
  const gMedia = await docPhieuGiaoBangAi(pdf, GEMINI, {
    ...NHANH,
    fetchFn: async (_url, init) => {
      soLan++;
      const b = JSON.parse(String(init.body));
      if (b.generationConfig.mediaResolution) {
        return traVe(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: 'Invalid JSON payload received. Unknown name "mediaResolution" at generation_config' } });
      }
      kiemTra("gemini muc 1 van co khuon", "responseSchema" in b.generationConfig, true);
      return traVe(200, ketQuaGemini());
    },
  });
  kiemTra("gemini mediaResolution bi tu choi -> muc 1", [gMedia.ok, soLan], [true, 2]);
  soLan = 0;
  const gKhuon = await docPhieuGiaoBangAi(pdf, GEMINI, {
    ...NHANH,
    fetchFn: async (_url, init) => {
      soLan++;
      const b = JSON.parse(String(init.body));
      if (b.generationConfig.responseSchema) {
        return traVe(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: 'Invalid JSON payload received. Unknown name "nullable" at generation_config.response_schema' } });
      }
      return traVe(200, ketQuaGemini());
    },
  });
  kiemTra("gemini khuon bi tu choi -> muc 2 khong khuon", [gKhuon.ok, soLan], [true, 3]);
  soLan = 0;
  const gKhoa = await docPhieuGiaoBangAi(pdf, GEMINI, {
    ...NHANH,
    fetchFn: async () => {
      soLan++;
      return traVe(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key." } });
    },
  });
  kiemTra("gemini khoa sai: khong ha muc, 1 goi", [gKhoa.ok, soLan], [false, 1]);
  if (!gKhoa.ok) kiemTra("gemini khoa sai thong bao", gKhoa.loi, "Gemini API 400 INVALID_ARGUMENT: API key not valid. Please pass a valid API key.");
  // Hết hạn mức: thử 3 lần rồi mới báo, nguyên văn.
  soLan = 0;
  const hetHanMuc = await docPhieuGiaoBangAi(pdf, GEMINI, {
    ...NHANH,
    fetchFn: async () => {
      soLan++;
      return traVe(429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for quota metric" } });
    },
  });
  kiemTra("429 thu 3 lan roi bao", [hetHanMuc.ok, soLan], [false, 3]);
  if (!hetHanMuc.ok) kiemTra("429 thong bao", hetHanMuc.loi, "Gemini API 429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric");
  // JSON hỏng (bị cắt).
  const gHong = await docPhieuGiaoBangAi(pdf, GEMINI, {
    fetchFn: async () => traVe(200, { candidates: [{ content: { parts: [{ text: '{"dong": [{"ten": "abc' }] }, finishReason: "MAX_TOKENS" }] }),
  });
  kiemTra("gemini json hong -> ok:false", gHong.ok, false);
  // PDF quá lớn: không gọi mạng.
  soLan = 0;
  const gTo = await docPhieuGiaoBangAi(Buffer.alloc(15 * 1024 * 1024), GEMINI, {
    fetchFn: async () => {
      soLan++;
      return traVe(200, ketQuaGemini());
    },
  });
  kiemTra("gemini pdf qua lon -> ok:false, khong goi", [gTo.ok, soLan], [false, 0]);

  // 12) Claude: hạ max_tokens cho mô hình đời cũ; lỗi xác thực; quá tải; mạng; không tool_use.
  soLan = 0;
  let maxTokensLan2 = 0;
  const cMax = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    ...NHANH,
    fetchFn: async (_url, init) => {
      soLan++;
      const b = JSON.parse(String(init.body));
      if (b.max_tokens > 8192) {
        return traVe(400, { error: { type: "invalid_request_error", message: "max_tokens: 32000 > 8192, which is the maximum allowed number of output tokens for this model" } });
      }
      maxTokensLan2 = b.max_tokens;
      return traVe(200, ketQuaClaude());
    },
  });
  kiemTra("claude max_tokens qua cao -> ha xuong 8192", [cMax.ok, soLan, maxTokensLan2], [true, 2, 8192]);
  soLan = 0;
  const sai = await docPhieuGiaoBangAi(pdf, { ...CLAUDE, apiKey: "sai-khoa-de-thu-nghiem" }, {
    ...NHANH,
    fetchFn: async () => {
      soLan++;
      return traVe(401, { error: { type: "authentication_error", message: "invalid x-api-key" } });
    },
  });
  kiemTra("401 -> ok:false, khong thu lai", [sai.ok, soLan], [false, 1]);
  if (!sai.ok) kiemTra("401 thong bao", sai.loi, "Claude API 401 authentication_error: invalid x-api-key");
  soLan = 0;
  const lai = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    ...NHANH,
    fetchFn: async () => {
      soLan++;
      return soLan === 1 ? traVe(529, { error: { type: "overloaded_error", message: "Overloaded" } }) : traVe(200, ketQuaClaude());
    },
  });
  kiemTra("529 roi ok", [lai.ok, soLan], [true, 2]);
  soLan = 0;
  const dut = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    ...NHANH,
    fetchFn: async () => {
      soLan++;
      throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND api.anthropic.com" } });
    },
  });
  kiemTra("mang dut -> ok:false, 2 lan", [dut.ok, soLan], [false, 2]);
  if (!dut.ok) kiemTra("mang dut thong bao", dut.loi, "Không gọi được API (fetch failed: ENOTFOUND)");
  const khong = await docPhieuGiaoBangAi(pdf, CLAUDE, {
    fetchFn: async () => traVe(200, { content: [{ type: "text", text: "..." }], stop_reason: "max_tokens" }),
  });
  kiemTra("khong tool_use -> ok:false", khong.ok, false);
  soLan = 0;
  const chuaKhoa = await docPhieuGiaoBangAi(pdf, null, {
    fetchFn: async () => {
      soLan++;
      return traVe(200, ketQuaClaude());
    },
  });
  kiemTra("chua cau hinh -> ok:false, khong goi", [chuaKhoa.ok, soLan], [false, 0]);

  // 12b) DeepSeek: chỉ chữ — cắt trang, bearer, JSON mode, cụm 2 trang, reasoner không JSON mode.
  const CHU_3_TRANG = "--- trang 1 ---\nNo | Description | Qty | Unit\n1 | Rope | 2 | M\n--- trang 2 ---\n2 | Paint | 3 | CAN\n--- trang 3 ---\n3 | Brush | 4 | PCS\n";
  kiemTra("catTrang giu trang 2-3", catTrang(CHU_3_TRANG, [2, 3]).includes("Paint") && !catTrang(CHU_3_TRANG, [2, 3]).includes("Rope"), true);
  kiemTra("catTrang khong dau -> nguyen", catTrang("khong co dau trang", [1, 1]), "khong co dau trang");
  kiemTra("demTrangTuChu", [demTrangTuChu(CHU_3_TRANG), demTrangTuChu("abc"), demTrangTuChu(null)], [3, null, null]);
  const DEEPSEEK: CauHinhAi = { nhaCungCap: "deepseek", apiKey: "khoa-gia-deepseek", model: "deepseek-chat", nguon: "db", cheDo: "nhanh" };
  const ketQuaDeepseek = (dong: unknown[] = [{ ten: "Rope", soLuong: 2, donVi: "M", loai: "STORE", trang: 1 }], noiDung?: string) => ({
    choices: [{ message: { content: noiDung ?? JSON.stringify({ soPhieu: "DS-1", dong }) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 500, completion_tokens: 40 },
  });
  cacYc.length = 0;
  const ds = await docPhieuGiaoBangAi(pdf, DEEPSEEK, {
    fileName: "DN.pdf",
    chuPdf: "--- trang 1 ---\nNo | Description | Qty | Unit\n1 | Rope | 2 | M\n",
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaDeepseek());
    },
  });
  kiemTra("deepseek ok", ds.ok, true);
  if (ds.ok) {
    kiemTra("deepseek so phieu + dong", [ds.soPhieu, ds.dong.map((d) => [d.ten, d.soLuong, d.donVi])], ["DS-1", [["Rope", 2, "M"]]]);
    kiemTra("deepseek token", [ds.tokenVao, ds.tokenRa, ds.soLuotGoi], [500, 40, 1]);
  }
  kiemTra("deepseek dia chi", cacYc[0]?.url, `${DIA_CHI_DEEPSEEK}/chat/completions`);
  kiemTra("deepseek bearer", ((cacYc[0]?.init.headers ?? {}) as Record<string, string>)["authorization"], "Bearer khoa-gia-deepseek");
  const bDs = bodyCua(cacYc[0]);
  kiemTra("deepseek json mode", bDs.response_format, { type: "json_object" });
  kiemTra("deepseek gui chu phieu", bDs.messages[1].content.includes("VĂN BẢN PHIẾU") && bDs.messages[1].content.includes("1 | Rope | 2 | M"), true);
  kiemTra("deepseek model + khong stream", [bDs.model, bDs.stream, bDs.max_tokens], ["deepseek-chat", false, 8192]);
  // Không có chữ (bản scan) → báo rõ, không gọi mạng.
  cacYc.length = 0;
  const dsKhongChu = await docPhieuGiaoBangAi(pdf, DEEPSEEK, {
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaDeepseek());
    },
  });
  kiemTra("deepseek khong chu -> ok:false, khong goi", [dsKhongChu.ok, cacYc.length, !dsKhongChu.ok ? dsKhongChu.loi : ""], [false, 0, LOI_DEEPSEEK_KHONG_CHU]);
  // 3 trang → cụm 2 trang: 2 lượt, mỗi lượt chỉ mang chữ của trang mình.
  cacYc.length = 0;
  const dsCum = await docPhieuGiaoBangAi(pdf, DEEPSEEK, {
    chuPdf: CHU_3_TRANG,
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      const n = cacYc.length;
      return traVe(200, ketQuaDeepseek([{ ten: `Hang ${n}`, soLuong: n, donVi: "PCS", loai: "STORE" }]));
    },
  });
  kiemTra("deepseek 3 trang -> 2 cum", cacYc.length, 2);
  kiemTra(
    "deepseek moi cum dung trang",
    [bodyCua(cacYc[0]).messages[1].content.includes("Paint"), bodyCua(cacYc[0]).messages[1].content.includes("Brush"), bodyCua(cacYc[1]).messages[1].content.includes("Brush")],
    [true, false, true]
  );
  kiemTra("deepseek gop dong 2 cum", dsCum.ok && dsCum.dong.map((d) => d.ten), ["Hang 1", "Hang 2"]);
  // Mô hình reasoner: không ép JSON mode, bóc JSON trong ```json.
  cacYc.length = 0;
  const dsR = await docPhieuGiaoBangAi(pdf, { ...DEEPSEEK, model: "deepseek-reasoner" }, {
    chuPdf: "--- trang 1 ---\n1 | Rope | 2 | M\n",
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, ketQuaDeepseek([], "Đây là kết quả:\n```json\n" + JSON.stringify({ dong: [{ ten: "Rope", soLuong: 2, donVi: "M", loai: "STORE" }] }) + "\n```"));
    },
  });
  kiemTra("deepseek reasoner khong json mode", "response_format" in bodyCua(cacYc[0]), false);
  kiemTra("deepseek boc json trong fence", dsR.ok && dsR.dong[0].ten, "Rope");
  // Bị cắt dở.
  const dsCat = await docPhieuGiaoBangAi(pdf, DEEPSEEK, {
    chuPdf: "--- trang 1 ---\n1 | Rope | 2 | M\n",
    fetchFn: async () => traVe(200, { choices: [{ message: { content: '{"dong": [{"ten": "Ro' }, finish_reason: "length" }] }),
  });
  kiemTra("deepseek cat do -> ok:false", [dsCat.ok, !dsCat.ok && dsCat.loi.includes("cắt dở")], [false, true]);
  // Lỗi khóa.
  const dsSai = await docPhieuGiaoBangAi(pdf, DEEPSEEK, {
    ...NHANH,
    chuPdf: "--- trang 1 ---\n1 | Rope | 2 | M\n",
    fetchFn: async () => traVe(401, { error: { message: "Authentication Fails, Your api key is invalid", type: "authentication_error" } }),
  });
  kiemTra("deepseek 401 thong bao", !dsSai.ok && dsSai.loi, "DeepSeek API 401 authentication_error: Authentication Fails, Your api key is invalid");

  // 13) Kiểm tra kết nối / liệt kê mô hình.
  cacYc.length = 0;
  const kd = await kiemTraKetNoiAi(DEEPSEEK, {
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, { object: "list", data: [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }] });
    },
  });
  kiemTra("deepseek models", kd, { ok: true, models: ["deepseek-chat", "deepseek-reasoner"], coModel: true });
  kiemTra("deepseek models dia chi + bearer", [cacYc[0]?.url, ((cacYc[0]?.init.headers ?? {}) as Record<string, string>)["authorization"]], [`${DIA_CHI_DEEPSEEK}/models`, "Bearer khoa-gia-deepseek"]);
  cacYc.length = 0;
  const kg = await kiemTraKetNoiAi(GEMINI, {
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
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
  kiemTra("gemini models dia chi", String(cacYc[0]?.url).startsWith(`${DIA_CHI_GEMINI}/models?`), true);
  kiemTra("gemini models khoa o header", ((cacYc[0]?.init.headers ?? {}) as Record<string, string>)["x-goog-api-key"], "khoa-gia-gemini");
  cacYc.length = 0;
  const kc = await kiemTraKetNoiAi({ ...CLAUDE, model: "claude-khong-co" }, {
    fetchFn: async (url, init) => {
      cacYc.push({ url, init });
      return traVe(200, { data: [{ id: "claude-sonnet-5" }, { id: "claude-opus-5" }] });
    },
  });
  kiemTra("claude models, model khong co", kc, { ok: true, models: ["claude-opus-5", "claude-sonnet-5"], coModel: false });
  kiemTra("claude models dia chi", cacYc[0]?.url, DIA_CHI_CLAUDE_MODELS);
  const kSai = await kiemTraKetNoiAi(CLAUDE, {
    fetchFn: async () => traVe(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }),
  });
  kiemTra("models 401 -> ok:false", kSai.ok, false);
  kiemTra("models khong khoa -> ok:false", (await kiemTraKetNoiAi({ ...CLAUDE, apiKey: " " })).ok, false);

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
}
main();
