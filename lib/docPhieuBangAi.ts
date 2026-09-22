/**
 * Bộ đọc AI cho phiếu giao hàng: gửi thẳng file PDF (kể cả bản scan nhiều
 * trang) cho một mô hình đọc tài liệu và nhận về BẢNG DÒNG HÀNG có cấu trúc.
 * Hai nhà cung cấp:
 *   - "claude": Anthropic Messages API — ép JSON đúng khuôn bằng tool_choice.
 *   - "gemini": Google AI Studio / Gemini API (generateContent) — ép JSON bằng
 *     responseSchema, độ phân giải ảnh cao, bật "suy nghĩ" cho dòng flash.
 *
 * Bốn việc làm cho kết quả CHÍNH XÁC hơn một lần gọi đơn thuần:
 *   1. Lượt KIỂM LẠI (chế độ "ky"): gửi lại tài liệu kèm bảng lượt 1, bắt mô
 *      hình đối chiếu từng dòng — sửa số đọc sai, thêm dòng sót. Dòng bị đổi
 *      hay thêm được ĐÁNH DẤU để người duyệt soi.
 *   2. Đọc theo CỤM TRANG (phiếu > 4 trang, mỗi cụm 3 trang): mô hình tập
 *      trung vào ít trang thì ít sót dòng, và không vướng giới hạn đầu ra.
 *   3. Bộ SOÁT sau đọc: số lượng 0, đơn vị lạ, dòng trùng, chữ mờ "(?)", chỗ
 *      mô hình tự nhận không chắc → cảnh báo trên từng dòng.
 *   4. Tách tên tiếng Anh / tiếng Việt trên phiếu song ngữ, ghi số trang của
 *      từng dòng để trang duyệt nhảy tới đúng chỗ trên bản scan.
 *
 * Kết quả vẫn chỉ là ĐIỀN SẴN: người duyệt đối chiếu với bản scan rồi mới
 * duyệt (xem app/phieu-giao-actions.ts). Cấu hình do lib/cauHinhAi.ts cấp.
 * Khóa không bao giờ được ghi log hay trả về giao diện.
 *
 * File này KHÔNG đụng database (chỉ nhận cấu hình đã giải) để kiểm thử được
 * bằng fetch giả: scripts/kiem-tra-doc-ai.ts.
 */
import { chuanDonVi, type DongPhieuGiao } from "@/lib/phieuGiaoParse";

/**
 * "deepseek": API của DeepSeek (OpenAI-compatible) CHỈ NHẬN CHỮ — không nhận
 * ảnh hay PDF. Nơi gọi phải tách chữ trước (lớp chữ PDF bằng pdfjs, hoặc OCR
 * Windows cho bản scan) và đưa vào tuyChon.chuPdf; không có chữ thì báo rõ.
 */
export type NhaCungCapAi = "claude" | "gemini" | "deepseek";
export const NHA_CUNG_CAP_AI: readonly NhaCungCapAi[] = ["claude", "gemini", "deepseek"];
/** "ky" = 2 lượt (đọc + kiểm lại), "nhanh" = 1 lượt. */
export type CheDoDocAi = "nhanh" | "ky";
export const CHE_DO_DOC_AI: readonly CheDoDocAi[] = ["nhanh", "ky"];
export const MODEL_MAC_DINH: Record<NhaCungCapAi, string> = {
  claude: "claude-sonnet-5",
  gemini: "gemini-2.5-pro",
  deepseek: "deepseek-chat",
};
export const TEN_NHA_CUNG_CAP: Record<NhaCungCapAi, string> = {
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google AI Studio)",
  deepseek: "DeepSeek",
};
/** Nhà cung cấp chỉ đọc chữ (cần tách chữ từ PDF trước). */
export const CHI_DOC_CHU: readonly NhaCungCapAi[] = ["deepseek"];
/** Phiếu dài hơn NGUONG_CHIA_CUM trang thì đọc từng cụm TRANG_MOI_CUM trang. */
export const TRANG_MOI_CUM = 3;
export const NGUONG_CHIA_CUM = 4;

/** Cấu hình đã giải mã, sẵn sàng gọi. */
export type CauHinhAi = {
  nhaCungCap: NhaCungCapAi;
  apiKey: string;
  model: string;
  /** "db" = quản trị nhập trong app; "env" = biến môi trường. */
  nguon: "db" | "env";
  cheDo?: CheDoDocAi;
};

