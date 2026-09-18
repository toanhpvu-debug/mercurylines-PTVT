/**
 * Bộ đọc AI cho phiếu giao hàng: gửi thẳng file PDF (kể cả bản scan nhiều
 * trang) cho một mô hình đọc tài liệu và nhận về BẢNG DÒNG HÀNG có cấu trúc.
 * Hai nhà cung cấp:
 *   - "claude": Anthropic Messages API — ép JSON đúng khuôn bằng tool_choice.
 *   - "gemini": Google AI Studio / Gemini API (generateContent) — ép JSON bằng
 *     responseSchema.
 *
 * Vì sao dùng AI thay cho OCR thường: OCR chỉ trả về chữ rời, còn phải đoán
 * cột nào là số lượng, cột nào là IMPA; bản scan nghiêng, mờ, bảng nhiều trang
 * thì đoán sai nhiều. Mô hình nhìn cả trang như người đọc: hiểu tiêu đề cột,
 * nhóm thiết bị, dòng gạch bỏ. Và nó chạy ở mọi nơi — kể cả container Linux
 * của máy chủ, nơi không có Windows.Media.Ocr.
 *
 * Kết quả vẫn chỉ là ĐIỀN SẴN: người duyệt đối chiếu với bản scan rồi mới
 * duyệt (xem app/phieu-giao-actions.ts). Cấu hình (nhà cung cấp, khóa, mô
 * hình) do lib/cauHinhAi.ts cấp — nhập trong app tại /cai-dat/ai hoặc biến môi
 * trường. Khóa không bao giờ được ghi log hay trả về giao diện.
 *
 * File này KHÔNG đụng database (chỉ nhận cấu hình đã giải) để kiểm thử được
 * bằng fetch giả: scripts/kiem-tra-doc-ai.ts.
 */
import { chuanDonVi, type DongPhieuGiao } from "@/lib/phieuGiaoParse";

export type NhaCungCapAi = "claude" | "gemini";
export const NHA_CUNG_CAP_AI: readonly NhaCungCapAi[] = ["claude", "gemini"];
export const MODEL_MAC_DINH: Record<NhaCungCapAi, string> = {
  claude: "claude-sonnet-5",
  gemini: "gemini-2.5-pro",
};
export const TEN_NHA_CUNG_CAP: Record<NhaCungCapAi, string> = {
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google AI Studio)",
};

/** Cấu hình đã giải mã, sẵn sàng gọi. */
export type CauHinhAi = {
  nhaCungCap: NhaCungCapAi;
  apiKey: string;
  model: string;
  /** "db" = quản trị nhập trong app; "env" = biến môi trường. */
  nguon: "db" | "env";
};

export const DIA_CHI_CLAUDE = "https://api.anthropic.com/v1/messages";
export const DIA_CHI_CLAUDE_MODELS = "https://api.anthropic.com/v1/models?limit=100";
export const DIA_CHI_GEMINI = "https://generativelanguage.googleapis.com/v1beta";
/** Gemini nhận PDF gửi kèm (inline) tới ~20 MB cả gói; base64 phình 4/3 nên chặn ở 14 MB. */
export const GEMINI_PDF_TOI_DA = 14 * 1024 * 1024;

export type DocAiThanhCong = {
  ok: true;
  dong: DongPhieuGiao[];
  nhaCungCap: string | null;
  soPhieu: string | null;
  ngayGiao: string | null;
  tau: string | null;
  /** Bản chữ tóm tắt những gì AI đọc — hiện ở ô "Chữ đọc được" cho người duyệt soi. */
  chuTomTat: string;
  model: string;
  tokenVao: number;
  tokenRa: number;
};
export type KetQuaDocAi = DocAiThanhCong | { ok: false; loi: string };

