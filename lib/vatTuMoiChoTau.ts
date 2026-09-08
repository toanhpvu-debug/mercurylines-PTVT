import {
  BO_PHAN,
  CHUC_DANH,
  chucDanhThuocBoPhan,
  type BoPhan,
} from "@/lib/maVatTu";

/**
 * Khai một mặt hàng MỚI — chưa có trong danh mục gốc — ngay tại danh mục của
 * một tàu, gắn luôn với CHỨC DANH sẽ giữ nó.
 *
 * Vì sao cần: tàu phát hiện một phụ tùng / vật tư không có trong danh mục gốc
 * (máy mới lắp, hãng đổi mẫu, vật tư đặc thù của tàu). Trước đây phải nhờ quản
 * trị tạo trong danh mục gốc rồi quay lại thêm vào tàu — hai người, hai bước,
 * và trong lúc chờ thì không nhập tồn, không lập yêu cầu được. Nay chỉ huy của
 * chính tàu đó (thuyền trưởng / đại phó / máy trưởng) khai một lần là xong.
 *
 * Mặt hàng khai ở đây vẫn là MỘT định nghĩa trong danh mục gốc (Material) —
 * danh mục gốc là "từ điển" của cả đội, không có khái niệm vật tư chỉ tồn tại
 * trên một tàu — nhưng chỉ được GẮN vào tàu đang khai (VesselMaterial). Tàu
 * khác muốn dùng thì thêm từ danh mục gốc như bình thường.
 *
 * Phần THUẦN (kiểm tra dữ liệu khai, phát hiện trùng) nằm ở file này để chạy
 * được trong script kiểm thử; phần ghi database ở app/actions.ts.
 */

export type KhaiMoi = {
  /** Chức danh giữ và kiểm kê — ghi vào Material.responsibleRank. */
  rankCode: string;
  /** Bộ phận của mặt hàng — quyết định chữ cái đầu của mã và cột department. */
  boPhan: BoPhan;
  materialType: "STORE" | "SPARE";
  nameVn: string;
  nameEn: string | null;
  equipment: string | null;
  impa: string | null;
  partNumber: string | null;
  manufacturer: string | null;
  uom: string;
  categoryId: number | null;
  minStock: number;
  isCritical: boolean;
};

/**
 * Bộ phận mà một chức danh được giữ hàng: bộ phận chính trước, kiêm nhiệm sau.
 *
 * Máy hai giữ hàng Máy, nhưng cũng giữ được hàng Điện (kiêm nhiệm); thuyền
 * trưởng giữ hàng Boong và Phục vụ. Form dùng danh sách này để ô "Bộ phận" chỉ
 * mở ra những lựa chọn hợp lý với chức danh đã chọn.
 */
export function boPhanCuaChucDanh(rankCode: string): BoPhan[] {
  const cd = CHUC_DANH[rankCode];
  if (!cd) return [];
  return [cd.boPhan, ...(cd.kiemNhiem ?? [])];
}

/** Gọn chuỗi nhập tay: bỏ khoảng trắng thừa, chuẩn Unicode NFC. */
export function gon(s: unknown): string {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Đọc và kiểm tra dữ liệu form. Trả về lỗi ĐẦU TIÊN gặp, viết cho người vận
 * hành đọc (nói rõ phải làm gì), không phải cho lập trình viên.
 */
export function docKhaiMoi(
  form: Record<string, string | undefined>
): { ok: true; gt: KhaiMoi } | { ok: false; loi: string } {
  const rankCode = gon(form.rankCode).toUpperCase();
  if (!rankCode) {
    return { ok: false, loi: "Chọn chức danh sẽ giữ mặt hàng này." };
  }
  const cd = CHUC_DANH[rankCode];
  if (!cd) {
    return { ok: false, loi: `Chức danh "${rankCode}" không có trong quy ước.` };
  }

  const boPhanRaw = gon(form.boPhan).toUpperCase();
  const boPhan = (boPhanRaw || cd.boPhan) as BoPhan;
  if (!BO_PHAN[boPhan]) {
    return {
      ok: false,
      loi: `Bộ phận "${boPhanRaw}" không có trong quy ước (D · E · L · C).`,
    };
  }
  // Chức danh và bộ phận phải khớp nhau: mã E-SPR mà người giữ là thủy thủ
  // trưởng thì lúc kiểm kê không ai nhận món hàng đó.
  if (!chucDanhThuocBoPhan(rankCode, boPhan)) {
    const duoc = boPhanCuaChucDanh(rankCode)
      .map((b) => BO_PHAN[b].ten)
      .join(" hoặc ");
    return {
      ok: false,
      loi: `${cd.ten} (${rankCode}) không giữ hàng của bộ phận ${BO_PHAN[boPhan].ten} — chọn bộ phận ${duoc}, hoặc đổi chức danh.`,
    };
  }

  const materialType =
    gon(form.materialType).toUpperCase() === "SPARE" ? "SPARE" : "STORE";
  const nameVn = gon(form.nameVn);
  if (!nameVn) {
    return { ok: false, loi: "Ghi tên mặt hàng (tiếng Việt)." };
  }
  const equipment = gon(form.equipment) || null;
  if (materialType === "SPARE" && !equipment) {
    return {
      ok: false,
      loi: "Phụ tùng phải ghi thiết bị / máy — để gom đúng cụm máy và người kiểm kê biết nó lắp ở đâu.",
    };
  }

  const uom = (gon(form.uom) || "PCS").toUpperCase();
  const minStockRaw = gon(form.minStock);
  const minStock = minStockRaw === "" ? 0 : Number(minStockRaw);
  if (!Number.isFinite(minStock) || minStock < 0) {
    return { ok: false, loi: "Tồn tối thiểu phải là số không âm." };
  }
  const categoryRaw = gon(form.categoryId);
  const categoryId = categoryRaw ? Number(categoryRaw) : null;
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) {
    return { ok: false, loi: "Nhóm thiết bị không hợp lệ." };
  }

  return {
    ok: true,
    gt: {
      rankCode,
      boPhan,
      materialType,
      nameVn,
      nameEn: gon(form.nameEn) || null,
      // Thiết bị chỉ có nghĩa với phụ tùng (cùng quy tắc với createMaterial).
      equipment: materialType === "SPARE" ? equipment : null,
      impa: gon(form.impa) || null,
      partNumber: gon(form.partNumber) || null,
      manufacturer: gon(form.manufacturer) || null,
      uom,
      categoryId,
      minStock,
      isCritical: form.isCritical === "on" || form.isCritical === "true",
    },
  };
}