export const DIA_CHI_CLAUDE = "https://api.anthropic.com/v1/messages";
export const DIA_CHI_CLAUDE_MODELS = "https://api.anthropic.com/v1/models?limit=100";
export const DIA_CHI_GEMINI = "https://generativelanguage.googleapis.com/v1beta";
export const DIA_CHI_DEEPSEEK = "https://api.deepseek.com";
/** DeepSeek trả tối đa 8K token/lượt → đọc từng cụm 2 trang khi phiếu dài hơn 2 trang. */
export const DEEPSEEK_TRANG_MOI_CUM = 2;
/** Gemini nhận PDF gửi kèm (inline) tới ~20 MB cả gói; base64 phình 4/3 nên chặn ở 14 MB. */
export const GEMINI_PDF_TOI_DA = 14 * 1024 * 1024;

/** Dòng do AI đọc: dòng của bộ tách + tên tiếng Anh, trang, cảnh báo. */
export type DongAi = DongPhieuGiao & {
  tenEn: string | null;
  trang: number | null;
  canhBao: string | null;
};

export type DauPhieu = {
  nhaCungCap: string | null;
  soPhieu: string | null;
  ngayGiao: string | null;
  tau: string | null;
};

export type DocAiThanhCong = DauPhieu & {
  ok: true;
  dong: DongAi[];
  /** Bản chữ tóm tắt những gì AI đọc — hiện ở ô "Chữ đọc được" cho người duyệt soi. */
  chuTomTat: string;
  model: string;
  tokenVao: number;
  tokenRa: number;
  soLuotGoi: number;
  soDongCanKiem: number;
  /** Lỗi không chặn kết quả (VD lượt kiểm lại hỏng, đã dùng lượt 1). */
  loiPhu: string[];
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
        description: "Mọi dòng hàng trên phiếu, theo thứ tự xuất hiện, qua hết các trang được yêu cầu.",
        items: {
          type: "object",
          properties: {
            stt: { type: ["integer", "null"], description: "Số thứ tự in trên phiếu nếu có." },
            ten: { type: "string", description: "Mô tả hàng ĐÚNG NHƯ IN trên phiếu, giữ cả hai ngôn ngữ nếu song ngữ: không dịch, không rút gọn, không sửa." },
            tenEn: { type: ["string", "null"], description: "Phần tên TIẾNG ANH trong mô tả (nếu phiếu in tiếng Anh hoặc song ngữ); không có thì null." },
            tenVi: { type: ["string", "null"], description: "Phần tên TIẾNG VIỆT trong mô tả (thường trong ngoặc hoặc dòng dưới); không có thì null. Không tự dịch." },
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
            trang: { type: ["integer", "null"], description: "Số trang của tài liệu (đánh từ 1) mà dòng này nằm." },
            canKiem: { type: ["boolean", "null"], description: "true nếu chỗ này mờ, bị che, sửa tay hay bạn KHÔNG CHẮC đã đọc đúng." },
            lyDoKiem: { type: ["string", "null"], description: "Khi canKiem = true: nói ngắn vì sao (chữ mờ, số bị gạch sửa, cột không rõ...)." },
            ghiChu: { type: ["string", "null"], description: "Ghi chú riêng của dòng nếu phiếu có (giao thiếu, thay thế, gạch bỏ...)." },
          },
          required: ["ten", "loai"],
        },
      },
    },
    required: ["dong"],
  },
} as const;

