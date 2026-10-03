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
import { docSoLoc } from "@/lib/docSo";

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
/**
 * Phiếu dài hơn NGUONG_CHIA_CUM trang thì đọc từng cụm TRANG_MOI_CUM trang: mỗi
 * cụm AI chỉ phải viết vài chục dòng (nhanh, ít sót), và các cụm chạy song song.
 */
export const TRANG_MOI_CUM = 2;
export const NGUONG_CHIA_CUM = 2;

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
  /**
   * Ô số lượng để TRỐNG trên tài liệu (soLuong khi đó là 0). Phiếu giao không
   * cần phân biệt; bảng kiểm kê thì phải: trống = chưa đếm, 0 = đếm được 0.
   */
  soLuongTrong?: boolean;
  /** Đơn giá (chỉ bảng báo giá); null = không có / không đọc được. */
  donGia?: number | null;
  /** Các cột số của báo cáo dụng cụ chằng buộc MLS-11-13 (chỉ chế độ "changBuoc"). */
  cb?: SoChangBuoc;
  /** Còn tồn trên tàu (R.O.B) ghi trên phiếu yêu cầu MLS-11-05 (chỉ chế độ "yeuCau"). */
  ton?: number | null;
  /** Cột ITEM / Hạng mục của MLS-11-05A (chỉ chế độ "yeuCau"). */
  hangMuc?: string | null;
  /** Bốn cột số của báo cáo lượng sơn tồn MLS-11-14 (chỉ chế độ "baoCaoTon"). */
  bc?: SoBaoCaoTonAi;
};

/** Cột số của MLS-11-14: Tồn đầu kỳ · Nhận · Tiêu thụ trong kỳ · Tồn cuối kỳ (null = ô trống). */
export type SoBaoCaoTonAi = { tonDau: number | null; nhan: number | null; tieuThu: number | null; tonCuoi: number | null };

/** Cột số của MLS-11-13: (1) tối thiểu, (2) chuẩn, (3) còn dùng, (4) hỏng, (5) toàn bộ, (6) thiếu, (7) yêu cầu. */
export type SoChangBuoc = {
  toiThieu: number | null;
  chuan: number | null;
  conDung: number | null;
  hong: number | null;
  tong: number | null;
  thieu: number | null;
  yeuCau: number | null;
};

/** Loại tài liệu bộ đọc AI đang đọc — quyết định lời dặn và nghĩa cột số lượng. */
export type BanDocAi = "phieuGiao" | "phieuSon" | "baoCaoTon" | "kiemKe" | "baoGia" | "changBuoc" | "yeuCau";

/** Đầu phiếu yêu cầu MLS-11-05A/B do AI đọc — chữ thô, lib/yeuCauNhap.ts chuẩn hóa. */
export type DauYeuCauAi = {
  boPhan: string | null;
  loaiYeuCau: string | null;
  mayThietBi: string | null;
  hangSx: string | null;
  kieuMay: string | null;
  soMay: string | null;
};