export const CONG_CU_GHI_PHIEU = {
  name: "ghi_phieu_giao",
  description:
    "Ghi lại toàn bộ nội dung phiếu giao hàng đã đọc: thông tin đầu phiếu và TỪNG dòng hàng, mỗi dòng trên phiếu là một phần tử của mảng dong.",
  input_schema: {
    type: "object",
    properties: {
      nhaCungCap: { type: ["string", "null"], description: "Tên nhà cung cấp / bên giao hàng, đúng như in trên phiếu." },
      soPhieu: { type: ["string", "null"], description: "Số phiếu giao (Delivery Note No. / D/N No. / Invoice No. / Số phiếu)." },
      ngayGiao: { type: ["string", "null"], description: "Ngày giao, ghi dạng dd/mm/yyyy." },
      tau: { type: ["string", "null"], description: "Tên tàu ghi trên phiếu (Vessel / M/V)." },
      dong: {
        type: "array",
        description: "Mọi dòng hàng trên phiếu, theo thứ tự xuất hiện, qua hết các trang.",
        items: {
          type: "object",
          properties: {
            stt: { type: ["integer", "null"], description: "Số thứ tự in trên phiếu nếu có." },
            ten: { type: "string", description: "Tên / mô tả hàng đúng như in trên phiếu: không dịch, không rút gọn, không sửa." },
            partNo: { type: ["string", "null"], description: "Part No. / mã của nhà sản xuất (KHÔNG phải IMPA)." },
            impa: { type: ["string", "null"], description: "Mã IMPA đúng 6 chữ số nếu phiếu có cột IMPA." },
            soLuong: { type: ["number", "null"], description: "Số lượng GIAO (delivered / Q'ty), là số." },
            donVi: { type: ["string", "null"], description: "Đơn vị đúng như cột đơn vị: PCS, SET, KG, LTR, M, BOX, ROLL, PAIR, CAN, DRUM..." },
            loai: {
              type: "string",
              enum: ["STORE", "SPARE"],
              description: "STORE = vật tư tiêu hao / ship stores (hàng theo IMPA, boong, buồng, bếp, dụng cụ). SPARE = phụ tùng máy móc, thiết bị.",
            },
            thietBi: {
              type: ["string", "null"],
              description: "Thiết bị / máy hoặc bộ phận mà dòng thuộc về, lấy từ tiêu đề nhóm trên phiếu (MAIN ENGINE, A/E No.2, DECK DEPARTMENT...). Không có thì null.",
            },
            ghiChu: { type: ["string", "null"], description: "Ghi chú riêng của dòng nếu phiếu có (giao thiếu, thay thế, gạch bỏ...)." },
          },
          required: ["ten", "loai"],
        },
      },
    },
    required: ["dong"],
  },
} as const;

export const HUONG_DAN_HE_THONG = `Bạn là nhân viên nhập liệu kho của tàu biển. Nhiệm vụ: đọc phiếu giao hàng (delivery note / packing list / invoice kèm hàng) của nhà cung cấp — có thể là bản scan nghiêng, mờ, nhiều trang, tiếng Anh hoặc tiếng Việt — rồi ghi lại theo đúng cấu trúc yêu cầu.

Quy tắc:
1. MỖI dòng hàng trên phiếu là MỘT phần tử trong "dong", kể cả dòng số lượng giao bằng 0 hay bị gạch bỏ (ghi vào ghiChu). Không gộp, không bỏ sót, không bịa thêm. Đọc hết mọi trang.
2. "ten" giữ nguyên như in trên phiếu: không dịch, không sửa chính tả, không rút gọn. Chỗ mờ không đọc được thì ghi phần đọc được kèm "(?)".
3. IMPA là mã 6 chữ số của danh mục ship stores; Part No. là mã của nhà sản xuất. Đừng lẫn hai cột; không có thì null.
4. "soLuong" là số lượng THỰC GIAO. Phiếu có cả cột đặt (ordered/req.) và cột giao (delivered/supplied) thì lấy cột giao; chỉ có một cột số lượng thì lấy cột đó.
5. "donVi" ghi đúng cột đơn vị trên phiếu (PCS, SET, KG, LTR, M, BOX, ROLL, PAIR, CAN, DRUM, BTL...).
6. "loai": STORE cho vật tư tiêu hao / ship stores (hàng theo IMPA, boong, buồng, bếp, dụng cụ, hóa chất vệ sinh); SPARE cho phụ tùng máy móc, thiết bị (piston ring, bearing, gasket, filter element, valve...).
7. "thietBi": nếu phiếu chia nhóm theo máy / thiết bị / bộ phận (MAIN ENGINE, A/E No.2, DECK DEPARTMENT...), ghi tên nhóm vào từng dòng thuộc nhóm đó; không chia thì null.
8. Không ghi dòng tổng cộng, chữ ký, điều khoản, địa chỉ vào "dong".
9. Đầu phiếu: nhaCungCap, soPhieu, ngayGiao (dd/mm/yyyy), tau — không rõ thì null.`;