export const HUONG_DAN_HE_THONG = `Bạn là nhân viên nhập liệu kho của tàu biển, tỉ mỉ và không bao giờ đoán bừa. Nhiệm vụ: đọc phiếu giao hàng (delivery note / packing list / invoice kèm hàng) của nhà cung cấp — có thể là bản scan nghiêng, mờ, nhiều trang, tiếng Anh hoặc tiếng Việt — rồi ghi lại theo đúng cấu trúc yêu cầu.

Quy tắc:
1. MỖI dòng hàng trên phiếu là MỘT phần tử trong "dong", kể cả dòng số lượng giao bằng 0 hay bị gạch bỏ (ghi vào ghiChu). Không gộp, không bỏ sót, không bịa thêm. Đọc hết các trang được yêu cầu, kể cả bảng tiếp trang sau; dòng cuối mỗi trang và dòng đầu trang sau hay bị sót — kiểm kỹ.
2. "ten" giữ nguyên như in trên phiếu: không dịch, không sửa chính tả, không rút gọn. Phiếu in song ngữ (VD "Abrasive discs (Đĩa mài)") thì tách thêm tenEn = "Abrasive discs", tenVi = "Đĩa mài"; phiếu chỉ tiếng Anh thì tenEn = ten, tenVi = null; chỉ tiếng Việt thì tenVi = ten, tenEn = null. Không tự dịch để điền phần thiếu.
3. IMPA là mã 6 chữ số của danh mục ship stores; Part No. là mã của nhà sản xuất. Đừng lẫn hai cột; không có thì null. Đọc số cẩn thận: 0/6/8, 1/7, 3/8 hay lẫn trên bản scan — chỗ không chắc đặt canKiem = true.
4. "soLuong" là số lượng THỰC GIAO. Phiếu có cả cột đặt (ordered / req.) và cột giao (delivered / supplied) thì lấy cột giao; chỉ có một cột số lượng thì lấy cột đó. Số thập phân giữ nguyên.
5. "donVi" ghi đúng cột đơn vị trên phiếu (PCS, SET, KG, LTR, M, BOX, ROLL, PAIR, CAN, DRUM, BTL...).
6. "loai": STORE cho vật tư tiêu hao / ship stores (hàng theo IMPA, boong, buồng, bếp, dụng cụ, hóa chất vệ sinh); SPARE cho phụ tùng máy móc, thiết bị (piston ring, bearing, gasket, filter element, valve...).
7. "thietBi": nếu phiếu chia nhóm theo máy / thiết bị / bộ phận (MAIN ENGINE, A/E No.2, DECK DEPARTMENT, ENGINE DEPARTMENT...), ghi tên nhóm vào từng dòng thuộc nhóm đó; không chia thì null.
8. "trang": số trang (đánh từ 1) mà dòng nằm. "canKiem" = true ở bất kỳ chỗ nào chữ mờ, số bị che, sửa tay, hoặc bạn không chắc — thà đánh dấu thừa còn hơn để lọt số sai; nói lý do ở lyDoKiem.
9. Không ghi dòng tổng cộng, chữ ký, điều khoản, địa chỉ vào "dong".
10. Đầu phiếu: nhaCungCap, soPhieu, ngayGiao (dd/mm/yyyy), tau — không rõ thì null.

Ví dụ một dòng in "12 | Wire rope clip M12 (Kẹp cáp M12) | 232052 | PCS | 20" trên trang 2, nhóm DECK DEPARTMENT →
{"stt":12,"ten":"Wire rope clip M12 (Kẹp cáp M12)","tenEn":"Wire rope clip M12","tenVi":"Kẹp cáp M12","partNo":null,"impa":"232052","soLuong":20,"donVi":"PCS","loai":"STORE","thietBi":"DECK DEPARTMENT","trang":2,"canKiem":false,"lyDoKiem":null,"ghiChu":null}`;

const LOI_NHAC_NGUOI_DUNG = "Đọc phiếu giao hàng trong tài liệu đính kèm và ghi TOÀN BỘ dòng hàng theo đúng cấu trúc yêu cầu.";

/** Khuôn JSON nhắc thêm cho Gemini — để khi phải bỏ responseSchema (API từ chối khuôn) mô hình vẫn trả đúng dạng. */
const KHUON_JSON_GOI_Y =
  'Trả về DUY NHẤT một JSON dạng: {"nhaCungCap": string|null, "soPhieu": string|null, "ngayGiao": "dd/mm/yyyy"|null, "tau": string|null, "dong": [{"stt": number|null, "ten": string, "tenEn": string|null, "tenVi": string|null, "partNo": string|null, "impa": "6 chữ số"|null, "soLuong": number|null, "donVi": string|null, "loai": "STORE"|"SPARE", "thietBi": string|null, "trang": number|null, "canKiem": boolean, "lyDoKiem": string|null, "ghiChu": string|null}]}';

/** Đơn vị bộ chuẩn hóa biết — ngoài danh sách này là "đơn vị lạ", cần người duyệt xem. */
const DON_VI_BIET = new Set(["PCS", "SET", "KG", "G", "LTR", "ML", "M", "MM", "CM", "BOX", "PACK", "ROLL", "BAG", "CAN", "DRUM", "PAIR", "BTL", "TUBE", "CTN", "SHT"]);

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

/** Chia phiếu dài thành các cụm trang [từ, đến]; null = đọc cả tài liệu một lần. */
export function chiaTrang(soTrang: number | null, moiCum = TRANG_MOI_CUM, nguong = NGUONG_CHIA_CUM): ([number, number] | null)[] {
  if (!soTrang || soTrang <= nguong) return [null];
  const ra: [number, number][] = [];
  for (let a = 1; a <= soTrang; a += moiCum) ra.push([a, Math.min(soTrang, a + moiCum - 1)]);
  return ra;
}

type DongTho = {
  stt?: unknown;
  ten?: unknown;
  tenEn?: unknown;
  tenVi?: unknown;
  partNo?: unknown;
  impa?: unknown;
  soLuong?: unknown;
  donVi?: unknown;
  loai?: unknown;
  thietBi?: unknown;
  trang?: unknown;
  canKiem?: unknown;
  lyDoKiem?: unknown;
  ghiChu?: unknown;
};