export type DauPhieu = {
  nhaCungCap: string | null;
  soPhieu: string | null;
  ngayGiao: string | null;
  tau: string | null;
  /** Loại tiền (chỉ bảng báo giá): USD, VND, SGD, EUR... */
  tienTe?: string | null;
  /** Cảng (Port) — dòng "Ship's Name / Port / Date" của MLS-11-13. */
  cang?: string | null;
  /** Đầu phiếu yêu cầu vật tư / phụ tùng (chỉ chế độ "yeuCau"). */
  yc?: DauYeuCauAi | null;
  /** Ô Quý / Quarter và Năm / Year của báo cáo tồn MLS-11-14 — chữ thô (chỉ chế độ "baoCaoTon"). */
  quy?: string | null;
  nam?: string | null;
  /** Ô kỳ "From month / Từ tháng … đến …" của bảng kiểm kê MLS-11-06 — chữ thô (chỉ chế độ "kiemKe"). */
  kyBaoCao?: string | null;
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
  /** Một số cụm trang không đọc được — nêu trang nào, để người duyệt đọc lại / gõ tay. null = đủ. */
  canhBaoChung: string | null;
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
            tenEn: { type: ["string", "null"], description: "CHỈ khi mô tả in SONG NGỮ: phần tiếng Anh. Mô tả một ngôn ngữ thì null (đừng chép lại ten)." },
            tenVi: { type: ["string", "null"], description: "CHỈ khi mô tả in SONG NGỮ: phần tiếng Việt (thường trong ngoặc hoặc dòng dưới). Mô tả một ngôn ngữ thì null. Không tự dịch." },
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
2. "ten" giữ nguyên như in trên phiếu: không dịch, không sửa chính tả, không rút gọn. Phiếu in song ngữ (VD "Abrasive discs (Đĩa mài)") thì tách thêm tenEn = "Abrasive discs", tenVi = "Đĩa mài"; mô tả chỉ MỘT ngôn ngữ thì tenEn = null, tenVi = null (đừng chép lại ten — phiếu dài, chép thừa làm chậm). Không tự dịch để điền phần thiếu. Các trường không có thì null; lyDoKiem, ghiChu chỉ ghi khi có.
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

// ─── Phiếu giao / nhận SƠN (chế độ "phieuSon") ───────────────────────────────
// Cùng công cụ / khuôn JSON với phiếu giao vật tư, thêm quy tắc riêng cho sơn.
// Biểu mẫu công ty KHÔNG phải phiếu giao (phiếu yêu cầu MLS-11-05, báo cáo lượng
// sơn tồn MLS-11-14) thì không được cộng số nào vào tồn: đọc dòng nhưng để trống
// số lượng và nói rõ lý do — người dùng tải lại đúng loại (báo cáo tồn có đường
// riêng, chế độ "baoCaoTon").
const HUONG_DAN_PHIEU_SON = `${HUONG_DAN_HE_THONG}

Tài liệu lần này là phiếu giao / nhận SƠN cho tàu (sơn, dung môi / thinner, chất đóng rắn). Thêm các quy tắc sau — chỗ nào khác quy tắc ở trên thì theo phần này:
A. Biểu mẫu của công ty KHÔNG phải phiếu giao: phiếu yêu cầu MLS-11-05 (tiêu đề "REQUISITION FOR STORES / YÊU CẦU VẬT TƯ", cột R.O.B / Q'ty Req. / Q'ty App.) và báo cáo lượng sơn tồn MLS-11-14 (tiêu đề "BÁO CÁO LƯỢNG SƠN TỒN / PAINT INVENTORY", cột Tồn đầu kỳ / Nhận / Tiêu thụ / Tồn cuối kỳ). Gặp hai mẫu này: soPhieu = mã biểu mẫu ("MLS-11-05" hoặc "MLS-11-14"), mỗi dòng sơn vẫn ghi tên nhưng "soLuong" = null, canKiem = true, lyDoKiem = "biểu mẫu <mã> — không phải phiếu giao".
B. Phiếu của hãng sơn / nhà cung cấp: "soLuong" là số lượng giao ở cột số lượng (Qty / Quantity / Số lượng / Delivered) và "donVi" đúng đơn vị của cột đó (LTR, CAN, PAIL, DRUM, SET...). Ô ghi kiểu "4 x 20L" (số lon × dung tích) thì soLuong = 4, donVi = CAN, ghi "20L / lon" vào ghiChu.
C. "soLuong" luôn là MỘT SỐ kiểu number, không phải chuỗi: "1.000,5" (kiểu Việt) = 1000.5; "1,250.00" = 1250; "20,00" = 20.
D. Sơn hai thành phần (Comp A / Comp B, Base / Hardener / Curing agent): mỗi thành phần là một dòng, ghi đúng như in.
E. "loai" luôn là "STORE". Dòng tiêu đề nhóm (VD "PAINT", "THINNER", tên tàu, số đơn hàng) không có số lượng thì KHÔNG ghi thành dòng.`;

const LOI_NHAC_PHIEU_SON =
  "Đọc phiếu giao / nhận sơn trong tài liệu đính kèm và ghi TOÀN BỘ dòng sơn theo đúng cấu trúc yêu cầu (biểu mẫu MLS-11-05 / MLS-11-14 không phải phiếu giao: để trống số lượng như quy tắc A).";

// ─── BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14 (chế độ "baoCaoTon") ────────────────────
// Bảng: Stt / No. | Tên sơn / Paint name | Đơn vị / Unit | Tồn đầu kỳ / In stock |
// Nhận / Recive | Tiêu thụ trong kỳ / Consume | Tồn cuối kỳ / Remain. Đầu báo cáo
// có Tên tàu / Vessel, Quý / Quarter, Năm / Year — ngày của báo cáo là cuối quý
// (lib/baoCaoTonSon.ts); "Issued date" trong khung là ngày ban hành MẪU, không phải.

const SO_BC = (moTa: string) => ({ type: ["number", "null"], description: `${moTa} Ô trống → null; gạch ngang '-' → 0.` });

export const CONG_CU_GHI_BAO_CAO_TON = {
  name: CONG_CU_GHI_PHIEU.name,
  description:
    "Ghi lại toàn bộ báo cáo lượng sơn tồn MLS-11-14 đã đọc: Tên tàu, Quý, Năm và TỪNG dòng sơn trong bảng, mỗi dòng là một phần tử của mảng dong.",
  input_schema: {
    type: "object",
    properties: {
      nhaCungCap: { type: ["string", "null"], description: "Luôn null." },
      soPhieu: { type: ["string", "null"], description: "Mã biểu mẫu in trên trang (MLS-11-14), không có thì null." },
      ngayGiao: { type: ["string", "null"], description: "Luôn null — báo cáo theo quý, không lấy 'Issued date' (ngày ban hành mẫu)." },
      tau: { type: ["string", "null"], description: "Tên tàu ở ô Tên tàu / Vessel." },
      quy: { type: ["string", "null"], description: "Ô Quý / Quarter đúng như viết (I, II, III, IV hoặc 1–4)." },
      nam: { type: ["string", "null"], description: "Ô Năm / Year (4 chữ số)." },
      dong: {
        type: "array",
        description: "Mọi dòng sơn CÓ TÊN trong bảng, theo thứ tự, qua hết các trang được yêu cầu. Bỏ dòng mẫu còn trống.",
        items: {
          type: "object",
          properties: {
            stt: { type: ["integer", "null"], description: "Số thứ tự (Stt / No.)." },
            ten: { type: "string", description: "Tên sơn (Tên sơn / Paint name) ĐÚNG NHƯ VIẾT: không dịch, không sửa, giữ mã màu, Comp A / Comp B, dung tích." },
            donVi: { type: ["string", "null"], description: "Cột Đơn vị / Unit đúng như viết (PAIL, CAN, LTR, DRUM...)." },
            tonDau: SO_BC("Cột Tồn đầu kỳ / In stock."),
            nhan: SO_BC("Cột Nhận / Recive (nhận trong kỳ)."),
            tieuThu: SO_BC("Cột Tiêu thụ trong kỳ / Consume."),
            tonCuoi: SO_BC("Cột Tồn cuối kỳ / Remain — số quan trọng nhất."),
            trang: { type: ["integer", "null"], description: "Số trang của tài liệu (đánh từ 1) mà dòng này nằm." },
            canKiem: { type: ["boolean", "null"], description: "true nếu chữ / số mờ, sửa tay hoặc bạn KHÔNG CHẮC đã đọc đúng." },
            lyDoKiem: { type: ["string", "null"], description: "Khi canKiem = true: nói ngắn vì sao." },
            ghiChu: { type: ["string", "null"], description: "Ghi chú riêng của dòng nếu có." },
          },
          required: ["ten"],
        },
      },
    },
    required: ["dong"],
  },
} as const;

export const HUONG_DAN_BAO_CAO_TON = `Bạn là đại phó của tàu biển, tỉ mỉ và không bao giờ đoán bừa. Nhiệm vụ: đọc BÁO CÁO LƯỢNG SƠN TỒN (PAINT INVENTORY) theo biểu mẫu MLS-11-14 của công ty — có thể là bản scan nghiêng, mờ, số viết tay, nhiều trang — rồi ghi lại theo đúng cấu trúc yêu cầu.

Bảng có 7 cột theo thứ tự: Stt / No. | Tên sơn / Paint name | Đơn vị / Unit | Tồn đầu kỳ / In stock | Nhận / Recive | Tiêu thụ trong kỳ / Consume | Tồn cuối kỳ / Remain. Tiêu đề cột in hai hàng Việt / Anh.

Quy tắc:
1. MỖI dòng sơn CÓ TÊN là MỘT phần tử trong "dong". Dòng mẫu còn trống thì bỏ. Không gộp, không bỏ sót, không bịa thêm; dòng cuối mỗi trang và dòng đầu trang sau hay bị sót — kiểm kỹ.
2. "ten" giữ nguyên như viết (hãng, tên sơn, mã màu RAL / STD, Comp A / Comp B, dung tích như "20L"): không dịch, không sửa chính tả.
3. Mỗi cột số ghi đúng vào trường của nó: tonDau, nhan, tieuThu, tonCuoi. Ô trống → null; gạch ngang '-' → 0. Đừng dồn số sang cột bên cạnh khi có ô trống. "1.000,5" (kiểu Việt) = 1000.5; "17,91" = 17.91. Số viết tay đọc thật kỹ (0/6/8, 1/7, 3/8, 4/9 hay lẫn); bị gạch sửa thì lấy số mới và đặt canKiem = true.
4. "trang": số trang (đánh từ 1). "canKiem" = true ở chỗ mờ, sửa tay hoặc không chắc — thà đánh dấu thừa còn hơn để lọt số sai; nói lý do ở lyDoKiem.
5. Không ghi hàng tiêu đề, dòng chữ ký (Thuyền Trưởng / Captain, Đại Phó / Chief Officer), chân trang (Người làm báo cáo, Thời gian lưu...) vào "dong".
6. Đầu báo cáo: tau (Tên tàu / Vessel), quy (Quý / Quarter, như viết), nam (Năm / Year); soPhieu = mã biểu mẫu; nhaCungCap và ngayGiao luôn null — KHÔNG lấy "Issued date" / "Revised date" của khung biểu mẫu.
7. Tài liệu KHÔNG phải báo cáo lượng sơn tồn (VD phiếu giao hàng, hóa đơn, phiếu yêu cầu MLS-11-05 — không có các cột Tồn đầu kỳ / Tồn cuối kỳ): trả "dong" = [] và soPhieu = tên loại tài liệu đó. Tuyệt đối không ghép số lượng giao vào các cột tồn.`;

const LOI_NHAC_BAO_CAO_TON =
  "Đọc báo cáo lượng sơn tồn MLS-11-14 trong tài liệu đính kèm và ghi Tên tàu, Quý, Năm và TOÀN BỘ dòng sơn có tên (kèm đủ bốn cột số) theo đúng cấu trúc yêu cầu.";

/** Khuôn JSON nhắc thêm cho Gemini — để khi phải bỏ responseSchema (API từ chối khuôn) mô hình vẫn trả đúng dạng. */
const KHUON_JSON_GOI_Y =
  'Trả về DUY NHẤT một JSON dạng: {"nhaCungCap": string|null, "soPhieu": string|null, "ngayGiao": "dd/mm/yyyy"|null, "tau": string|null, "dong": [{"stt": number|null, "ten": string, "tenEn": string|null, "tenVi": string|null, "partNo": string|null, "impa": "6 chữ số"|null, "soLuong": number|null, "donVi": string|null, "loai": "STORE"|"SPARE", "thietBi": string|null, "trang": number|null, "canKiem": boolean, "lyDoKiem": string|null, "ghiChu": string|null}]}';

// ─── Bảng KIỂM KÊ (MLS-11-06 Store & Spare Part Inventory) ───────────────────
// Cùng khuôn kết quả với phiếu giao (một bộ chuẩn hóa / gộp lượt / soát dòng),
// chỉ khác lời dặn: số lượng là SỐ TỒN ĐẾM ĐƯỢC, ô trống là null chứ không phải 0.

const MO_TA_SO_TON =
  "SỐ TỒN THỰC TẾ ĐẾM ĐƯỢC trên tàu — cột 'Tồn trên tàu' / 'R.O.B' / 'Remain on board' / 'Hiện có' / 'On board'. KHÔNG lấy cột tồn đợt trước, nhận trong kỳ, tiêu thụ hay tối thiểu. Ô để TRỐNG → null (đừng ghi 0); chỉ ghi 0 khi biểu mẫu ghi rõ 0 hoặc gạch ngang '-'.";

export const CONG_CU_GHI_KIEM_KE = {
  name: CONG_CU_GHI_PHIEU.name,
  description:
    "Ghi lại toàn bộ bảng kiểm kê vật tư / phụ tùng đã đọc: thông tin đầu biểu mẫu và TỪNG dòng mặt hàng, mỗi dòng trên bảng là một phần tử của mảng dong.",
  input_schema: {
    ...CONG_CU_GHI_PHIEU.input_schema,
    properties: {
      ...CONG_CU_GHI_PHIEU.input_schema.properties,
      nhaCungCap: { type: ["string", "null"], description: "Luôn null — biểu mẫu kiểm kê không có nhà cung cấp." },
      soPhieu: { type: ["string", "null"], description: "Mã biểu mẫu nếu in trên trang (VD MLS-11-06), không có thì null." },
      ngayGiao: { type: ["string", "null"], description: "NGÀY KIỂM KÊ ghi trên biểu mẫu (ô Date / Ngày), dạng dd/mm/yyyy." },
      tau: { type: ["string", "null"], description: "Tên tàu ghi trên biểu mẫu (Vessel / Ship's name)." },
      kyBaoCao: {
        type: ["string", "null"],
        description: 'Ô kỳ "From month / Từ tháng … đến …" đúng như viết (VD "7/2026 đến 9/2026", "Quý III/2026"); để chấm chấm / bỏ trống thì null.',
      },
      dong: {
        ...CONG_CU_GHI_PHIEU.input_schema.properties.dong,
        description: "Mọi dòng mặt hàng trên bảng kiểm kê, theo thứ tự xuất hiện, qua hết các trang được yêu cầu.",
        items: {
          ...CONG_CU_GHI_PHIEU.input_schema.properties.dong.items,
          properties: {
            ...CONG_CU_GHI_PHIEU.input_schema.properties.dong.items.properties,
            soLuong: { type: ["number", "null"], description: MO_TA_SO_TON },
            tonDau: { type: ["number", "null"], description: "Cột 'Còn tồn đợt trước' / 'Last R.O.B'. Ô trống → null; gạch ngang → 0." },
            nhan: { type: ["number", "null"], description: "Cột 'Nhận trong kỳ' / 'Receive'. Ô trống → null; gạch ngang → 0." },
            tieuThu: { type: ["number", "null"], description: "Cột 'Tiêu thụ trong kỳ' / 'Cons.'. Ô trống → null; gạch ngang → 0." },
            thietBi: {
              type: ["string", "null"],
              description: "Nhóm của dòng: cột Group / Nhóm, hoặc tiêu đề nhóm phía trên (MAIN ENGINE, DECK STORES, PAINT...). Không có thì null.",
            },
          },
        },
      },
    },
  },
} as const;

export const HUONG_DAN_KIEM_KE = `Bạn là nhân viên kho của tàu biển, tỉ mỉ và không bao giờ đoán bừa. Nhiệm vụ: đọc BẢNG KIỂM KÊ vật tư / phụ tùng của tàu (biểu mẫu MLS-11-06 "Store & Spare Part Inventory" hoặc bảng tương tự) — có thể là bản scan nghiêng, mờ, nhiều trang, số viết tay — rồi ghi lại theo đúng cấu trúc yêu cầu.

Quy tắc:
1. MỖI dòng mặt hàng trên bảng là MỘT phần tử trong "dong". Không gộp, không bỏ sót, không bịa thêm. Đọc hết các trang được yêu cầu; dòng cuối mỗi trang và dòng đầu trang sau hay bị sót — kiểm kỹ.
2. "ten" giữ nguyên như in: không dịch, không sửa chính tả, không rút gọn. Mô tả song ngữ thì tách thêm tenEn / tenVi; một ngôn ngữ thì hai trường đó null.
3. IMPA là mã 6 chữ số của danh mục ship stores; Part No. là mã nhà sản xuất. Đừng lẫn hai cột; không có thì null.
4. "soLuong" là ${MO_TA_SO_TON.charAt(0).toLowerCase()}${MO_TA_SO_TON.slice(1)} Số viết tay đọc thật kỹ (0/6/8, 1/7, 3/8, 4/9 hay lẫn); bị gạch sửa thì lấy số mới và đặt canKiem = true.
5. "donVi" đúng cột đơn vị (PCS, SET, KG, LTR, M, BOX, ROLL, PAIR, CAN, DRUM, BTL...).
6. "loai": STORE cho vật tư tiêu hao / ship stores (hàng theo IMPA, boong, buồng, bếp, dụng cụ, sơn, hóa chất); SPARE cho phụ tùng máy móc, thiết bị.
7. "thietBi": nhóm của dòng (cột Group / Nhóm, hoặc tiêu đề nhóm trên bảng), ghi vào từng dòng thuộc nhóm đó.
8. "trang": số trang (đánh từ 1). "canKiem" = true ở chỗ chữ / số mờ, bị che, sửa tay hoặc không chắc — thà đánh dấu thừa còn hơn để lọt số sai; nói lý do ở lyDoKiem.
9. Không ghi dòng tiêu đề cột, dòng tổng, chữ ký vào "dong".
10. Đầu biểu mẫu: tau, ngayGiao (= ngày kiểm kê, dd/mm/yyyy), soPhieu (mã biểu mẫu), kyBaoCao (ô "From month / Từ tháng … đến …" đúng như viết, chưa điền thì null); nhaCungCap luôn null.
11. Biểu mẫu có thêm các cột kỳ thì ghi đúng cột: tonDau = Còn tồn đợt trước / Last R.O.B, nhan = Nhận trong kỳ / Receive, tieuThu = Tiêu thụ trong kỳ / Cons. — ô trống null, gạch ngang 0; đừng dồn số sang cột bên cạnh. soLuong vẫn là cột Tồn trên tàu / R.O.B. Bảng không có các cột đó thì để ba trường này null.`;

const LOI_NHAC_KIEM_KE = "Đọc bảng kiểm kê vật tư / phụ tùng trong tài liệu đính kèm và ghi TOÀN BỘ dòng mặt hàng theo đúng cấu trúc yêu cầu.";

// ─── BÁO GIÁ của nhà cung cấp (quotation) ────────────────────────────────────
// Cùng khuôn kết quả; thêm đơn giá từng dòng và loại tiền của báo giá.

export const CONG_CU_GHI_BAO_GIA = {
  name: CONG_CU_GHI_PHIEU.name,
  description:
    "Ghi lại toàn bộ báo giá đã đọc: thông tin đầu báo giá và TỪNG dòng hàng được chào giá, mỗi dòng trên báo giá là một phần tử của mảng dong.",
  input_schema: {
    ...CONG_CU_GHI_PHIEU.input_schema,
    properties: {
      ...CONG_CU_GHI_PHIEU.input_schema.properties,
      nhaCungCap: { type: ["string", "null"], description: "Tên nhà cung cấp gửi báo giá, đúng như in trên báo giá." },
      soPhieu: { type: ["string", "null"], description: "Số báo giá (Quotation No. / Our ref / Số báo giá)." },
      ngayGiao: { type: ["string", "null"], description: "Ngày báo giá, dạng dd/mm/yyyy." },
      tau: { type: ["string", "null"], description: "Tên tàu ghi trên báo giá (Vessel / M/V), nếu có." },
      tienTe: { type: ["string", "null"], description: "Mã loại tiền của báo giá: USD, VND, SGD, EUR, JPY..." },
      dong: {
        ...CONG_CU_GHI_PHIEU.input_schema.properties.dong,
        description: "Mọi dòng hàng được chào giá, theo thứ tự xuất hiện, qua hết các trang được yêu cầu.",
        items: {
          ...CONG_CU_GHI_PHIEU.input_schema.properties.dong.items,
          properties: {
            ...CONG_CU_GHI_PHIEU.input_schema.properties.dong.items.properties,
            soLuong: { type: ["number", "null"], description: "Số lượng được chào giá (Q'ty), là số." },
            donGia: {
              type: ["number", "null"],
              description: "ĐƠN GIÁ của một đơn vị (Unit price), là số — KHÔNG phải thành tiền (Amount / Total). Không có thì null.",
            },
          },
        },
      },
    },
  },
} as const;

export const HUONG_DAN_BAO_GIA = `Bạn là nhân viên mua hàng của công ty quản lý tàu biển, tỉ mỉ và không bao giờ đoán bừa. Nhiệm vụ: đọc BÁO GIÁ (quotation / offer) của nhà cung cấp — bản PDF hoặc bản scan, tiếng Anh hoặc tiếng Việt, nhiều trang — rồi ghi lại theo đúng cấu trúc yêu cầu.

Quy tắc:
1. MỖI dòng hàng được chào giá là MỘT phần tử trong "dong". Không gộp, không bỏ sót, không bịa thêm; dòng cuối mỗi trang và dòng đầu trang sau hay bị sót — kiểm kỹ.
2. "ten" giữ nguyên như in: không dịch, không sửa, không rút gọn. Song ngữ thì tách thêm tenEn / tenVi.
3. IMPA là mã 6 chữ số; Part No. là mã nhà sản xuất. Không có thì null.
4. "soLuong" là số lượng chào giá; "donGia" là đơn giá MỘT đơn vị — không lấy cột thành tiền / Amount. Chỉ có thành tiền và số lượng thì donGia = thành tiền / số lượng và đặt canKiem = true. Số có dấu ngăn nghìn đọc đúng giá trị (1,250.00 = 1250; 1.250.000 VND = 1250000).
5. "donVi" đúng cột đơn vị (PCS, SET, KG, LTR, M, BOX, ROLL, PAIR, CAN, DRUM...).
6. "loai": STORE cho vật tư tiêu hao / ship stores; SPARE cho phụ tùng máy móc, thiết bị.
7. "trang": số trang (đánh từ 1). "canKiem" = true ở chỗ mờ, sửa tay hoặc không chắc; nói lý do ở lyDoKiem. Ghi chú riêng của dòng (hàng thay thế, thời gian giao, hết hàng...) ghi vào ghiChu.
8. Không ghi dòng tổng cộng, chiết khấu, phí vận chuyển, điều khoản, chữ ký vào "dong".
9. Đầu báo giá: nhaCungCap, soPhieu (số báo giá), ngayGiao (ngày báo giá dd/mm/yyyy), tau, tienTe (mã loại tiền) — không rõ thì null.`;

const LOI_NHAC_BAO_GIA = "Đọc báo giá của nhà cung cấp trong tài liệu đính kèm và ghi TOÀN BỘ dòng hàng (kèm đơn giá) theo đúng cấu trúc yêu cầu.";

// ─── BÁO CÁO DỤNG CỤ CHẰNG BUỘC CONTAINER (MLS-11-13) ─────────────────────────
// Bảng 10 cột: Stt | Dụng cụ | Ký hiệu | (1) tối thiểu | (2) chuẩn | (3) còn dùng |
// (4) hỏng | (5) toàn bộ | (6) thiếu | (7) yêu cầu. Không có đơn vị, không có loại.

const SO_CB = (moTa: string) => ({ type: ["number", "null"], description: `${moTa} Ô trống → null; gạch ngang '-' → 0.` });

export const CONG_CU_GHI_CHANG_BUOC = {
  name: CONG_CU_GHI_PHIEU.name,
  description:
    "Ghi lại toàn bộ báo cáo dụng cụ chằng buộc container MLS-11-13 đã đọc: dòng Ship's Name / Port / Date và TỪNG dòng dụng cụ trong bảng, mỗi dòng là một phần tử của mảng dong.",
  input_schema: {
    type: "object",
    properties: {
      nhaCungCap: { type: ["string", "null"], description: "Luôn null." },
      soPhieu: { type: ["string", "null"], description: "Mã biểu mẫu nếu in trên trang (VD MLS-11-13), không có thì null." },
      tau: { type: ["string", "null"], description: "Tên tàu ở ô Ship's Name (Tên tàu)." },
      cang: { type: ["string", "null"], description: "Cảng ở ô Port (Cảng)." },
      ngayGiao: { type: ["string", "null"], description: "Ngày ở ô Date (Ngày), dạng dd/mm/yyyy." },
      dong: {
        type: "array",
        description: "Mọi dòng dụng cụ CÓ TÊN trong bảng, theo thứ tự, qua hết các trang được yêu cầu. Bỏ dòng mẫu còn trống (chỉ có số thứ tự).",
        items: {
          type: "object",
          properties: {
            stt: { type: ["integer", "null"], description: "Số thứ tự (No. / Stt)." },
            ten: { type: "string", description: "Tên dụng cụ (Type of fitting gear / Dụng cụ chằng buộc) ĐÚNG NHƯ VIẾT: không dịch, không sửa." },
            partNo: { type: ["string", "null"], description: "Cột Part No. / Mark (Ký hiệu)." },
            toiThieu: SO_CB("Cột (1) Minimum quantity for full load / SL tối thiểu."),
            chuan: SO_CB("Cột (2) Standard out-fitting / Trang bị chuẩn."),
            conDung: SO_CB("Cột (3) In order / Còn sử dụng được."),
            hong: SO_CB("Cột (4) Out of order / Bị hỏng."),
            tong: SO_CB("Cột (5)=(3+4) Total stock / Toàn bộ có trên tàu."),
            thieu: SO_CB("Cột (6)=(1-3) Short of minimum qtty / SL thiếu tối thiểu."),
            yeuCau: SO_CB("Cột (7) Order / Yêu cầu."),
            trang: { type: ["integer", "null"], description: "Số trang của tài liệu (đánh từ 1) mà dòng này nằm." },
            canKiem: { type: ["boolean", "null"], description: "true nếu chữ / số mờ, sửa tay hoặc bạn KHÔNG CHẮC đã đọc đúng." },
            lyDoKiem: { type: ["string", "null"], description: "Khi canKiem = true: nói ngắn vì sao." },
            ghiChu: { type: ["string", "null"], description: "Ghi chú riêng của dòng nếu có." },
          },
          required: ["ten"],
        },
      },
    },
    required: ["dong"],
  },
} as const;

export const HUONG_DAN_CHANG_BUOC = `Bạn là sĩ quan boong của tàu container, tỉ mỉ và không bao giờ đoán bừa. Nhiệm vụ: đọc BÁO CÁO DỤNG CỤ CHẰNG BUỘC CONTAINER theo biểu mẫu MLS-11-13 — có thể là bản scan nghiêng, mờ, số viết tay, nhiều trang — rồi ghi lại theo đúng cấu trúc yêu cầu.

Bảng có 10 cột theo thứ tự: No. / Stt | Type of fitting gear / Dụng cụ chằng buộc | Part No. / Mark / Ký hiệu | (1) Minimum quantity for full load / SL tối thiểu | (2) Standard out-fitting / Trang bị chuẩn | (3) In order / Còn sử dụng được | (4) Out of order / Bị hỏng | (5)=(3+4) Total stock / Toàn bộ | (6)=(1-3) Short of minimum / SL thiếu | (7) Order / Yêu cầu. Hàng đánh số "1 2 3 4 5=(3+4) 6=(1-3) 7" là hàng tiêu đề, không phải dữ liệu.

Quy tắc:
1. MỖI dòng dụng cụ CÓ TÊN là MỘT phần tử trong "dong". Dòng mẫu còn trống (chỉ có số thứ tự) thì bỏ. Không gộp, không bỏ sót, không bịa thêm; dòng cuối mỗi trang và dòng đầu trang sau hay bị sót — kiểm kỹ.
2. "ten" giữ nguyên như viết (twistlock, lashing bar, turnbuckle, bridge fitting, stacking cone, D-ring...): không dịch, không sửa chính tả.
3. Mỗi cột số ghi đúng vào trường của nó: toiThieu (1), chuan (2), conDung (3), hong (4), tong (5), thieu (6), yeuCau (7). Ô trống → null; gạch ngang '-' → 0. Đừng dồn số sang cột bên cạnh khi có ô trống. Số viết tay đọc thật kỹ (0/6/8, 1/7, 3/8, 4/9 hay lẫn); bị gạch sửa thì lấy số mới và đặt canKiem = true.
4. "trang": số trang (đánh từ 1). "canKiem" = true ở chỗ mờ, sửa tay hoặc không chắc — thà đánh dấu thừa còn hơn để lọt số sai; nói lý do ở lyDoKiem.
5. Không ghi hàng tiêu đề, hàng đánh số, dòng chữ ký (Người kiểm kê, Đại phó / Chief Officer, Thuyền trưởng / Captain) vào "dong".
6. Đầu biểu mẫu: tau (Ship's Name), cang (Port), ngayGiao (Date, dd/mm/yyyy); soPhieu = mã biểu mẫu; nhaCungCap luôn null.`;

const LOI_NHAC_CHANG_BUOC = "Đọc báo cáo dụng cụ chằng buộc MLS-11-13 trong tài liệu đính kèm và ghi TOÀN BỘ dòng dụng cụ có tên (kèm đủ các cột số) theo đúng cấu trúc yêu cầu.";

// ─── PHIẾU YÊU CẦU VẬT TƯ / PHỤ TÙNG (MLS-11-05B / MLS-11-05A) ────────────────
// Bảng: Stt | Mô tả / Tên phụ tùng | (ITEM / Hạng mục) | Mã IMPA hoặc Part No. |
// Đơn vị | R.O.B (còn tồn) | S.lượng yêu cầu | S.lượng duyệt. "soLuong" là số YÊU
// CẦU, "ton" là R.O.B; cột duyệt bỏ qua (công ty điền sau).

const CHUOI_NULL = (moTa: string) => ({ type: ["string", "null"], description: moTa });

export const CONG_CU_GHI_YEU_CAU = {
  name: CONG_CU_GHI_PHIEU.name,
  description:
    "Ghi lại toàn bộ phiếu yêu cầu vật tư / phụ tùng (MLS-11-05B / MLS-11-05A hoặc bảng tương tự) đã đọc: đầu phiếu và TỪNG dòng hàng, mỗi dòng trên bảng là một phần tử của mảng dong.",
  input_schema: {
    type: "object",
    properties: {
      nhaCungCap: { type: ["string", "null"], description: "Luôn null." },
      soPhieu: CHUOI_NULL("Số yêu cầu ở ô Req. No. / Số y/cầu (VD 001/2026), KHÔNG phải mã biểu mẫu MLS-11-05."),
      ngayGiao: CHUOI_NULL("Ngày ở ô Date / Ngày của phiếu, dạng dd/mm/yyyy (không lấy 'Ngày ban hành' của khung biểu mẫu)."),
      tau: CHUOI_NULL("Tên tàu ở ô Vsl. / Tàu / M/V."),
      boPhan: CHUOI_NULL("Ô Dept. / Bộ phận, đúng như viết (ENGINE DEPARTMENT, DECK, ELECTRIC...)."),
      loaiYeuCau: CHUOI_NULL("Ghi STORE nếu tiêu đề là REQUISITION FOR STORES / Yêu cầu vật tư (MLS-11-05B); SPARE nếu REQUISITION FOR SPARE PARTS / Yêu cầu phụ tùng (MLS-11-05A); không rõ thì null."),
      mayThietBi: CHUOI_NULL("Phiếu phụ tùng: ô Equipment / Machinery / Thiết bị."),
      hangSx: CHUOI_NULL("Phiếu phụ tùng: ô Maker / Hãng SX."),
      kieuMay: CHUOI_NULL("Phiếu phụ tùng: ô Type / Model / Kiểu."),
      soMay: CHUOI_NULL("Phiếu phụ tùng: ô Serial No. / Engine No. / Số máy."),
      dong: {
        type: "array",
        description: "Mọi dòng hàng CÓ MÔ TẢ trong bảng, theo thứ tự, qua hết các trang được yêu cầu.",
        items: {
          type: "object",
          properties: {
            stt: { type: ["integer", "null"], description: "Số thứ tự (S. No. / Stt)." },
            ten: { type: "string", description: "Mô tả / tên phụ tùng ĐÚNG NHƯ VIẾT, giữ cả phần tiếng Việt trong ngoặc: không dịch, không sửa." },
            impa: CHUOI_NULL("Cột IMPA Code / Mã IMPA: mã 6 chữ số (có thể in '23 29 08'). 'NA' hoặc trống → null."),
            partNo: CHUOI_NULL("Cột Part No. / Số phụ tùng / Drawing No. (phiếu phụ tùng)."),
            hangMuc: CHUOI_NULL("Cột ITEM / Hạng mục của phiếu phụ tùng nếu có."),
            donVi: CHUOI_NULL("Cột Unit / Đơn vị đúng như viết (pcs, set, kg, ltr, pair, roll, can...)."),
            ton: { type: ["number", "null"], description: "Cột R.O.B / Còn tồn trên tàu. Ô trống → null; gạch ngang '-' → 0." },
            soLuong: { type: ["number", "null"], description: "Cột Q'ty Req. / S.lượng YÊU CẦU (không phải cột duyệt Q'ty App.). Ô trống → null." },
            thietBi: CHUOI_NULL("Tiêu đề phần đứng phía trên dòng trong bảng (VD ELECTRIC, DECK) nếu bảng chia phần; không có thì null."),
            trang: { type: ["integer", "null"], description: "Số trang của tài liệu (đánh từ 1) mà dòng này nằm." },
            canKiem: { type: ["boolean", "null"], description: "true nếu chữ / số mờ, sửa tay hoặc bạn KHÔNG CHẮC đã đọc đúng." },
            lyDoKiem: CHUOI_NULL("Khi canKiem = true: nói ngắn vì sao."),
            ghiChu: CHUOI_NULL("Cột Remark / Ghi chú của dòng nếu có."),
          },
          required: ["ten"],
        },
      },
    },
    required: ["dong"],
  },
} as const;

export const HUONG_DAN_YEU_CAU = `Bạn là sĩ quan / thủ kho của tàu biển, tỉ mỉ và không bao giờ đoán bừa. Nhiệm vụ: đọc PHIẾU YÊU CẦU VẬT TƯ (Requisition for Stores, MLS-11-05B) hoặc YÊU CẦU PHỤ TÙNG (Requisition for Spare Parts, MLS-11-05A) của công ty, hay bảng yêu cầu tương tự đã đổi phiên bản — có thể là bản scan nghiêng, mờ, số viết tay, nhiều trang — rồi ghi lại theo đúng cấu trúc yêu cầu.

Bảng thường có các cột: S. No. / Stt | Description / Mô tả (phụ tùng: Name of part / Tên phụ tùng, có thể thêm ITEM / Hạng mục) | IMPA Code / Mã IMPA (phụ tùng: Part No. / Số phụ tùng) | Unit / Đơn vị | R.O.B / Còn tồn trên tàu | Q'ty Req. / S.lượng yêu cầu | Q'ty App. / S.lượng duyệt. Tiêu đề cột in hai hàng Anh / Việt.

Quy tắc:
1. MỖI dòng hàng có mô tả là MỘT phần tử trong "dong". Không gộp, không bỏ sót, không bịa thêm; dòng cuối mỗi trang và dòng đầu trang sau hay bị sót — kiểm kỹ.
2. "ten" giữ nguyên như viết (kể cả phần tiếng Việt trong ngoặc): không dịch, không sửa chính tả.
3. "soLuong" là cột S.lượng YÊU CẦU; "ton" là cột R.O.B / Còn tồn. KHÔNG lấy cột S.lượng duyệt. Ô trống → null; gạch ngang '-' → 0. Số viết tay đọc thật kỹ (0/6/8, 1/7, 3/8, 4/9 hay lẫn); bị gạch sửa thì lấy số mới và đặt canKiem = true.
4. IMPA là mã 6 chữ số (có thể in cách "23 29 08"); Part No. là mã nhà sản xuất. Đừng lẫn hai cột; "NA" hay trống thì null.
5. Dòng chỉ có chữ, không số thứ tự, không số lượng (VD "ELECTRIC") là TIÊU ĐỀ PHẦN: không ghi thành dòng, mà ghi vào "thietBi" của các dòng bên dưới nó.
6. "trang": số trang (đánh từ 1). "canKiem" = true ở chỗ mờ, sửa tay hoặc không chắc — thà đánh dấu thừa còn hơn để lọt số sai; nói lý do ở lyDoKiem.
7. Không ghi hàng tiêu đề cột, dòng chữ ký (Chief Engineer / Chief Officer, Captain, Tech.&Pur Dept, Vice Director, Máy trưởng, Thuyền trưởng...) vào "dong".
8. Đầu phiếu: tau (Vsl. / Tàu), ngayGiao (Date / Ngày, dd/mm/yyyy — không lấy "Ngày ban hành" của khung biểu mẫu), soPhieu (Req. No. / Số y/cầu), boPhan (Dept. / Bộ phận), loaiYeuCau (STORE / SPARE theo tiêu đề), và với phiếu phụ tùng: mayThietBi, hangSx, kieuMay, soMay. nhaCungCap luôn null.`;

const LOI_NHAC_YEU_CAU = "Đọc phiếu yêu cầu vật tư / phụ tùng trong tài liệu đính kèm và ghi TOÀN BỘ dòng hàng (kèm R.O.B và số lượng yêu cầu) theo đúng cấu trúc yêu cầu.";

/** Lời dặn, lời nhắc, công cụ và khuôn JSON theo loại tài liệu. */
const BAN_DOC = {
  phieuGiao: { huongDan: HUONG_DAN_HE_THONG, loiNhac: LOI_NHAC_NGUOI_DUNG, congCu: CONG_CU_GHI_PHIEU, khuonJson: KHUON_JSON_GOI_Y, taiLieu: "phiếu" },
  phieuSon: { huongDan: HUONG_DAN_PHIEU_SON, loiNhac: LOI_NHAC_PHIEU_SON, congCu: CONG_CU_GHI_PHIEU, khuonJson: KHUON_JSON_GOI_Y, taiLieu: "phiếu giao sơn" },
  baoCaoTon: {
    huongDan: HUONG_DAN_BAO_CAO_TON,
    loiNhac: LOI_NHAC_BAO_CAO_TON,
    congCu: CONG_CU_GHI_BAO_CAO_TON,
    khuonJson:
      'Trả về DUY NHẤT một JSON dạng: {"nhaCungCap": null, "soPhieu": string|null, "ngayGiao": null, "tau": string|null, "quy": string|null, "nam": string|null, "dong": [{"stt": number|null, "ten": string, "donVi": string|null, "tonDau": number|null, "nhan": number|null, "tieuThu": number|null, "tonCuoi": number|null, "trang": number|null, "canKiem": boolean, "lyDoKiem": string|null, "ghiChu": string|null}]}',
    taiLieu: "báo cáo tồn",
  },
  kiemKe: {
    huongDan: HUONG_DAN_KIEM_KE,
    loiNhac: LOI_NHAC_KIEM_KE,
    congCu: CONG_CU_GHI_KIEM_KE,
    khuonJson: `${KHUON_JSON_GOI_Y} Trong bảng kiểm kê "soLuong" là số tồn đếm được (cột Tồn trên tàu / R.O.B), ô trống = null; mỗi dòng thêm "tonDau", "nhan", "tieuThu": number|null (Còn tồn đợt trước · Nhận trong kỳ · Tiêu thụ trong kỳ), đầu biểu mẫu thêm "kyBaoCao": string|null (ô Từ tháng … đến …).`,
    taiLieu: "bảng kiểm kê",
  },
  baoGia: {
    huongDan: HUONG_DAN_BAO_GIA,
    loiNhac: LOI_NHAC_BAO_GIA,
    congCu: CONG_CU_GHI_BAO_GIA,
    khuonJson: `${KHUON_JSON_GOI_Y} Với báo giá: mỗi dòng thêm "donGia": number|null (đơn giá một đơn vị), đầu báo giá thêm "tienTe": string|null (USD, VND...).`,
    taiLieu: "báo giá",
  },
  changBuoc: {
    huongDan: HUONG_DAN_CHANG_BUOC,
    loiNhac: LOI_NHAC_CHANG_BUOC,
    congCu: CONG_CU_GHI_CHANG_BUOC,
    khuonJson:
      'Trả về DUY NHẤT một JSON dạng: {"nhaCungCap": null, "soPhieu": string|null, "tau": string|null, "cang": string|null, "ngayGiao": "dd/mm/yyyy"|null, "dong": [{"stt": number|null, "ten": string, "partNo": string|null, "toiThieu": number|null, "chuan": number|null, "conDung": number|null, "hong": number|null, "tong": number|null, "thieu": number|null, "yeuCau": number|null, "trang": number|null, "canKiem": boolean, "lyDoKiem": string|null, "ghiChu": string|null}]}',
    taiLieu: "báo cáo chằng buộc",
  },
  yeuCau: {
    huongDan: HUONG_DAN_YEU_CAU,
    loiNhac: LOI_NHAC_YEU_CAU,
    congCu: CONG_CU_GHI_YEU_CAU,
    khuonJson:
      'Trả về DUY NHẤT một JSON dạng: {"nhaCungCap": null, "soPhieu": string|null, "ngayGiao": "dd/mm/yyyy"|null, "tau": string|null, "boPhan": string|null, "loaiYeuCau": "STORE"|"SPARE"|null, "mayThietBi": string|null, "hangSx": string|null, "kieuMay": string|null, "soMay": string|null, "dong": [{"stt": number|null, "ten": string, "impa": string|null, "partNo": string|null, "hangMuc": string|null, "donVi": string|null, "ton": number|null, "soLuong": number|null, "thietBi": string|null, "trang": number|null, "canKiem": boolean, "lyDoKiem": string|null, "ghiChu": string|null}]}',
    taiLieu: "phiếu yêu cầu",
  },
} as const;
const banDocCua = (tc: { banDoc?: BanDocAi }) => BAN_DOC[tc.banDoc ?? "phieuGiao"];

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
  donGia?: unknown;
  toiThieu?: unknown;
  chuan?: unknown;
  conDung?: unknown;
  hong?: unknown;
  tong?: unknown;
  thieu?: unknown;
  yeuCau?: unknown;
  ton?: unknown;
  hangMuc?: unknown;
  tonDau?: unknown;
  nhan?: unknown;
  tieuThu?: unknown;
  tonCuoi?: unknown;
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

/**
 * Số lượng AI trả về. Thường là number, nhưng có lúc là chuỗi chép theo phiếu:
 * "1.000,00" (kiểu Việt), "1,250.00" (quốc tế), "20 L", "4 x 20L", "12 (sửa 10)".
 * Trước đây chuỗi được đọc thô — bỏ chữ, đổi dấu phẩy đầu tiên thành chấm — nên
 * "1.000,00" thành "1.000.00", không phải số, dòng bị coi là CHƯA CÓ số lượng;
 * "1.000" thành 1; "4 x 20L" thành 420. Nay: lấy cụm số ĐẦU TIÊN, đọc bằng
 * docSoLoc (đoán đúng dấu thập phân / ngăn nghìn); kiểu "số lon × dung tích" lấy
 * số lon và trả kèm chữ gốc (nhan) để báo người soát kiểm lại đơn vị.
 */
export function docSoLuongAi(v: unknown): { so: number | null; nhan: string | null } {
  if (typeof v === "number") return { so: Number.isFinite(v) && v >= 0 ? v : null, nhan: null };
  if (v === null || v === undefined || typeof v === "boolean") return { so: null, nhan: null };
  const s = String(v).trim();
  const nhan = /\d[\d.,]*\s*[x×*]\s*\d/i.test(s) ? s.slice(0, 40) : null;
  const cum = /-?\d[\d.,]*/.exec(s);
  const n = cum ? docSoLoc(cum[0].replace(/[.,]$/, "")) : null;
  return { so: n !== null && Number.isFinite(n) && n >= 0 ? n : null, nhan };
}
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
    tienTe: chuoi(o.tienTe, 10)?.toUpperCase() ?? null,
    cang: chuoi(o.cang, 80),
  };
  // Đầu phiếu yêu cầu MLS-11-05A/B (chế độ "yeuCau"): chỉ dựng khi AI trả ít nhất một ô.
  const KHOA_YC = ["boPhan", "loaiYeuCau", "mayThietBi", "hangSx", "kieuMay", "soMay"] as const;
  if (KHOA_YC.some((k) => k in o)) {
    dau.yc = {
      boPhan: chuoi(o.boPhan, 80),
      loaiYeuCau: chuoi(o.loaiYeuCau, 20),
      mayThietBi: chuoi(o.mayThietBi, 120),
      hangSx: chuoi(o.hangSx, 120),
      kieuMay: chuoi(o.kieuMay, 120),
      soMay: chuoi(o.soMay, 120),
    };
  }
  // Báo cáo lượng sơn tồn MLS-11-14 (chế độ "baoCaoTon"): ô Quý / Năm, chữ thô.
  if ("quy" in o || "nam" in o) {
    dau.quy = chuoi(o.quy, 20);
    dau.nam = chuoi(o.nam, 10);
  }
  // Bảng kiểm kê MLS-11-06 (chế độ "kiemKe"): ô kỳ "Từ tháng … đến …", chữ thô.
  if ("kyBaoCao" in o) dau.kyBaoCao = chuoi(o.kyBaoCao, 80);
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
    const sl = docSoLuongAi(d.soLuong);
    // Ô trống / không phải số: phiếu giao coi là 0 như trước; bảng kiểm kê cần
    // biết đây là "chưa đếm" chứ không phải "đếm được 0" (soLuongTrong).
    const soLuongTrong = sl.so === null;
    const soLuong = sl.so ?? 0;
    // Đơn giá (báo giá): chuỗi có ngăn nghìn kiểu VN / quốc tế đọc bằng docSoLoc.
    const giaRaw = d.donGia;
    const giaSo = typeof giaRaw === "number" ? giaRaw : giaRaw === null || giaRaw === undefined ? null : docSoLoc(String(giaRaw));
    const donGia = giaSo !== null && Number.isFinite(giaSo) && giaSo >= 0 ? giaSo : null;
    // Cột số MLS-11-13 (chế độ "changBuoc"): chỉ dựng khi AI trả ít nhất một cột.
    const KHOA_CB = ["toiThieu", "chuan", "conDung", "hong", "tong", "thieu", "yeuCau"] as const;
    const soCb = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
      const s = String(v).trim();
      if (/^[-–—]+$/.test(s)) return 0;
      const n = docSoLoc(s);
      return n !== null && Number.isFinite(n) && n >= 0 ? n : null;
    };
    const cb: SoChangBuoc | undefined = KHOA_CB.some((k) => k in d)
      ? { toiThieu: soCb(d.toiThieu), chuan: soCb(d.chuan), conDung: soCb(d.conDung), hong: soCb(d.hong), tong: soCb(d.tong), thieu: soCb(d.thieu), yeuCau: soCb(d.yeuCau) }
      : undefined;
    // Báo cáo lượng sơn tồn MLS-11-14 (chế độ "baoCaoTon"): bốn cột số, Tồn cuối kỳ là số chính.
    // Bảng kiểm kê MLS-11-06 (chế độ "kiemKe") trả ba cột kỳ kèm soLuong = Tồn trên tàu (số đếm).
    const KHOA_BC = ["tonDau", "nhan", "tieuThu", "tonCuoi"] as const;
    const bc: SoBaoCaoTonAi | undefined = KHOA_BC.some((k) => k in d)
      ? { tonDau: soCb(d.tonDau), nhan: soCb(d.nhan), tieuThu: soCb(d.tieuThu), tonCuoi: "tonCuoi" in d ? soCb(d.tonCuoi) : sl.so }
      : undefined;
    // Phiếu yêu cầu (chế độ "yeuCau"): R.O.B và cột ITEM / Hạng mục.
    const coTon = "ton" in d;
    const ton = coTon ? soCb(d.ton) : null;
    const hangMuc = chuoi(d.hangMuc, 80);
    const donViTho = chuoi(d.donVi, 20);
    // Báo cáo tồn để trống đơn vị thì giữ trống (không tự điền PCS cho sơn).
    const donVi = donViTho ? chuanDonVi(donViTho) : bc ? "" : "PCS";
    const loaiTho = String(d.loai ?? "").toUpperCase();
    const loai: "STORE" | "SPARE" = loaiTho === "STORE" || loaiTho === "SPARE" ? loaiTho : impa ? "STORE" : "SPARE";
    const thietBi = chuoi(d.thietBi, 120);
    const ghiChu = chuoi(d.ghiChu, 200);
    const trangSo = Number(d.trang);
    const trang = Number.isInteger(trangSo) && trangSo > 0 ? trangSo : null;
    const canKiem = d.canKiem === true || String(d.canKiem).toLowerCase() === "true";
    const canhBaoKiem = canKiem ? `AI không chắc: ${chuoi(d.lyDoKiem, 160) ?? "chữ khó đọc"}` : null;
    const canhBao = sl.nhan ? themCanhBao(canhBaoKiem, `Phiếu ghi số lượng "${sl.nhan}" — đã lấy ${soLuong}, kiểm lại đơn vị`) : canhBaoKiem;
    const stt = Number.isInteger(d.stt) ? Number(d.stt) : i + 1;
    const chuGoc = cb
      ? `${stt}. ${tenIn ?? ten}${partNo ? ` · ${partNo}` : ""} — tối thiểu ${cb.toiThieu ?? "—"} · chuẩn ${cb.chuan ?? "—"} · còn dùng ${cb.conDung ?? "—"} · hỏng ${cb.hong ?? "—"}${
          cb.yeuCau !== null ? ` · yêu cầu ${cb.yeuCau}` : ""
        }${trang ? ` · tr.${trang}` : ""}`
      : bc
        ? `${stt}. ${tenIn ?? ten}${donVi ? ` · ${donVi}` : ""} — đầu kỳ ${bc.tonDau ?? "—"} · nhận ${bc.nhan ?? "—"} · tiêu thụ ${bc.tieuThu ?? "—"} · cuối kỳ ${bc.tonCuoi ?? "—"}${
            trang ? ` · tr.${trang}` : ""
          }${ghiChu ? ` (${ghiChu})` : ""}`
        : `${stt}. ${tenIn ?? ten}${partNo ? ` · P/N ${partNo}` : ""}${impa ? ` · IMPA ${impa}` : ""} — ${soLuong} ${donVi}${
      thietBi ? ` · ${thietBi}` : ""
    }${coTon ? ` · ROB ${ton ?? "—"}` : ""}${trang ? ` · tr.${trang}` : ""}${ghiChu ? ` (${ghiChu})` : ""}`;
    dong.push({
      chuGoc: chuGoc.slice(0, 500),
      ten,
      tenEn: tenEn && tenEn !== ten ? tenEn : tenEn === ten && tenVi ? tenEn : tenEn && !tenVi ? null : tenEn,
      partNo,
      impa,
      // Báo cáo tồn: "số lượng" là Tồn cuối kỳ; trống = chưa ghi, 0 = đã hết (khác nhau).
      soLuong: bc ? (bc.tonCuoi ?? 0) : soLuong,
      donVi,
      loai,
      thietBi,
      trang,
      canhBao: ghiChu && /gạch|thiếu|hủy|cancel|short|miss|thay/i.test(ghiChu) ? themCanhBao(canhBao, `Ghi chú trên phiếu: ${ghiChu}`) : canhBao,
      soLuongTrong: bc ? bc.tonCuoi === null : soLuongTrong,
      donGia,
      ...(cb ? { cb } : {}),
      ...(bc ? { bc } : {}),
      ...(coTon ? { ton } : {}),
      ...(hangMuc ? { hangMuc } : {}),
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
    dau.cang ? `Cảng: ${dau.cang}` : null,
    dau.quy || dau.nam ? `Quý: ${dau.quy ?? "—"} · Năm: ${dau.nam ?? "—"}` : null,
    dau.kyBaoCao ? `Kỳ: ${dau.kyBaoCao}` : null,
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
    if (JSON.stringify(cu.cb ?? null) !== JSON.stringify(d.cb ?? null)) {
      return { ...d, canhBao: themCanhBao(d.canhBao, "Lượt kiểm lại sửa cột số (lượt 1: " + JSON.stringify(cu.cb ?? null) + ")") };
    }
    if (JSON.stringify(cu.bc ?? null) !== JSON.stringify(d.bc ?? null)) {
      const c = cu.bc;
      return {
        ...d,
        canhBao: themCanhBao(d.canhBao, `Lượt kiểm lại sửa cột số (lượt 1: đầu ${c?.tonDau ?? "—"} · nhận ${c?.nhan ?? "—"} · tiêu thụ ${c?.tieuThu ?? "—"} · cuối ${c?.tonCuoi ?? "—"})`),
      };
    }
    if ((cu.ton ?? null) !== (d.ton ?? null)) {
      return { ...d, canhBao: themCanhBao(d.canhBao, `Lượt kiểm lại sửa R.O.B (lượt 1: ${cu.ton ?? "trống"})`) };
    }
    if ((cu.donGia ?? null) !== (d.donGia ?? null)) {
      return { ...d, canhBao: themCanhBao(d.canhBao, `Lượt kiểm lại sửa đơn giá (lượt 1: ${cu.donGia ?? "trống"})`) };
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
    // Báo cáo tồn: Tồn cuối kỳ 0 là số thật; chỉ ô trống mới đáng ngờ. Đơn vị sơn (PAIL…) không theo danh sách vật tư.
    if (d.bc) {
      if (d.bc.tonCuoi === null) lyDo.push("Trống Tồn cuối kỳ");
    } else {
      if (!d.cb && !(d.soLuong > 0)) lyDo.push("Số lượng 0 hoặc trống");
      if (!d.cb && !DON_VI_BIET.has(d.donVi)) lyDo.push(`Đơn vị lạ "${d.donVi}"`);
    }
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
  /** Loại tài liệu (mặc định phiếu giao hàng). */
  banDoc?: BanDocAi;
  /** Trần TỔNG thời gian của một lần gọi (ms). Mặc định TONG_MS_MAC_DINH. */
  timeoutMs?: number;
  /**
   * Trần thời gian AI IM LẶNG — không gửi thêm chữ nào — trước khi coi là treo
   * (ms). Mặc định IM_LANG_MS_MAC_DINH. Đây mới là ngưỡng quyết định: phiếu
   * 300 dòng AI viết mất vài phút là bình thường, miễn là vẫn đang viết.
   */
  imLangMs?: number;
  /** Để kiểm thử thay fetch thật. */
  fetchFn?: FetchGia;
  /** Thời gian chờ trước mỗi lần thử lại khi hết hạn mức / quá tải (ms) — kiểm thử đặt ngắn. */
  choThuLaiMs?: number[];
  /** Số trang của PDF (nơi gọi đếm bằng pdfjs) — để chia cụm; không biết thì đọc một lần. */
  soTrang?: number | null;
  /**
   * Chữ đã tách từ PDF (lib/pdfChu.ts hoặc OCR), mỗi trang mở đầu bằng
   * "--- trang N ---". BẮT BUỘC với nhà cung cấp chỉ đọc chữ (DeepSeek).
   */
  chuPdf?: string | null;
  /** Báo tiến độ: đã xong bao nhiêu lượt gọi / tổng số lượt dự kiến. */
  onTienDo?: (xong: number, tong: number) => void;
  /** Số cụm đọc song song (mặc định SO_CUM_SONG_SONG). */
  songSong?: number;
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

/**
 * Hết hạn mức (429) hay quá tải (529/5xx): chờ 8 s, 25 s, 60 s — hạn mức theo
 * phút của gói miễn phí mở lại trong khoảng đó; đọc song song nhiều cụm dễ
 * chạm hạn mức hơn đọc một lượt.
 */
const CHO_THU_LAI_MAC_DINH = [8000, 25000, 60000];
/** Một lần gọi (một cụm trang, một lượt) được phép kéo dài tới 12 phút... */
export const TONG_MS_MAC_DINH = 12 * 60_000;
/** ...nhưng AI im lặng quá 150 giây thì coi là treo. */
export const IM_LANG_MS_MAC_DINH = 150_000;
/** Đọc song song tối đa 3 cụm trang một lúc. */
export const SO_CUM_SONG_SONG = 3;

function moTaNguyenNhan(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
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

// ─── Nhận kết quả THEO LUỒNG (Server-Sent Events) ───────────────────────────
//
// Trước đây mỗi lần gọi chờ AI viết XONG cả bảng rồi mới nhận, trần 180 giây:
// phiếu 300+ dòng AI viết mất vài phút nên lần nào cũng bị ngắt ("quá 180 giây
// không có trả lời") dù AI vẫn đang làm việc. Nay nhận từng mẩu ngay khi AI
// viết; chỉ ngắt khi AI IM LẶNG quá lâu, còn tổng thời gian cho phép dài.

/** Lỗi do nhà cung cấp gửi GIỮA luồng (VD quá tải) — thử lại được. */
export class LoiLuong extends Error {}

/** Đọc thân phản hồi SSE thành danh sách đối tượng JSON ở các dòng "data:". Mỗi mẩu nhận được gọi giuSong(). */
async function docSuKien(res: Response, giuSong: () => void): Promise<unknown[]> {
  const ra: unknown[] = [];
  if (!res.body) return ra;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const xuLy = (dongTho: string) => {
    const d = dongTho.replace(/\r$/, "");
    if (!d.startsWith("data:")) return;
    const du = d.slice(5).trim();
    if (!du || du === "[DONE]") return;
    try {
      ra.push(JSON.parse(du));
    } catch {
      /* dòng hỏng: bỏ */
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    giuSong();
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      xuLy(buf.slice(0, i));
      buf = buf.slice(i + 1);
    }
  }
  buf += dec.decode();
  if (buf) xuLy(buf);
  return ra;
}

type SuKienClaude = {
  type?: string;
  message?: { usage?: { input_tokens?: number } };
  content_block?: { type?: string; name?: string };
  delta?: { type?: string; partial_json?: string; stop_reason?: string };
  usage?: { output_tokens?: number };
  error?: { type?: string; message?: string };
};

/** Gộp luồng Messages API của Claude thành đúng dạng phản hồi thường (content / stop_reason / usage). */
export function gomLuongClaude(su: unknown[]): unknown {
  let vao = 0;
  let ra = 0;
  let stop: string | undefined;
  let ten: string | undefined;
  let json = "";
  for (const x of su as SuKienClaude[]) {
    if (x.type === "error") throw new LoiLuong(`Claude API (luồng) ${x.error?.type ?? ""}: ${x.error?.message ?? ""}`.trim());
    if (x.type === "message_start") vao = x.message?.usage?.input_tokens ?? vao;
    if (x.type === "content_block_start" && x.content_block?.type === "tool_use") ten = x.content_block.name;
    if (x.type === "content_block_delta" && x.delta?.type === "input_json_delta") json += x.delta.partial_json ?? "";
    if (x.type === "message_delta") {
      stop = x.delta?.stop_reason ?? stop;
      ra = x.usage?.output_tokens ?? ra;
    }
  }
  let input: unknown = undefined;
  try {
    input = json ? JSON.parse(json) : undefined;
  } catch {
    input = undefined; // bị cắt dở (max_tokens)
  }
  return {
    content: ten && input !== undefined ? [{ type: "tool_use", name: ten, input }] : [],
    stop_reason: stop,
    usage: { input_tokens: vao, output_tokens: ra },
  };
}

type SuKienGemini = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { status?: string; message?: string };
};

/** Gộp luồng streamGenerateContent của Gemini thành một phản hồi generateContent. */
export function gomLuongGemini(su: unknown[]): unknown {
  let text = "";
  let finish: string | undefined;
  let usage: SuKienGemini["usageMetadata"];
  let fb: SuKienGemini["promptFeedback"];
  for (const x of su as SuKienGemini[]) {
    if (x.error) throw new LoiLuong(`Gemini API (luồng) ${x.error.status ?? ""}: ${x.error.message ?? ""}`.trim());
    const c = x.candidates?.[0];
    for (const p of c?.content?.parts ?? []) if (!p.thought) text += p.text ?? "";
    if (c?.finishReason) finish = c.finishReason;
    if (x.usageMetadata) usage = x.usageMetadata;
    if (x.promptFeedback) fb = x.promptFeedback;
  }
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: finish }], usageMetadata: usage, promptFeedback: fb };
}