/** Mặt hàng đã có trong danh mục gốc — chỉ những cột dùng để so trùng. */
export type MonDaCo = {
  code: string;
  nameVn: string;
  equipment: string | null;
  impa: string | null;
  partNumber: string | null;
  manufacturer: string | null;
  isActive: boolean;
};

export type LyDoTrung = "impa" | "part-no" | "ten";

const soSanh = (s: string | null | undefined) => gon(s).toLowerCase();

/**
 * Mặt hàng khai mới có trùng với thứ đã có trong danh mục gốc không.
 *
 * Cùng ba tiêu chí với bước nhập file (lib/materialImportApply.ts) để hai cửa
 * vào danh mục không nói khác nhau về "thế nào là trùng":
 *   1. cùng mã IMPA;
 *   2. cùng Part No.;
 *   3. cùng tên + cùng thiết bị ("Bạc trục" của Máy chính và của Máy đèn là
 *      hai phụ tùng khác nhau, nên tên giống mà thiết bị khác thì không trùng).
 *
 * Trùng thì KHÔNG tạo bản thứ hai: người khai được chỉ sang ô "chọn từ danh
 * mục gốc" với đúng mã sẵn có. Hai định nghĩa cho một món hàng là hai dòng tồn,
 * hai lịch sử — thứ không gộp lại được sau này.
 */
export function timTrung(
  khai: Pick<KhaiMoi, "nameVn" | "equipment" | "impa" | "partNumber">,
  daCo: readonly MonDaCo[]
): { mon: MonDaCo; theo: LyDoTrung } | null {
  const impa = soSanh(khai.impa);
  const partNo = soSanh(khai.partNumber);
  const ten = `${soSanh(khai.nameVn)}|${soSanh(khai.equipment)}`;
  let theoTen: MonDaCo | null = null;
  for (const m of daCo) {
    if (impa && soSanh(m.impa) === impa) return { mon: m, theo: "impa" };
    if (partNo && soSanh(m.partNumber) === partNo) {
      return { mon: m, theo: "part-no" };
    }
    if (!theoTen && `${soSanh(m.nameVn)}|${soSanh(m.equipment)}` === ten) {
      theoTen = m;
    }
  }
  return theoTen ? { mon: theoTen, theo: "ten" } : null;
}

/** Câu chữ cho người dùng khi phát hiện trùng. */
export function loiTrung(t: { mon: MonDaCo; theo: LyDoTrung }): string {
  const viSao =
    t.theo === "impa"
      ? "trùng mã IMPA"
      : t.theo === "part-no"
        ? "trùng Part No."
        : "trùng tên + thiết bị";
  const dau = `Đã có trong danh mục gốc: ${t.mon.code} — ${t.mon.nameVn} (${viSao}).`;
  return t.mon.isActive
    ? `${dau} Dùng ô "Chọn vật tư từ danh mục gốc" phía trên để thêm vào tàu, không tạo bản trùng.`
    : `${dau} Mặt hàng này đang ở trạng thái Ngừng dùng — nhờ quản trị viên bật lại rồi thêm vào tàu.`;
}