const chuoi = (v: unknown, toiDa = 200): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim().slice(0, toiDa);
  return s ? s : null;
};

const themCanhBao = (cu: string | null, moi: string) => (cu ? `${cu}; ${moi}` : moi);
const khoaDong = (d: { ten: string; partNo: string | null; impa: string | null }) =>
  `${d.ten.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")}|${(d.partNo ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "")}|${d.impa ?? ""}`;

/**
 * Làm sạch kết quả AI trả về thành dòng của bộ tách (cùng kiểu với lớp chữ /
 * OCR) — thuần chuỗi. Mô hình đôi khi trả số lượng dạng chuỗi, IMPA kèm chữ
 * "IMPA", đơn vị viết thường... nên chuẩn hóa ở đây thay vì tin mù vào JSON.
 * Tên hiển thị = tenVi nếu phiếu có tiếng Việt, không thì như in.
 */
export function chuanHoaKetQuaAi(input: unknown): DauPhieu & { dong: DongAi[]; chuTomTat: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const dau: DauPhieu = {
    nhaCungCap: chuoi(o.nhaCungCap),
    soPhieu: chuoi(o.soPhieu, 80),
    ngayGiao: chuoi(o.ngayGiao, 20),
    tau: chuoi(o.tau, 80),
  };
  const dong: DongAi[] = [];
  const tho = Array.isArray(o.dong) ? (o.dong as DongTho[]) : [];
  for (let i = 0; i < tho.length; i++) {
    const d = tho[i] && typeof tho[i] === "object" ? tho[i] : {};
    const tenIn = chuoi(d.ten);
    const tenVi = chuoi(d.tenVi);
    const tenEn = chuoi(d.tenEn);
    const ten = tenVi ?? tenIn ?? tenEn;
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
    const trangSo = Number(d.trang);
    const trang = Number.isInteger(trangSo) && trangSo > 0 ? trangSo : null;
    const canKiem = d.canKiem === true || String(d.canKiem).toLowerCase() === "true";
    const canhBao = canKiem ? `AI không chắc: ${chuoi(d.lyDoKiem, 160) ?? "chữ khó đọc"}` : null;
    const stt = Number.isInteger(d.stt) ? Number(d.stt) : i + 1;
    const chuGoc = `${stt}. ${tenIn ?? ten}${partNo ? ` · P/N ${partNo}` : ""}${impa ? ` · IMPA ${impa}` : ""} — ${soLuong} ${donVi}${
      thietBi ? ` · ${thietBi}` : ""
    }${trang ? ` · tr.${trang}` : ""}${ghiChu ? ` (${ghiChu})` : ""}`;
    dong.push({
      chuGoc: chuGoc.slice(0, 500),
      ten,
      tenEn: tenEn && tenEn !== ten ? tenEn : tenEn === ten && tenVi ? tenEn : tenEn && !tenVi ? null : tenEn,
      partNo,
      impa,
      soLuong,
      donVi,
      loai,
      thietBi,
      trang,
      canhBao: ghiChu && /gạch|thiếu|hủy|cancel|short|miss|thay/i.test(ghiChu) ? themCanhBao(canhBao, `Ghi chú trên phiếu: ${ghiChu}`) : canhBao,
    });
  }
  return { ...dau, dong, chuTomTat: tomTat(dau, dong, []) };
}

/** Bản chữ cho ô "Chữ đọc được". */
export function tomTat(dau: DauPhieu, dong: DongAi[], loiPhu: string[]): string {
  const dauDong = [
    dau.nhaCungCap ? `Nhà cung cấp: ${dau.nhaCungCap}` : null,
    dau.soPhieu ? `Số phiếu: ${dau.soPhieu}` : null,
    dau.ngayGiao ? `Ngày giao: ${dau.ngayGiao}` : null,
    dau.tau ? `Tàu: ${dau.tau}` : null,
  ].filter(Boolean);
  const canKiem = dong.filter((d) => d.canhBao).length;
  return [
    ...dauDong,
    `— ${dong.length} dòng hàng${canKiem ? ` · ${canKiem} dòng cần kiểm` : ""} —`,
    ...dong.map((d) => `${d.chuGoc}${d.canhBao ? ` ⚠ ${d.canhBao}` : ""}`),
    ...loiPhu.map((l) => `! ${l}`),
  ].join("\n");
}

/**
 * Gộp lượt 1 và lượt kiểm lại: lấy lượt 2 làm chuẩn nhưng ĐÁNH DẤU dòng bị
 * sửa số lượng / đơn vị, dòng mới thêm; dòng lượt 1 mà lượt 2 không còn thì
 * vẫn giữ (kèm cảnh báo) — thà thừa một dòng để bỏ tick còn hơn mất hàng.
 */