const LOI_NHAC_NGUOI_DUNG = "Đọc phiếu giao hàng trong tài liệu đính kèm và ghi TOÀN BỘ dòng hàng theo đúng cấu trúc yêu cầu.";

/** Khuôn JSON nhắc thêm cho Gemini — để khi phải bỏ responseSchema (API từ chối khuôn) mô hình vẫn trả đúng dạng. */
const KHUON_JSON_GOI_Y =
  'Trả về DUY NHẤT một JSON dạng: {"nhaCungCap": string|null, "soPhieu": string|null, "ngayGiao": "dd/mm/yyyy"|null, "tau": string|null, "dong": [{"stt": number|null, "ten": string, "partNo": string|null, "impa": "6 chữ số"|null, "soLuong": number|null, "donVi": string|null, "loai": "STORE"|"SPARE", "thietBi": string|null, "ghiChu": string|null}]}';

/**
 * Chuyển JSON Schema của công cụ sang khuôn responseSchema của Gemini: kiểu viết
 * HOA, không nhận mảng kiểu ["string","null"] mà dùng nullable: true, và enum
 * trên chuỗi phải kèm format "enum".
 */
export function schemaGemini(schema: unknown): Record<string, unknown> {
  const s = (schema && typeof schema === "object" ? schema : {}) as Record<string, unknown>;
  const ra: Record<string, unknown> = {};
  let kieu = s.type;
  if (Array.isArray(kieu)) {
    const khacNull = kieu.filter((k) => k !== "null");
    if (khacNull.length !== kieu.length) ra.nullable = true;
    kieu = khacNull[0];
  }
  if (typeof kieu === "string") ra.type = kieu.toUpperCase();
  if (typeof s.description === "string") ra.description = s.description;
  if (Array.isArray(s.enum)) {
    ra.enum = s.enum;
    if (ra.type === "STRING") ra.format = "enum";
  }
  if (Array.isArray(s.required)) ra.required = s.required;
  if (s.properties && typeof s.properties === "object") {
    const p: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.properties as Record<string, unknown>)) p[k] = schemaGemini(v);
    ra.properties = p;
  }
  if (s.items) ra.items = schemaGemini(s.items);
  return ra;
}

type DongTho = {
  stt?: unknown;
  ten?: unknown;
  partNo?: unknown;
  impa?: unknown;
  soLuong?: unknown;
  donVi?: unknown;
  loai?: unknown;
  thietBi?: unknown;
  ghiChu?: unknown;
};

const chuoi = (v: unknown, toiDa = 200): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim().slice(0, toiDa);
  return s ? s : null;
};

/**
 * Làm sạch kết quả AI trả về thành dòng của bộ tách (cùng kiểu với lớp chữ /
 * OCR) — thuần chuỗi. Mô hình đôi khi trả số lượng dạng chuỗi, IMPA kèm chữ
 * "IMPA", đơn vị viết thường... nên chuẩn hóa ở đây thay vì tin mù vào JSON.
 */
