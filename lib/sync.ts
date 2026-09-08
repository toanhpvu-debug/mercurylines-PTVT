import "server-only";

/**
 * Đồng bộ giữa bản cài trên TÀU và bản cài ở VĂN PHÒNG.
 *
 * Mỗi tàu chạy một bản app + PostgreSQL riêng nên làm việc được khi mất mạng
 * hoàn toàn. Khi có mạng thì:
 *   - Tàu XUẤT phần dữ liệu của mình đã thay đổi → gói .json → gửi về văn phòng
 *   - Văn phòng NHẬP gói đó, và XUẤT lại danh mục dùng chung mới → tàu nhập về
 *
 * Vì sao chia được như vậy: 16 bảng nghiệp vụ đều gắn với MỘT tàu cụ thể (tồn
 * kho, giao dịch, yêu cầu, đơn mua, sơn, chằng buộc, dầu · dầu nhờn · hóa
 * chất...). Tàu A không bao giờ ghi vào dữ liệu tàu B, nên gộp lại gần như
 * không có xung đột.
 *
 * Danh mục dùng chung (vật tư, nhóm, sơn, mặt hàng dầu/hóa chất, nhà cung cấp,
 * biểu mẫu) chủ yếu do văn phòng quản lý, nhưng KHÔNG phải một chiều: đại phó
 * khai được loại sơn mới, máy trưởng khai được mặt hàng dầu mới ngay trên tàu.
 * Những dòng đó mang id thuộc dải của tàu nên phân biệt được với dòng của văn
 * phòng, và cũng đi lên trong gói của tàu. Không gửi lên thì tồn sơn/tồn dầu
 * trỏ tới một mặt hàng văn phòng không có — nhập vào là gãy khóa ngoại.
 */

export const PHIEN_BAN_GOI = 1;

/**
 * Bảng gắn với một tàu — tàu xuất lên văn phòng.
 * Thứ tự PHẢI tôn trọng khóa ngoại: cha trước, con sau.
 */
export const BANG_CUA_TAU = [
  { ten: "warehouse", moc: "updatedAt" },
  { ten: "vesselMaterial", moc: "createdAt" },
  { ten: "inventory", moc: "updatedAt" },
  { ten: "inventoryTransaction", moc: "createdAt" },
  { ten: "materialRequest", moc: "updatedAt" },
  { ten: "purchaseOrder", moc: "updatedAt" },
  { ten: "lashingGear", moc: "updatedAt" },
  { ten: "lashingReport", moc: "updatedAt" },
  { ten: "paintArea", moc: "updatedAt" },
  { ten: "paintStock", moc: "updatedAt" },
  { ten: "paintJob", moc: "updatedAt" },
  { ten: "paintTransaction", moc: "createdAt" },
  { ten: "consumableStock", moc: "updatedAt" },
  { ten: "consumableReceipt", moc: "updatedAt" },
  { ten: "consumableTransaction", moc: "createdAt" },
  { ten: "reportDocument", moc: "createdAt" },
] as const;

/**
 * Bảng con — không có vesselId, lấy theo bản ghi cha đã xuất.
 * `cha` là tên bảng cha trong danh sách trên, `khoa` là cột trỏ tới cha.
 */
export const BANG_CON = [
  { ten: "materialRequestItem", cha: "materialRequest", khoa: "requestId" },
  { ten: "materialRequestEvent", cha: "materialRequest", khoa: "requestId" },
  { ten: "purchaseOrderItem", cha: "purchaseOrder", khoa: "poId" },
  { ten: "lashingReportLine", cha: "lashingReport", khoa: "reportId" },
  { ten: "paintJobLine", cha: "paintJob", khoa: "jobId" },
  { ten: "paintSchemeLayer", cha: "paintArea", khoa: "areaId" },
] as const;

/**
 * Danh mục dùng chung toàn đội — văn phòng quản lý, tàu chỉ nhận về.
 * Thứ tự cũng theo khóa ngoại (Category trước Material vì Material.categoryId).
 */
export const BANG_DUNG_CHUNG = [
  { ten: "category", moc: "updatedAt" },
  { ten: "material", moc: "updatedAt" },
  { ten: "supplier", moc: "updatedAt" },
  { ten: "formStandard", moc: "updatedAt" },
  { ten: "paintProduct", moc: "updatedAt" },
  { ten: "consumableProduct", moc: "updatedAt" },
] as const;

