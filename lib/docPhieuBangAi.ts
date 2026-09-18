/**
 * Bộ đọc AI cho phiếu giao hàng: gửi thẳng file PDF (kể cả bản scan nhiều
 * trang) cho Claude qua Messages API và nhận về BẢNG DÒNG HÀNG có cấu trúc.
 *
 * Vì sao dùng AI thay cho OCR thường: OCR chỉ trả về chữ rời, còn phải đoán
 * cột nào là số lượng, cột nào là IMPA; bản scan nghiêng, mờ, bảng nhiều trang
 * thì đoán sai nhiều. Mô hình nhìn cả trang như người đọc: hiểu tiêu đề cột,
 * nhóm thiết bị, dòng gạch bỏ. Và nó chạy ở mọi nơi — kể cả container Linux
 * của máy chủ, nơi không có Windows.Media.Ocr.
 *
 * Kết quả vẫn chỉ là ĐIỀN SẴN: người duyệt đối chiếu với bản scan rồi mới
 * duyệt (xem app/phieu-giao-actions.ts). Cấu hình bằng biến môi trường
 * ANTHROPIC_API_KEY (bắt buộc) và PHIEU_GIAO_AI_MODEL (tùy chọn). Khóa không
 * bao giờ được ghi log hay trả về giao diện.
 *
 * Ép mô hình trả JSON đúng cấu trúc bằng "công cụ" (tool_choice bắt buộc):
 * không phải bóc JSON từ văn xuôi, không có chuyện thiếu ngoặc.
 */
import { chuanDonVi, type DongPhieuGiao } from "@/lib/phieuGiaoParse";

export const AI_MODEL_MAC_DINH = "claude-sonnet-5";
export const AI_DIA_CHI = "https://api.anthropic.com/v1/messages";
/** Messages API nhận PDF tới 100 trang / 32 MB; app đã giới hạn 20 MB ở lúc tải. */
export const AI_SO_TRANG_TOI_DA = 100;

export function aiDaCauHinh(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function tenModelAi(): string {
  return process.env.PHIEU_GIAO_AI_MODEL?.trim() || AI_MODEL_MAC_DINH;
}

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

export const HUONG_DAN_HE_THONG = `Bạn là nhân viên nhập liệu kho của tàu biển. Nhiệm vụ: đọc phiếu giao hàng (delivery note / packing list / invoice kèm hàng) của nhà cung cấp — có thể là bản scan nghiêng, mờ, nhiều trang, tiếng Anh hoặc tiếng Việt — rồi ghi lại bằng công cụ ghi_phieu_giao.

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
 * OCR) — thuần chuỗi, kiểm ở scripts/kiem-tra-doc-ai.ts. Mô hình đôi khi trả
 * số lượng dạng chuỗi, IMPA kèm chữ "IMPA", đơn vị viết thường... nên chuẩn hóa
 * ở đây thay vì tin mù vào JSON.
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

type TuyChonDocAi = {
  fileName?: string;
  model?: string;
  timeoutMs?: number;
  /** Để kiểm thử thay fetch thật. */
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  apiKey?: string;
};

function moTaLoi(status: number, json: unknown): string {
  const e = (json as { error?: { type?: string; message?: string } } | null)?.error;
  const loai = e?.type ? ` ${e.type}` : "";
  const thong = e?.message ? `: ${e.message}` : "";
  return `Claude API ${status}${loai}${thong}`.slice(0, 300);
}

export async function docPhieuGiaoBangAi(pdf: Buffer, tuyChon: TuyChonDocAi = {}): Promise<KetQuaDocAi> {
  const apiKey = (tuyChon.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) return { ok: false, loi: "Chưa cấu hình ANTHROPIC_API_KEY." };
  const model = tuyChon.model ?? tenModelAi();
  const fetchFn = tuyChon.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const timeoutMs = tuyChon.timeoutMs ?? 180_000;

  const body = JSON.stringify({
    model,
    max_tokens: 32_000,
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
            title: tuyChon.fileName?.slice(0, 200) || "phieu-giao.pdf",
          },
          {
            type: "text",
            text: "Đọc phiếu giao hàng trong tài liệu đính kèm và ghi TOÀN BỘ dòng hàng bằng công cụ ghi_phieu_giao.",
          },
        ],
      },
    ],
  });

  let loiCuoi = "";
  for (let lan = 1; lan <= 2; lan++) {
    const ac = new AbortController();
    const dongHo = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchFn(AI_DIA_CHI, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
        signal: ac.signal,
      });
      const json = (await res.json().catch(() => null)) as
        | {
            content?: { type: string; name?: string; input?: unknown }[];
            stop_reason?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          }
        | null;
      if (!res.ok) {
        loiCuoi = moTaLoi(res.status, json);
        // 429 (hết hạn mức tạm thời), 529 (quá tải), 5xx: thử lại một lần.
        if ((res.status === 429 || res.status >= 500) && lan === 1) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return { ok: false, loi: loiCuoi };
      }
      const congCu = json?.content?.find((c) => c.type === "tool_use" && c.name === CONG_CU_GHI_PHIEU.name);
      if (!congCu) {
        return {
          ok: false,
          loi: `AI không trả về kết quả có cấu trúc (stop_reason: ${json?.stop_reason ?? "?"}).`,
        };
      }
      const chuan = chuanHoaKetQuaAi(congCu.input);
      return {
        ok: true,
        ...chuan,
        model,
        tokenVao: json?.usage?.input_tokens ?? 0,
        tokenRa: json?.usage?.output_tokens ?? 0,
      };
    } catch (e) {
      const thong = e instanceof Error ? (e.name === "AbortError" ? `quá ${Math.round(timeoutMs / 1000)} giây` : e.message) : String(e);
      loiCuoi = `Không gọi được Claude API (${thong})`.slice(0, 300);
      if (lan === 1) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
    } finally {
      clearTimeout(dongHo);
    }
  }
  return { ok: false, loi: loiCuoi || "Không rõ lỗi." };
}