export function chuanHoaKetQuaAi(input: unknown): Omit<DocAiThanhCong, "ok" | "model" | "tokenVao" | "tokenRa"> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const nhaCungCap = chuoi(o.nhaCungCap);
  const soPhieu = chuoi(o.soPhieu, 80);
  const ngayGiao = chuoi(o.ngayGiao, 20);
  const tau = chuoi(o.tau, 80);
  const dong: DongPhieuGiao[] = [];
  const tho = Array.isArray(o.dong) ? (o.dong as DongTho[]) : [];
  for (let i = 0; i < tho.length; i++) {
    const d = tho[i] && typeof tho[i] === "object" ? tho[i] : {};
    const ten = chuoi(d.ten);
    if (!ten || ten.length < 2) continue;
    let partNo = chuoi(d.partNo, 80);
    let impa: string | null = null;
    const impaTho = chuoi(d.impa, 40);
    if (impaTho) {
      const so = impaTho.replace(/\D/g, "");
      if (/^\d{6}$/.test(so)) impa = so;
      else if (!partNo) partNo = impaTho; // mô hình nhét mã NSX vào cột IMPA
    }
    const soRaw = d.soLuong;
    let soLuong = typeof soRaw === "number" ? soRaw : Number(String(soRaw ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!Number.isFinite(soLuong) || soLuong < 0) soLuong = 0;
    const donViTho = chuoi(d.donVi, 20);
    const donVi = donViTho ? chuanDonVi(donViTho) : "PCS";
    const loaiTho = String(d.loai ?? "").toUpperCase();
    const loai: "STORE" | "SPARE" = loaiTho === "STORE" || loaiTho === "SPARE" ? loaiTho : impa ? "STORE" : "SPARE";
    const thietBi = chuoi(d.thietBi, 120);
    const ghiChu = chuoi(d.ghiChu, 200);
    const stt = Number.isInteger(d.stt) ? Number(d.stt) : i + 1;
    const chuGoc = `${stt}. ${ten}${partNo ? ` · P/N ${partNo}` : ""}${impa ? ` · IMPA ${impa}` : ""} — ${soLuong} ${donVi}${
      thietBi ? ` · ${thietBi}` : ""
    }${ghiChu ? ` (${ghiChu})` : ""}`;
    dong.push({ chuGoc: chuGoc.slice(0, 500), ten, partNo, impa, soLuong, donVi, loai, thietBi });
  }
  const dau = [
    nhaCungCap ? `Nhà cung cấp: ${nhaCungCap}` : null,
    soPhieu ? `Số phiếu: ${soPhieu}` : null,
    ngayGiao ? `Ngày giao: ${ngayGiao}` : null,
    tau ? `Tàu: ${tau}` : null,
  ].filter(Boolean);
  const chuTomTat = [...dau, `— ${dong.length} dòng hàng —`, ...dong.map((d) => d.chuGoc)].join("\n");
  return { dong, nhaCungCap, soPhieu, ngayGiao, tau, chuTomTat };
}

export type FetchGia = (url: string, init: RequestInit) => Promise<Response>;

type TuyChonDocAi = {
  fileName?: string;
  timeoutMs?: number;
  /** Để kiểm thử thay fetch thật. */
  fetchFn?: FetchGia;
  /** Thời gian chờ trước mỗi lần thử lại (ms) — kiểm thử đặt ngắn. */
  choThuLaiMs?: number[];
};

/** Hết hạn mức (429) hay quá tải (529/5xx): chờ 5 s rồi 15 s — hạn mức phút của gói miễn phí thường mở lại trong khoảng đó. */
const CHO_THU_LAI_MAC_DINH = [5000, 15000];

function moTaNguyenNhan(e: unknown, timeoutMs: number): string {
  if (!(e instanceof Error)) return String(e);
  if (e.name === "AbortError") return `quá ${Math.round(timeoutMs / 1000)} giây không có trả lời`;
  const cause = (e as Error & { cause?: { code?: string; message?: string } }).cause;
  const them = cause?.code ?? cause?.message;
  return them ? `${e.message}: ${them}` : e.message;
}

function moTaLoiClaude(status: number, json: unknown): string {
  const e = (json as { error?: { type?: string; message?: string } } | null)?.error;
  return `Claude API ${status}${e?.type ? ` ${e.type}` : ""}${e?.message ? `: ${e.message}` : ""}`.slice(0, 300);
}

function moTaLoiGemini(status: number, json: unknown): string {
  const e = (json as { error?: { status?: string; message?: string } } | null)?.error;
  return `Gemini API ${status}${e?.status ? ` ${e.status}` : ""}${e?.message ? `: ${e.message}` : ""}`.slice(0, 300);
}

type KetQuaGoi = { ok: true; json: unknown } | { ok: false; loi: string; status?: number };

/**
 * Gọi có thử lại: 429 (hết hạn mức) / 529 / 5xx → thử tới 3 lần, chờ theo
 * choThuLaiMs; mất mạng / quá giờ → thử lại một lần. Lỗi 4xx khác trả ngay kèm
 * mã để nơi gọi đổi cách gọi (khuôn JSON, giới hạn token).
 */