type SuKienDeepseek = {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { type?: string; message?: string };
};

/** Gộp luồng chat/completions (DeepSeek, OpenAI-compatible) thành một phản hồi thường. */
export function gomLuongDeepseek(su: unknown[]): unknown {
  let content = "";
  let finish: string | undefined;
  let usage: SuKienDeepseek["usage"];
  for (const x of su as SuKienDeepseek[]) {
    if (x.error) throw new LoiLuong(`DeepSeek API (luồng) ${x.error.type ?? ""}: ${x.error.message ?? ""}`.trim());
    const c = x.choices?.[0];
    content += c?.delta?.content ?? "";
    if (c?.finish_reason) finish = c.finish_reason;
    if (x.usage) usage = x.usage;
  }
  return { choices: [{ message: { content }, finish_reason: finish }], usage };
}

type KetQuaGoi = { ok: true; json: unknown } | { ok: false; loi: string; status?: number };
type ThoiGian = { tongMs: number; imLangMs: number; choThuLaiMs?: number[] };

/**
 * Gọi có thử lại: 429 (hết hạn mức) / 529 / 5xx → thử tiếp theo choThuLaiMs;
 * mất mạng / AI im lặng quá lâu / lỗi giữa luồng → thử lại một lần. Lỗi 4xx
 * khác trả ngay kèm mã để nơi gọi đổi cách gọi (khuôn JSON, giới hạn token).
 *
 * Phản hồi dạng luồng (text/event-stream) được gomLuong gộp về đúng dạng phản
 * hồi thường, nên phần bóc kết quả phía sau không cần biết là luồng hay không.
 */