export function gopLuot(luot1: DongAi[], luot2: DongAi[]): DongAi[] {
  const conLai = new Map<string, DongAi[]>();
  for (const d of luot1) {
    const k = khoaDong(d);
    conLai.set(k, [...(conLai.get(k) ?? []), d]);
  }
  const ra: DongAi[] = luot2.map((d) => {
    const cu = conLai.get(khoaDong(d))?.shift();
    if (!cu) return { ...d, canhBao: themCanhBao(d.canhBao, "Lượt kiểm lại thêm hoặc đổi tên dòng này") };
    if (cu.soLuong !== d.soLuong || cu.donVi !== d.donVi) {
      return { ...d, canhBao: themCanhBao(d.canhBao, `Lượt kiểm lại sửa số lượng/đơn vị (lượt 1: ${cu.soLuong} ${cu.donVi})`) };
    }
    return d;
  });
  for (const ds of conLai.values()) {
    for (const cu of ds) ra.push({ ...cu, canhBao: themCanhBao(cu.canhBao, "Lượt kiểm lại không thấy dòng này trên phiếu — xác nhận, thừa thì bỏ tick") });
  }
  return ra;
}

/** Bộ soát sau đọc: gắn cảnh báo cho dòng đáng ngờ. Không sửa dữ liệu, chỉ đánh dấu. */
export function soatDong(dong: DongAi[]): DongAi[] {
  const dauTien = new Map<string, number>();
  dong.forEach((d, i) => {
    const k = khoaDong(d);
    if (!dauTien.has(k)) dauTien.set(k, i);
  });
  return dong.map((d, i) => {
    const lyDo: string[] = [];
    if (!(d.soLuong > 0)) lyDo.push("Số lượng 0 hoặc trống");
    if (!DON_VI_BIET.has(d.donVi)) lyDo.push(`Đơn vị lạ "${d.donVi}"`);
    if (d.ten.length < 3) lyDo.push("Tên quá ngắn");
    if (/\(\?\)/.test(d.ten) || /\(\?\)/.test(d.partNo ?? "")) lyDo.push("Có chỗ mờ (?)");
    const truoc = dauTien.get(khoaDong(d));
    if (truoc !== undefined && truoc !== i) lyDo.push(`Trùng với dòng ${truoc + 1}`);
    if (!lyDo.length) return d;
    return { ...d, canhBao: lyDo.reduce((acc, l) => themCanhBao(acc, l), d.canhBao) };
  });
}

export type FetchGia = (url: string, init: RequestInit) => Promise<Response>;

type TuyChonDocAi = {
  fileName?: string;
  timeoutMs?: number;
  /** Để kiểm thử thay fetch thật. */
  fetchFn?: FetchGia;
  /** Thời gian chờ trước mỗi lần thử lại (ms) — kiểm thử đặt ngắn. */
  choThuLaiMs?: number[];
  /** Số trang của PDF (nơi gọi đếm bằng pdfjs) — để chia cụm; không biết thì đọc một lần. */
  soTrang?: number | null;
  /**
   * Chữ đã tách từ PDF (lib/pdfChu.ts hoặc OCR), mỗi trang mở đầu bằng
   * "--- trang N ---". BẮT BUỘC với nhà cung cấp chỉ đọc chữ (DeepSeek).
   */
  chuPdf?: string | null;
};

/** Cắt chữ theo phạm vi trang (dựa vào dấu "--- trang N ---"); không dấu thì trả nguyên. */
export function catTrang(chu: string, pham: [number, number] | null): string {
  if (!pham) return chu;
  const manh = chu.split(/^--- trang (\d+) ---\r?\n?/m);
  // split với nhóm bắt: [truoc, so1, noiDung1, so2, noiDung2, ...]
  if (manh.length < 3) return chu;
  const ra: string[] = [];
  for (let i = 1; i < manh.length; i += 2) {
    const so = Number(manh[i]);
    if (so >= pham[0] && so <= pham[1]) ra.push(`--- trang ${so} ---\n${manh[i + 1] ?? ""}`);
  }
  return ra.join("\n");
}

/** Số trang theo dấu "--- trang N ---" trong chữ đã tách (null nếu không có dấu). */
export function demTrangTuChu(chu: string | null | undefined): number | null {
  if (!chu) return null;
  const so = [...chu.matchAll(/^--- trang (\d+) ---/gm)].map((m) => Number(m[1]));
  return so.length ? Math.max(...so) : null;
}

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