async function goiCoThuLai(
  fetchFn: FetchGia,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  moTaLoi: (status: number, json: unknown) => string,
  choThuLaiMs: number[] = CHO_THU_LAI_MAC_DINH
): Promise<KetQuaGoi> {
  let loiCuoi = "";
  let statusCuoi: number | undefined;
  for (let lan = 0; lan <= choThuLaiMs.length; lan++) {
    if (lan > 0) await new Promise((r) => setTimeout(r, choThuLaiMs[lan - 1]));
    const ac = new AbortController();
    const dongHo = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { ...init, signal: ac.signal });
      const json = await res.json().catch(() => null);
      if (res.ok) return { ok: true, json };
      loiCuoi = moTaLoi(res.status, json);
      statusCuoi = res.status;
      if (res.status === 429 || res.status >= 500) continue;
      return { ok: false, loi: loiCuoi, status: res.status };
    } catch (e) {
      loiCuoi = `Không gọi được API (${moTaNguyenNhan(e, timeoutMs)})`.slice(0, 300);
      statusCuoi = undefined;
      if (lan < 1) continue;
      return { ok: false, loi: loiCuoi };
    } finally {
      clearTimeout(dongHo);
    }
  }
  return { ok: false, loi: loiCuoi || "Không rõ lỗi.", status: statusCuoi };
}

async function docBangClaude(pdf: Buffer, ch: CauHinhAi, tc: TuyChonDocAi, fetchFn: FetchGia, timeoutMs: number): Promise<KetQuaDocAi> {
  const body = (maxTokens: number) =>
    JSON.stringify({
      model: ch.model,
      max_tokens: maxTokens,
      system: HUONG_DAN_HE_THONG,
      tools: [CONG_CU_GHI_PHIEU],
      tool_choice: { type: "tool", name: CONG_CU_GHI_PHIEU.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
              title: tc.fileName?.slice(0, 200) || "phieu-giao.pdf",
            },
            { type: "text", text: LOI_NHAC_NGUOI_DUNG },
          ],
        },
      ],
    });
  const goi = (maxTokens: number) =>
    goiCoThuLai(
      fetchFn,
      DIA_CHI_CLAUDE,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": ch.apiKey, "anthropic-version": "2023-06-01" },
        body: body(maxTokens),
      },
      timeoutMs,
      moTaLoiClaude,
      tc.choThuLaiMs
    );
  let r = await goi(32_000);
  // Mô hình đời cũ chỉ cho 8192 token ra: API báo 400 nhắc max_tokens → gọi lại với mức đó.
  if (!r.ok && r.status === 400 && /max_tokens/i.test(r.loi)) r = await goi(8192);
  if (!r.ok) return r;
  const json = r.json as {
    content?: { type: string; name?: string; input?: unknown }[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  } | null;
  const congCu = json?.content?.find((c) => c.type === "tool_use" && c.name === CONG_CU_GHI_PHIEU.name);
  if (!congCu) {
    return { ok: false, loi: `AI không trả về kết quả có cấu trúc (stop_reason: ${json?.stop_reason ?? "?"}).` };
  }
  return {
    ok: true,
    ...chuanHoaKetQuaAi(congCu.input),
    model: ch.model,
    tokenVao: json?.usage?.input_tokens ?? 0,
    tokenRa: json?.usage?.output_tokens ?? 0,
  };
}