async function goiCoThuLai(
  fetchFn: FetchGia,
  url: string,
  init: RequestInit,
  tg: ThoiGian,
  moTaLoi: (status: number, json: unknown) => string,
  gomLuong?: (su: unknown[]) => unknown
): Promise<KetQuaGoi> {
  const cho = tg.choThuLaiMs ?? CHO_THU_LAI_MAC_DINH;
  let loiCuoi = "";
  let statusCuoi: number | undefined;
  for (let lan = 0; lan <= cho.length; lan++) {
    if (lan > 0) await new Promise((r) => setTimeout(r, cho[lan - 1]));
    const ac = new AbortController();
    const ngat = { lyDo: "" };
    let henImLang: ReturnType<typeof setTimeout> | undefined;
    const giuSong = () => {
      clearTimeout(henImLang);
      henImLang = setTimeout(() => {
        ngat.lyDo = `AI im lặng quá ${Math.round(tg.imLangMs / 1000)} giây`;
        ac.abort();
      }, tg.imLangMs);
    };
    const henTong = setTimeout(() => {
      ngat.lyDo = `quá ${tg.tongMs >= 120_000 ? `${Math.round(tg.tongMs / 60_000)} phút` : `${Math.round(tg.tongMs / 1000)} giây`} chưa xong`;
      ac.abort();
    }, tg.tongMs);
    giuSong();
    try {
      const res = await fetchFn(url, { ...init, signal: ac.signal });
      giuSong();
      const laLuong = (res.headers.get("content-type") ?? "").includes("text/event-stream");
      if (res.ok) {
        const json = laLuong && gomLuong ? gomLuong(await docSuKien(res, giuSong)) : await res.json().catch(() => null);
        return { ok: true, json };
      }
      const jsonLoi = await res.json().catch(() => null);
      loiCuoi = moTaLoi(res.status, jsonLoi);
      statusCuoi = res.status;
      if (res.status === 429 || res.status >= 500) continue;
      return { ok: false, loi: loiCuoi, status: res.status };
    } catch (e) {
      loiCuoi = (e instanceof LoiLuong ? e.message : `Không gọi được API (${ngat.lyDo || moTaNguyenNhan(e)})`).slice(0, 300);
      statusCuoi = undefined;
      if (lan < 1) continue;
      return { ok: false, loi: loiCuoi };
    } finally {
      clearTimeout(henImLang);
      clearTimeout(henTong);
    }
  }
  return { ok: false, loi: loiCuoi || "Không rõ lỗi.", status: statusCuoi };
}