function moTaLoiDeepseek(status: number, json: unknown): string {
  const e = (json as { error?: { type?: string; message?: string } } | null)?.error;
  return `DeepSeek API ${status}${e?.type ? ` ${e.type}` : ""}${e?.message ? `: ${e.message}` : ""}`.slice(0, 300);
}

/** Bóc JSON từ chữ mô hình trả (có thể kèm ```json ... ``` hay câu dẫn). */
function bocJson(text: string): unknown | null {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* thử cắt từ { đầu tới } cuối */
  }
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch {
    return null;
  }
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

type KetQuaTho = { ok: true; input: unknown; tokenVao: number; tokenRa: number } | { ok: false; loi: string };

async function goiClaude(pdf: Buffer, ch: CauHinhAi, tc: TuyChonDocAi, text: string, fetchFn: FetchGia, timeoutMs: number): Promise<KetQuaTho> {
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
            { type: "text", text },
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
  return { ok: true, input: congCu.input, tokenVao: json?.usage?.input_tokens ?? 0, tokenRa: json?.usage?.output_tokens ?? 0 };
}

async function goiGemini(pdf: Buffer, ch: CauHinhAi, tc: TuyChonDocAi, text: string, fetchFn: FetchGia, timeoutMs: number): Promise<KetQuaTho> {
  if (pdf.length > GEMINI_PDF_TOI_DA) {
    return { ok: false, loi: `PDF ${Math.round(pdf.length / 1024 / 1024)} MB quá lớn cho Gemini (tối đa 14 MB) — nén bản scan hoặc dùng Claude.` };
  }
  // Ba mức: đủ đồ (khuôn + độ phân giải cao + suy nghĩ cho flash) → chỉ khuôn → chỉ JSON.
  const body = (muc: 0 | 1 | 2) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: HUONG_DAN_HE_THONG }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
            { text: `${text}${tc.fileName ? ` (tệp: ${tc.fileName.slice(0, 200)})` : ""}\n${KHUON_JSON_GOI_Y}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        ...(muc <= 1 ? { responseSchema: schemaGemini(CONG_CU_GHI_PHIEU.input_schema) } : {}),
        // Bản scan chữ nhỏ: độ phân giải cao đọc số rõ hơn; dòng flash mặc định
        // không "suy nghĩ" — cấp ngân sách để nó đối chiếu cột kỹ hơn.
        ...(muc === 0 ? { mediaResolution: "MEDIA_RESOLUTION_HIGH" } : {}),
        ...(muc === 0 && /flash/i.test(ch.model) ? { thinkingConfig: { thinkingBudget: 4096 } } : {}),
      },
    });
  const url = `${DIA_CHI_GEMINI}/models/${encodeURIComponent(ch.model)}:generateContent`;
  const goi = (muc: 0 | 1 | 2) =>
    goiCoThuLai(
      fetchFn,
      url,
      { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": ch.apiKey }, body: body(muc) },
      timeoutMs,
      moTaLoiGemini,
      tc.choThuLaiMs
    );
  let r = await goi(0);
  // Phiên bản API / mô hình không nhận mediaResolution / thinkingConfig → bỏ đồ thêm.
  if (!r.ok && r.status === 400 && /media|thinking|unknown name|invalid json payload|not supported|unsupported/i.test(r.loi)) r = await goi(1);
  // Không nhận cả responseSchema → chỉ chế độ JSON + khuôn gợi ý trong lời nhắc.
  if (!r.ok && r.status === 400 && /schema|unknown name|invalid json payload|nullable|format/i.test(r.loi)) r = await goi(2);
  if (!r.ok) return r;
  const json = r.json as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } | null;
  const ung = json?.candidates?.[0];
  const textRa = (ung?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  if (!textRa.trim()) {
    const lyDo = json?.promptFeedback?.blockReason ?? ung?.finishReason ?? "?";
    return { ok: false, loi: `AI không trả về nội dung (lý do: ${lyDo}).` };
  }
  let input: unknown;
  try {
    input = JSON.parse(textRa);
  } catch {
    return { ok: false, loi: `AI trả về JSON hỏng (finishReason: ${ung?.finishReason ?? "?"}).` };
  }
  return { ok: true, input, tokenVao: json?.usageMetadata?.promptTokenCount ?? 0, tokenRa: json?.usageMetadata?.candidatesTokenCount ?? 0 };
}

export const LOI_DEEPSEEK_KHONG_CHU =
  "DeepSeek chỉ đọc được chữ, mà PDF này là bản scan không có lớp chữ. Dùng Gemini hoặc Claude (đọc được ảnh), hoặc tải phiếu từ máy văn phòng Windows (có OCR tách chữ).";

/**
 * DeepSeek (OpenAI-compatible chat completions): gửi CHỮ đã tách từ PDF, chỉ
 * phần trang trong phạm vi; ép JSON bằng response_format (mô hình reasoner
 * không nhận → bóc JSON từ chữ).
 */
async function goiDeepseek(ch: CauHinhAi, tc: TuyChonDocAi, text: string, pham: [number, number] | null, fetchFn: FetchGia, timeoutMs: number): Promise<KetQuaTho> {
  const chu = (tc.chuPdf ?? "").trim();
  if (chu.length < 10) return { ok: false, loi: LOI_DEEPSEEK_KHONG_CHU };
  const chuCum = catTrang(chu, pham);
  const laReasoner = /reason/i.test(ch.model);
  const body = JSON.stringify({
    model: ch.model,
    temperature: 0,
    max_tokens: 8192,
    stream: false,
    ...(laReasoner ? {} : { response_format: { type: "json_object" } }),
    messages: [
      { role: "system", content: `${HUONG_DAN_HE_THONG}\n\nĐầu vào là CHỮ đã tách từ PDF (không có ảnh): mỗi trang mở đầu bằng "--- trang N ---", các cột của bảng cách nhau bằng " | ". ${KHUON_JSON_GOI_Y}` },
      {
        role: "user",
        content: `${text}${tc.fileName ? ` (tệp: ${tc.fileName.slice(0, 200)})` : ""}\n\nVĂN BẢN PHIẾU:\n${chuCum.slice(0, 120_000)}`,
      },
    ],
  });
  const r = await goiCoThuLai(
    fetchFn,
    `${DIA_CHI_DEEPSEEK}/chat/completions`,
    { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${ch.apiKey}` }, body },
    timeoutMs,
    moTaLoiDeepseek,
    tc.choThuLaiMs
  );
  if (!r.ok) return r;
  const json = r.json as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;
  const lua = json?.choices?.[0];
  const noiDung = lua?.message?.content ?? "";
  if (!noiDung.trim()) return { ok: false, loi: `AI không trả về nội dung (finish_reason: ${lua?.finish_reason ?? "?"}).` };
  const input = bocJson(noiDung);
  if (input === null) {
    return {
      ok: false,
      loi: lua?.finish_reason === "length" ? "AI trả về JSON bị cắt dở (quá giới hạn 8K token) — phiếu quá dài cho một lượt." : "AI trả về JSON hỏng.",
    };
  }
  return { ok: true, input, tokenVao: json?.usage?.prompt_tokens ?? 0, tokenRa: json?.usage?.completion_tokens ?? 0 };
}