export type GoiDongBo = {
  phienBan: number;
  /** "TAU_LEN_VAN_PHONG" hoặc "VAN_PHONG_VE_TAU" */
  huong: "TAU_LEN_VAN_PHONG" | "VAN_PHONG_VE_TAU";
  vesselCode: string | null;
  /** Chỉ lấy bản ghi thay đổi SAU mốc này. null = lấy tất cả (lần đầu). */
  tuMoc: string | null;
  taoLuc: string;
  /** Tên bảng → mảng bản ghi. */
  duLieu: Record<string, unknown[]>;
  soBanGhi: number;
};

/**
 * Dải id dành riêng cho từng bản cài, để hai tàu cùng tạo bản ghi mới không
 * đụng id nhau khi gộp về văn phòng.
 *
 * Văn phòng giữ dải 1 → 999.999 (dữ liệu sẵn có). Mỗi tàu một triệu:
 *   MLS-001 → 1.000.000   MLS-002 → 2.000.000   ...
 *
 * Cách này đơn giản và chắc chắn hơn việc đánh lại id khi nhập rồi phải sửa
 * toàn bộ khóa ngoại theo.
 */
export function daiIdChoTau(vesselCode: string): number {
  const so = Number(vesselCode.replace(/\D/g, ""));
  if (!Number.isFinite(so) || so <= 0) {
    throw new Error(
      `Mã tàu "${vesselCode}" không có phần số nên không tính được dải id.`
    );
  }
  return so * 1_000_000;
}

export const DO_RONG_DAI = 1_000_000;

/**
 * Dải id của bản cài này: [dau, cuoi). Văn phòng (dauDai = 0) giữ 1 → 999.999.
 *
 * Dùng để tách "dòng do chính bản cài này tạo" khỏi "dòng nhận từ nơi khác" —
 * tàu chỉ gửi lên danh mục do chính mình tạo, không bao giờ gửi ngược bản ghi
 * của văn phòng.
 */
export function khoangIdRieng(dauDai: number): { dau: number; cuoi: number } {
  return dauDai > 0
    ? { dau: dauDai, cuoi: dauDai + DO_RONG_DAI }
    : { dau: 1, cuoi: DO_RONG_DAI };
}

/**
 * Bảng CỐ Ý không nằm trong gói đồng bộ — bài kiểm tra kiem-tra-dong-bo.cmd
 * đối chiếu danh sách này để một module mới thêm vào schema không thể bị bỏ
 * quên trong lúc đồng bộ.
 *
 * - User, Vessel: khai báo một lần lúc cài, mỗi bản cài tự quản. Đồng bộ tài
 *   khoản là đồng bộ cả mật khẩu băm và quyền — rủi ro không tương xứng với
 *   lợi ích, trong khi thuyền viên lên xuống tàu thì văn phòng cấp tài khoản
 *   trực tiếp trên bản cài của tàu.
 * - SyncState, SiteConfig: trạng thái đồng bộ của riêng từng bản cài. Gửi đi
 *   là bên kia nhận nhầm mốc của mình.
 * - FleetAssignment, Delegation: gắn với tài khoản, mà tài khoản thì không
 *   đồng bộ — gửi đi là trỏ tới userId không tồn tại ở bên kia. Phân công tàu
 *   cho quản lý kỹ thuật là việc của bản cài văn phòng; ủy quyền khai ở đúng
 *   bản cài nơi người ta làm việc.
 * - AuditLog: mỗi bản cài giữ nhật ký của chính nó. Đây là bảng ghi theo từng
 *   thao tác nên lớn nhanh nhất hệ thống; nhét vào gói .json gửi qua email thì
 *   gói phình lên vì thứ không ai đọc hằng ngày. Cần nhật ký của tàu thì lấy
 *   trong bản sao lưu của tàu đó.
 */
export const BANG_KHONG_DONG_BO = [
  "User",
  "Vessel",
  "SyncState",
  "SiteConfig",
  "FleetAssignment",
  "Delegation",
  "AuditLog",
] as const;