type KetQuaTho = { ok: true; input: unknown; tokenVao: number; tokenRa: number } | { ok: false; loi: string };

async function goiClaude(pdf: Buffer, ch: CauHinhAi, tc: TuyChonDocAi, text: string, fetchFn: FetchGia, tg: ThoiGian): Promise<KetQuaTho> {
  const body = (maxTokens: number) =>
    JSON.stringify({
      model: ch.model,
      max_tokens: maxTokens,
      stream: true,
      system: banDocCua(tc).huongDan,
      tools: [banDocCua(tc).congCu],
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
      tg,
      moTaLoiClaude,
      gomLuongClaude
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

async function goiGemini(pdf: Buffer, ch: CauHinhAi, tc: TuyChonDocAi, text: string, fetchFn: FetchGia, tg: ThoiGian): Promise<KetQuaTho> {
  if (pdf.length > GEMINI_PDF_TOI_DA) {
    return { ok: false, loi: `PDF ${Math.round(pdf.length / 1024 / 1024)} MB quá lớn cho Gemini (tối đa 14 MB) — nén bản scan hoặc dùng Claude.` };
  }
  // Ba mức: đủ đồ (khuôn + độ phân giải cao + ngân sách suy nghĩ) → chỉ khuôn → chỉ JSON.
  const body = (muc: 0 | 1 | 2) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: banDocCua(tc).huongDan }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
            { text: `${text}${tc.fileName ? ` (tệp: ${tc.fileName.slice(0, 200)})` : ""}\n${banDocCua(tc).khuonJson}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        ...(muc <= 1 ? { responseSchema: schemaGemini(banDocCua(tc).congCu.input_schema) } : {}),
        // Bản scan chữ nhỏ: độ phân giải cao đọc số rõ hơn. Ngân sách "suy nghĩ"
        // cố định 4096 token: dòng flash mặc định không suy nghĩ (cấp để đối
        // chiếu cột kỹ hơn), dòng pro mặc định suy nghĩ không giới hạn — trong
        // lúc suy nghĩ AI im lặng, nên phải có trần để không bị coi là treo.
        ...(muc === 0 ? { mediaResolution: "MEDIA_RESOLUTION_HIGH", thinkingConfig: { thinkingBudget: 4096 } } : {}),
      },
    });
  const url = `${DIA_CHI_GEMINI}/models/${encodeURIComponent(ch.model)}:streamGenerateContent?alt=sse`;
  const goi = (muc: 0 | 1 | 2) =>
    goiCoThuLai(
      fetchFn,
      url,
      { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": ch.apiKey }, body: body(muc) },
      tg,
      moTaLoiGemini,
      gomLuongGemini
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
  const input = bocJson(textRa);
  if (input === null) {
    return {
      ok: false,
      loi:
        ung?.finishReason === "MAX_TOKENS"
          ? "AI trả về JSON bị cắt dở (quá giới hạn đầu ra) — cụm trang quá dài."
          : `AI trả về JSON hỏng (finishReason: ${ung?.finishReason ?? "?"}).`,
    };
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
async function goiDeepseek(ch: CauHinhAi, tc: TuyChonDocAi, text: string, pham: [number, number] | null, fetchFn: FetchGia, tg: ThoiGian): Promise<KetQuaTho> {
  const chu = (tc.chuPdf ?? "").trim();
  if (chu.length < 10) return { ok: false, loi: LOI_DEEPSEEK_KHONG_CHU };
  const chuCum = catTrang(chu, pham);
  const laReasoner = /reason/i.test(ch.model);
  const body = JSON.stringify({
    model: ch.model,
    temperature: 0,
    max_tokens: 8192,
    stream: true,
    stream_options: { include_usage: true },
    ...(laReasoner ? {} : { response_format: { type: "json_object" } }),
    messages: [
      { role: "system", content: `${banDocCua(tc).huongDan}\n\nĐầu vào là CHỮ đã tách từ PDF (không có ảnh): mỗi trang mở đầu bằng "--- trang N ---", các cột của bảng cách nhau bằng " | ". ${banDocCua(tc).khuonJson}` },
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
    tg,
    moTaLoiDeepseek,
    gomLuongDeepseek
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
export function loiNhac(pham: [number, number] | null, luot1: DongAi[] | null, banDoc: BanDocAi = "phieuGiao"): string {
  const bd = BAN_DOC[banDoc];
  let s: string = bd.loiNhac;
  if (pham) {
    s += `\nCHỈ đọc các trang ${pham[0]} đến ${pham[1]} (đánh số từ 1) của tài liệu; bỏ hẳn các trang khác.${
      pham[0] > 1 ? " Thông tin đầu phiếu (nhà cung cấp, số phiếu, ngày, tàu) để null." : ""
    }`;
  }
  if (luot1) {
    // Báo cáo chằng buộc: gửi lại đúng các cột số của mẫu (không có số lượng / đơn vị / loại).
    const gon = luot1.map((d) =>
      d.cb
        ? { ten: d.ten, partNo: d.partNo, ...d.cb, trang: d.trang }
        : d.bc
          ? { ten: d.ten, donVi: d.donVi || null, ...d.bc, trang: d.trang }
          : {
            ten: d.ten,
            tenEn: d.tenEn,
            partNo: d.partNo,
            impa: d.impa,
            soLuong: d.soLuong,
            donVi: d.donVi,
            loai: d.loai,
            thietBi: d.thietBi,
            trang: d.trang,
            ...(d.donGia !== undefined ? { donGia: d.donGia } : {}),
            ...(d.ton !== undefined ? { ton: d.ton } : {}),
            ...(d.hangMuc ? { hangMuc: d.hangMuc } : {}),
          }
    );
    s +=
      `\n\nĐây là bảng đã đọc ở LƯỢT 1 (JSON). Hãy ĐỐI CHIẾU LẠI TỪNG DÒNG với tài liệu: sửa chỗ đọc sai (số lượng, đơn vị, mã IMPA / Part No., tên), thêm dòng bị sót, xóa dòng không có trên ${bd.taiLieu}, giữ nguyên dòng đã đúng. Chú ý số hay lẫn (0/6/8, 1/7, 3/8) và dòng ở mép trang. Trả về bảng ĐẦY ĐỦ đã sửa (không chỉ phần sửa), cùng cấu trúc, cùng thứ tự trên phiếu.\nLƯỢT 1:\n` +
      JSON.stringify(gon);
  }
  return s;
}

/** Chạy fn cho từng phần tử, tối đa n việc cùng lúc; kết quả giữ đúng thứ tự đầu vào. */
export async function chayGioiHan<T, R>(ds: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const ra = new Array<R>(ds.length);
  let tiep = 0;
  const tho = async () => {
    while (tiep < ds.length) {
      const i = tiep++;
      ra[i] = await fn(ds[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, ds.length)) }, tho));
  return ra;
}

type KetQuaCum =
  | { ok: true; chuan: DauPhieu & { dong: DongAi[] }; vao: number; ra: number; luot: number; loiPhu: string[] }
  | { ok: false; loi: string; tenPham: string; luot: number };

/**
 * Đọc phiếu bằng cấu hình đã giải (null = chưa cấu hình → ok:false, không gọi
 * mạng). Chế độ "ky" (mặc định) đọc hai lượt; phiếu dài hơn 2 trang đọc theo
 * cụm 2 trang, tối đa 3 cụm song song. Cụm nào hỏng thì các cụm khác vẫn giữ
 * kết quả, phần hỏng được nêu trong `canhBaoChung` để người duyệt đọc lại /
 * gõ tay đúng các trang đó.
 */
export async function docPhieuGiaoBangAi(pdf: Buffer, cauHinh: CauHinhAi | null, tuyChon: TuyChonDocAi = {}): Promise<KetQuaDocAi> {
  if (!cauHinh || !cauHinh.apiKey.trim()) return { ok: false, loi: "Chưa cấu hình bộ đọc AI." };
  const fetchFn = tuyChon.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const tg: ThoiGian = {
    tongMs: tuyChon.timeoutMs ?? TONG_MS_MAC_DINH,
    imLangMs: tuyChon.imLangMs ?? IM_LANG_MS_MAC_DINH,
    choThuLaiMs: tuyChon.choThuLaiMs,
  };
  const ch: CauHinhAi = { ...cauHinh, apiKey: cauHinh.apiKey.trim(), model: cauHinh.model.trim() || MODEL_MAC_DINH[cauHinh.nhaCungCap] };
  const cheDo: CheDoDocAi = ch.cheDo ?? "ky";
  const goi = (text: string, pham: [number, number] | null) =>
    ch.nhaCungCap === "deepseek"
      ? goiDeepseek(ch, tuyChon, text, pham, fetchFn, tg)
      : ch.nhaCungCap === "gemini"
        ? goiGemini(pdf, ch, tuyChon, text, fetchFn, tg)
        : goiClaude(pdf, ch, tuyChon, text, fetchFn, tg);

  // DeepSeek chỉ có chữ: chặn sớm, và chia theo cụm riêng vì đầu ra giới hạn 8K token.
  if (ch.nhaCungCap === "deepseek" && (tuyChon.chuPdf ?? "").trim().length < 10) return { ok: false, loi: LOI_DEEPSEEK_KHONG_CHU };
  const cac =
    ch.nhaCungCap === "deepseek"
      ? chiaTrang(tuyChon.soTrang ?? demTrangTuChu(tuyChon.chuPdf), DEEPSEEK_TRANG_MOI_CUM, DEEPSEEK_TRANG_MOI_CUM)
      : chiaTrang(tuyChon.soTrang ?? null);
  const luotMoiCum = cheDo === "ky" ? 2 : 1;
  const tongLuot = cac.length * luotMoiCum;
  let xong = 0;
  const baoTienDo = (n: number) => {
    xong += n;
    try {
      tuyChon.onTienDo?.(xong, tongLuot);
    } catch {
      /* báo tiến độ hỏng không được làm hỏng việc đọc */
    }
  };

  const ketQua = await chayGioiHan(cac, tuyChon.songSong ?? SO_CUM_SONG_SONG, async (pham): Promise<KetQuaCum> => {
    const tenPham = pham ? `trang ${pham[0]}–${pham[1]}` : "cả phiếu";
    const r1 = await goi(loiNhac(pham, null, tuyChon.banDoc), pham);
    if (!r1.ok) {
      baoTienDo(luotMoiCum);
      return { ok: false, loi: r1.loi, tenPham, luot: 1 };
    }
    baoTienDo(1);
    let chuan = chuanHoaKetQuaAi(r1.input);
    let vao = r1.tokenVao;
    let ra = r1.tokenRa;
    const loiPhu: string[] = [];
    if (cheDo === "ky") {
      const r2 = await goi(loiNhac(pham, chuan.dong, tuyChon.banDoc), pham);
      baoTienDo(1);
      if (r2.ok) {
        vao += r2.tokenVao;
        ra += r2.tokenRa;
        const c2 = chuanHoaKetQuaAi(r2.input);
        chuan = {
          ...c2,
          nhaCungCap: c2.nhaCungCap ?? chuan.nhaCungCap,
          soPhieu: c2.soPhieu ?? chuan.soPhieu,
          ngayGiao: c2.ngayGiao ?? chuan.ngayGiao,
          tau: c2.tau ?? chuan.tau,
          tienTe: c2.tienTe ?? chuan.tienTe,
          cang: c2.cang ?? chuan.cang,
          yc: c2.yc ?? chuan.yc,
          quy: c2.quy ?? chuan.quy,
          nam: c2.nam ?? chuan.nam,
          kyBaoCao: c2.kyBaoCao ?? chuan.kyBaoCao,
          dong: gopLuot(chuan.dong, c2.dong),
        };
      } else {
        loiPhu.push(`Lượt kiểm lại (${tenPham}) không chạy được, dùng lượt 1: ${r2.loi}`);
      }
    }
    return { ok: true, chuan, vao, ra, luot: luotMoiCum, loiPhu };
  });

  const hong = ketQua.filter((k): k is Extract<KetQuaCum, { ok: false }> => !k.ok);
  if (hong.length === ketQua.length) {
    const dau = hong[0];
    return { ok: false, loi: cac.length > 1 ? `${dau.loi} (${dau.tenPham})` : dau.loi };
  }
  let tokenVao = 0;
  let tokenRa = 0;
  let soLuotGoi = 0;
  const loiPhu: string[] = [];
  const dau: DauPhieu = { nhaCungCap: null, soPhieu: null, ngayGiao: null, tau: null };
  const dongTatCa: DongAi[] = [];
  for (const k of ketQua) {
    soLuotGoi += k.luot;
    if (!k.ok) continue;
    tokenVao += k.vao;
    tokenRa += k.ra;
    loiPhu.push(...k.loiPhu);
    dau.nhaCungCap ??= k.chuan.nhaCungCap;
    dau.soPhieu ??= k.chuan.soPhieu;
    dau.ngayGiao ??= k.chuan.ngayGiao;
    dau.tau ??= k.chuan.tau;
    dau.tienTe ??= k.chuan.tienTe;
    dau.cang ??= k.chuan.cang;
    dau.yc ??= k.chuan.yc;
    dau.quy ??= k.chuan.quy;
    dau.nam ??= k.chuan.nam;
    dau.kyBaoCao ??= k.chuan.kyBaoCao;
    dongTatCa.push(...k.chuan.dong);
  }
  const canhBaoChung = hong.length
    ? `Không đọc được ${hong.map((h) => h.tenPham).join(", ")} (${hong[0].loi}). Bấm "Đọc lại bằng AI" hoặc gõ tay các dòng của phần này.`
    : null;
  if (canhBaoChung) loiPhu.push(canhBaoChung);
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
    canhBaoChung,
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
  const tg: ThoiGian = { tongMs: tuyChon.timeoutMs ?? 30_000, imLangMs: tuyChon.timeoutMs ?? 30_000, choThuLaiMs: tuyChon.choThuLaiMs ?? [3000] };
  const apiKey = cauHinh.apiKey.trim();
  if (!apiKey) return { ok: false, loi: "Chưa có khóa API." };
  let models: string[] = [];
  if (cauHinh.nhaCungCap === "deepseek") {
    const r = await goiCoThuLai(fetchFn, `${DIA_CHI_DEEPSEEK}/models`, { method: "GET", headers: { authorization: `Bearer ${apiKey}` } }, tg, moTaLoiDeepseek);
    if (!r.ok) return r;
    const json = r.json as { data?: { id?: string }[] } | null;
    models = (json?.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
  } else if (cauHinh.nhaCungCap === "gemini") {
    const r = await goiCoThuLai(fetchFn, `${DIA_CHI_GEMINI}/models?pageSize=200`, { method: "GET", headers: { "x-goog-api-key": apiKey } }, tg, moTaLoiGemini);
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
      tg,
      moTaLoiClaude
    );
    if (!r.ok) return r;
    const json = r.json as { data?: { id?: string }[] } | null;
    models = (json?.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
  }
  models.sort();
  const model = cauHinh.model.trim() || MODEL_MAC_DINH[cauHinh.nhaCungCap];
  return { ok: true, models, coModel: models.includes(model) };
}