async function docBangGemini(pdf: Buffer, ch: CauHinhAi, tc: TuyChonDocAi, fetchFn: FetchGia, timeoutMs: number): Promise<KetQuaDocAi> {
  if (pdf.length > GEMINI_PDF_TOI_DA) {
    return { ok: false, loi: `PDF ${Math.round(pdf.length / 1024 / 1024)} MB quá lớn cho Gemini (tối đa 14 MB) — nén bản scan hoặc dùng Claude.` };
  }
  const body = (coSchema: boolean) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: HUONG_DAN_HE_THONG }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
            { text: `${LOI_NHAC_NGUOI_DUNG}${tc.fileName ? ` (tệp: ${tc.fileName.slice(0, 200)})` : ""}\n${KHUON_JSON_GOI_Y}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        ...(coSchema ? { responseSchema: schemaGemini(CONG_CU_GHI_PHIEU.input_schema) } : {}),
      },
    });
  const url = `${DIA_CHI_GEMINI}/models/${encodeURIComponent(ch.model)}:generateContent`;
  const goi = (coSchema: boolean) =>
    goiCoThuLai(
      fetchFn,
      url,
      { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": ch.apiKey }, body: body(coSchema) },
      timeoutMs,
      moTaLoiGemini,
      tc.choThuLaiMs
    );
  let r = await goi(true);
  // Phiên bản API / mô hình không nhận khuôn responseSchema (400 nhắc schema,
  // "Unknown name", "Invalid JSON payload"): gọi lại chỉ với chế độ JSON + khuôn
  // gợi ý trong lời nhắc — kết quả vẫn qua chuanHoaKetQuaAi nên không tin mù.
  if (!r.ok && r.status === 400 && /schema|unknown name|invalid json payload|nullable|format/i.test(r.loi)) r = await goi(false);
  if (!r.ok) return r;
  const json = r.json as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } | null;
  const ung = json?.candidates?.[0];
  const text = (ung?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text.trim()) {
    const lyDo = json?.promptFeedback?.blockReason ?? ung?.finishReason ?? "?";
    return { ok: false, loi: `AI không trả về nội dung (lý do: ${lyDo}).` };
  }
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return { ok: false, loi: `AI trả về JSON hỏng (finishReason: ${ung?.finishReason ?? "?"}).` };
  }
  return {
    ok: true,
    ...chuanHoaKetQuaAi(input),
    model: ch.model,
    tokenVao: json?.usageMetadata?.promptTokenCount ?? 0,
    tokenRa: json?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** Đọc phiếu bằng cấu hình đã giải (null = chưa cấu hình → ok:false, không gọi mạng). */
export async function docPhieuGiaoBangAi(pdf: Buffer, cauHinh: CauHinhAi | null, tuyChon: TuyChonDocAi = {}): Promise<KetQuaDocAi> {
  if (!cauHinh || !cauHinh.apiKey.trim()) return { ok: false, loi: "Chưa cấu hình bộ đọc AI." };
  const fetchFn = tuyChon.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const timeoutMs = tuyChon.timeoutMs ?? 180_000;
  const ch = { ...cauHinh, apiKey: cauHinh.apiKey.trim(), model: cauHinh.model.trim() || MODEL_MAC_DINH[cauHinh.nhaCungCap] };
  return ch.nhaCungCap === "gemini"
    ? docBangGemini(pdf, ch, tuyChon, fetchFn, timeoutMs)
    : docBangClaude(pdf, ch, tuyChon, fetchFn, timeoutMs);
}

export type KetQuaKiemTraAi =
  | { ok: true; models: string[]; coModel: boolean }
  | { ok: false; loi: string };

/**
 * Kiểm tra khóa + liệt kê mô hình khả dụng (không tốn token): Claude qua
 * GET /v1/models, Gemini qua GET /v1beta/models (chỉ giữ mô hình sinh nội dung).
 * Trang cấu hình dùng để xác nhận khóa đúng và gợi ý tên mô hình.
 */
export async function kiemTraKetNoiAi(cauHinh: CauHinhAi, tuyChon: TuyChonDocAi = {}): Promise<KetQuaKiemTraAi> {
  const fetchFn = tuyChon.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const timeoutMs = tuyChon.timeoutMs ?? 30_000;
  const apiKey = cauHinh.apiKey.trim();
  if (!apiKey) return { ok: false, loi: "Chưa có khóa API." };
  let models: string[] = [];
  if (cauHinh.nhaCungCap === "gemini") {
    const r = await goiCoThuLai(
      fetchFn,
      `${DIA_CHI_GEMINI}/models?pageSize=200`,
      { method: "GET", headers: { "x-goog-api-key": apiKey } },
      timeoutMs,
      moTaLoiGemini,
      tuyChon.choThuLaiMs
    );
    if (!r.ok) return r;
    const json = r.json as { models?: { name?: string; supportedGenerationMethods?: string[] }[] } | null;
    models = (json?.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  } else {
    const r = await goiCoThuLai(
      fetchFn,
      DIA_CHI_CLAUDE_MODELS,
      { method: "GET", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } },
      timeoutMs,
      moTaLoiClaude,
      tuyChon.choThuLaiMs
    );
    if (!r.ok) return r;
    const json = r.json as { data?: { id?: string }[] } | null;
    models = (json?.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
  }
  models.sort();
  const model = cauHinh.model.trim() || MODEL_MAC_DINH[cauHinh.nhaCungCap];
  return { ok: true, models, coModel: models.includes(model) };
}