/** Tên bảng trong Prisma → tên bảng trong PostgreSQL. */
export const TEN_BANG_DB: Record<string, string> = {
  warehouse: "Warehouse",
  vesselMaterial: "VesselMaterial",
  inventory: "Inventory",
  inventoryTransaction: "InventoryTransaction",
  materialRequest: "MaterialRequest",
  materialRequestItem: "MaterialRequestItem",
  materialRequestEvent: "MaterialRequestEvent",
  purchaseOrder: "PurchaseOrder",
  purchaseOrderItem: "PurchaseOrderItem",
  lashingGear: "LashingGear",
  lashingReport: "LashingReport",
  lashingReportLine: "LashingReportLine",
  paintArea: "PaintArea",
  paintSchemeLayer: "PaintSchemeLayer",
  paintStock: "PaintStock",
  paintJob: "PaintJob",
  paintJobLine: "PaintJobLine",
  paintTransaction: "PaintTransaction",
  reportDocument: "ReportDocument",
  category: "Category",
  material: "Material",
  supplier: "Supplier",
  formStandard: "FormStandard",
  paintProduct: "PaintProduct",
  consumableProduct: "ConsumableProduct",
  consumableStock: "ConsumableStock",
  consumableReceipt: "ConsumableReceipt",
  consumableTransaction: "ConsumableTransaction",
};

/**
 * SQL đặt lại bộ đếm id của một bảng, GIỚI HẠN TRONG DẢI CỦA BẢN CÀI NÀY.
 *
 * Bắt buộc phải giới hạn theo dải. Sau khi văn phòng nhập gói của tàu, MAX(id)
 * của bảng là id của tàu (vd 1.000.000); nếu đặt bộ đếm theo MAX(id) chung thì
 * bản ghi văn phòng tạo sau đó sẽ mang id nằm trong dải tàu và đụng độ khi
 * đồng bộ lần sau. Vì vậy chỉ xét những id thuộc dải [dau, cuoi).
 *
 * Cũng không bao giờ kéo bộ đếm XUỐNG dưới giá trị đã cấp phát: id đã cấp có
 * thể đang nằm ở bên kia dù bản ghi đã bị xóa ở đây.
 */
export function sqlDatLaiBoDem(tenBangDb: string, dauDai: number): string {
  const dau = dauDai > 0 ? dauDai : 1;
  const cuoi = dauDai > 0 ? dauDai + DO_RONG_DAI : DO_RONG_DAI;
  return `DO $ddl$
DECLARE
  seq text := pg_get_serial_sequence('"${tenBangDb}"', 'id');
  ke_tiep bigint;
  cuoi_cap bigint;
  da_cap boolean;
BEGIN
  IF seq IS NULL THEN RETURN; END IF;
  SELECT COALESCE(MAX(id), 0) + 1 INTO ke_tiep
    FROM "${tenBangDb}" WHERE id >= ${dau} AND id < ${cuoi};
  EXECUTE 'SELECT last_value, is_called FROM ' || seq INTO cuoi_cap, da_cap;
  IF cuoi_cap < ${dau} OR cuoi_cap >= ${cuoi} THEN
    cuoi_cap := 0;
  ELSIF da_cap THEN
    cuoi_cap := cuoi_cap + 1;
  END IF;
  PERFORM setval(seq, GREATEST(ke_tiep, cuoi_cap, ${dau}), false);
END
$ddl$;`;
}

/** Chuyển Date và BigInt thành chuỗi để ghi ra JSON được. */
export function chuanHoaDeGhi(v: unknown): unknown {
  if (v instanceof Date) return { __ngay: v.toISOString() };
  if (typeof v === "bigint") return { __bigint: v.toString() };
  if (Array.isArray(v)) return v.map(chuanHoaDeGhi);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = chuanHoaDeGhi(x);
    return o;
  }
  return v;
}

/** Dựng lại Date và BigInt khi đọc gói vào. */
export function khoiPhucKhiDoc(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(khoiPhucKhiDoc);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.__ngay === "string") return new Date(o.__ngay);
    if (typeof o.__bigint === "string") return BigInt(o.__bigint);
    const kq: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) kq[k] = khoiPhucKhiDoc(x);
    return kq;
  }
  return v;
}