/** Lời nhắc cho một lượt: phạm vi trang (nếu chia cụm) và bảng lượt 1 (nếu là lượt kiểm lại). */
export function loiNhac(pham: [number, number] | null, luot1: DongAi[] | null): string {
  let s = LOI_NHAC_NGUOI_DUNG;
  if (pham) {
    s += `\nCHỈ đọc các trang ${pham[0]} đến ${pham[1]} (đánh số từ 1) của tài liệu; bỏ hẳn các trang khác.${
      pham[0] > 1 ? " Thông tin đầu phiếu (nhà cung cấp, số phiếu, ngày, tàu) để null." : ""
    }`;
  }
  if (luot1) {
    const gon = luot1.map((d) => ({
      ten: d.ten,
      tenEn: d.tenEn,
      partNo: d.partNo,
      impa: d.impa,
      soLuong: d.soLuong,
      donVi: d.donVi,
      loai: d.loai,
      thietBi: d.thietBi,
      trang: d.trang,
    }));
    s +=
      `\n\nĐây là bảng đã đọc ở LƯỢT 1 (JSON). Hãy ĐỐI CHIẾU LẠI TỪNG DÒNG với tài liệu: sửa chỗ đọc sai (số lượng, đơn vị, mã IMPA / Part No., tên), thêm dòng bị sót, xóa dòng không có trên phiếu, giữ nguyên dòng đã đúng. Chú ý số hay lẫn (0/6/8, 1/7, 3/8) và dòng ở mép trang. Trả về bảng ĐẦY ĐỦ đã sửa (không chỉ phần sửa), cùng cấu trúc, cùng thứ tự trên phiếu.\nLƯỢT 1:\n` +
      JSON.stringify(gon);
  }
  return s;
}

/**
 * Đọc phiếu bằng cấu hình đã giải (null = chưa cấu hình → ok:false, không gọi
 * mạng). Chế độ "ky" (mặc định) đọc hai lượt; phiếu dài đọc theo cụm trang.
 */
export async function docPhieuGiaoBangAi(pdf: Buffer, cauHinh: CauHinhAi | null, tuyChon: TuyChonDocAi = {}): Promise<KetQuaDocAi> {
  if (!cauHinh || !cauHinh.apiKey.trim()) return { ok: false, loi: "Chưa cấu hình bộ đọc AI." };
  const fetchFn = tuyChon.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const timeoutMs = tuyChon.timeoutMs ?? 180_000;
  const ch: CauHinhAi = { ...cauHinh, apiKey: cauHinh.apiKey.trim(), model: cauHinh.model.trim() || MODEL_MAC_DINH[cauHinh.nhaCungCap] };
  const cheDo: CheDoDocAi = ch.cheDo ?? "ky";
  const goi = (text: string, pham: [number, number] | null) =>
    ch.nhaCungCap === "deepseek"
      ? goiDeepseek(ch, tuyChon, text, pham, fetchFn, timeoutMs)
      : ch.nhaCungCap === "gemini"
        ? goiGemini(pdf, ch, tuyChon, text, fetchFn, timeoutMs)
        : goiClaude(pdf, ch, tuyChon, text, fetchFn, timeoutMs);

  // DeepSeek chỉ có chữ: chặn sớm, và chia cụm nhỏ hơn vì đầu ra giới hạn 8K token.
  if (ch.nhaCungCap === "deepseek" && (tuyChon.chuPdf ?? "").trim().length < 10) return { ok: false, loi: LOI_DEEPSEEK_KHONG_CHU };
  const cac =
    ch.nhaCungCap === "deepseek"
      ? chiaTrang(tuyChon.soTrang ?? demTrangTuChu(tuyChon.chuPdf), DEEPSEEK_TRANG_MOI_CUM, DEEPSEEK_TRANG_MOI_CUM)
      : chiaTrang(tuyChon.soTrang ?? null);
  let tokenVao = 0;
  let tokenRa = 0;
  let soLuotGoi = 0;
  const loiPhu: string[] = [];
  const dau: DauPhieu = { nhaCungCap: null, soPhieu: null, ngayGiao: null, tau: null };
  const dongTatCa: DongAi[] = [];
  for (const pham of cac) {
    const tenPham = pham ? `trang ${pham[0]}–${pham[1]}` : "cả phiếu";
    const r1 = await goi(loiNhac(pham, null), pham);
    soLuotGoi++;
    if (!r1.ok) return { ok: false, loi: cac.length > 1 ? `${r1.loi} (${tenPham})` : r1.loi };
    tokenVao += r1.tokenVao;
    tokenRa += r1.tokenRa;
    let chuan = chuanHoaKetQuaAi(r1.input);
    if (cheDo === "ky") {
      const r2 = await goi(loiNhac(pham, chuan.dong), pham);
      soLuotGoi++;
      if (r2.ok) {
        tokenVao += r2.tokenVao;
        tokenRa += r2.tokenRa;
        const c2 = chuanHoaKetQuaAi(r2.input);
        chuan = {
          ...c2,
          nhaCungCap: c2.nhaCungCap ?? chuan.nhaCungCap,
          soPhieu: c2.soPhieu ?? chuan.soPhieu,
          ngayGiao: c2.ngayGiao ?? chuan.ngayGiao,
          tau: c2.tau ?? chuan.tau,
          dong: gopLuot(chuan.dong, c2.dong),
        };
      } else {
        loiPhu.push(`Lượt kiểm lại (${tenPham}) không chạy được, dùng lượt 1: ${r2.loi}`);
      }
    }
    dau.nhaCungCap ??= chuan.nhaCungCap;
    dau.soPhieu ??= chuan.soPhieu;
    dau.ngayGiao ??= chuan.ngayGiao;
    dau.tau ??= chuan.tau;
    dongTatCa.push(...chuan.dong);
  }
  const dong = soatDong(dongTatCa);
  return {
    ok: true,
    ...dau,
    dong,
    chuTomTat: tomTat(dau, dong, loiPhu),
    model: ch.model,
    tokenVao,
    tokenRa,
    soLuotGoi,
    soDongCanKiem: dong.filter((d) => d.canhBao).length,
    loiPhu,
  };
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
  if (cauHinh.nhaCungCap === "deepseek") {
    const r = await goiCoThuLai(
      fetchFn,
      `${DIA_CHI_DEEPSEEK}/models`,
      { method: "GET", headers: { authorization: `Bearer ${apiKey}` } },
      timeoutMs,
      moTaLoiDeepseek,
      tuyChon.choThuLaiMs
    );
    if (!r.ok) return r;
    const json = r.json as { data?: { id?: string }[] } | null;
    models = (json?.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
  } else if (cauHinh.nhaCungCap === "gemini") {
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
