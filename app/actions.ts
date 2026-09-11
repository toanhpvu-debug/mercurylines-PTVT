"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ipThat } from "@/lib/ipThat";
import {
  REQUEST_ALLOWED_FROM,
  REQUEST_STATUS_LABEL,
} from "@/lib/requestStatus";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";
import {
  canManageVesselCatalog,
  capDuyetChiTiet,
  capDuyetChoPhep,
  REQUEST_DELETABLE_BY_NON_ADMIN,
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { ghiNhatKy, ghiNhatKyNguoiDung } from "@/lib/audit";
import { headers } from "next/headers";
import {
  ghiNhanHong,
  kiemTraChan,
  xoaSauKhiThanhCong,
} from "@/lib/chanDangNhap";
import {
  CHUC_DANH,
  NHOM_MAY_CHINH,
  doanLoai,
  phanTichMa,
  sinhMaNgan,
  sttTheoNhom,
} from "@/lib/maVatTu";
import { docKhaiMoi, loiTrung, timTrung } from "@/lib/vatTuMoiChoTau";
import {
  CHI_HUY_TAU,
  ROLES,
  DUYET_CONG_TY,
  LAP_YEU_CAU,
  ROLE_LABEL,
  VAN_HANH_TAU,
  khoaViSaoKhongDuyet,
  trinhThangLenCongTy,
} from "@/lib/roles";
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  ensureUploadDir,
  fileExtension,
  getUploadDir,
} from "@/lib/uploads";
import type { HamDich } from "@/lib/i18n";
import { layT } from "@/lib/i18n/server";

class ActionError extends Error {}

/**
 * Hạn mức dành cho những giao dịch có xin khóa tư vấn bên trong.
 *
 * Giao dịch tương tác của Prisma mặc định chỉ được sống 5 giây (và chờ mượn kết
 * nối trong pool tối đa 2 giây). Đặt khóa BÊN TRONG giao dịch nghĩa là thời
 * gian nằm chờ người khác nhả khóa cũng bị tính vào đúng đồng hồ 5 giây đó:
 * ba người cùng lập đơn vài chục dòng cho một tàu là người thứ ba hết giờ,
 * Prisma ném P2028 và người dùng mất trắng đơn vừa nhập — đúng cái kết cục mà
 * khóa sinh ra để tránh.
 *
 * 20 giây đủ cho vài lượt xếp hàng của giao dịch nặng nhất ở đây (đơn mua tối
 * đa 200 dòng, mỗi dòng một INSERT) mà vẫn ngắn hơn hẳn thời gian người dùng
 * chịu ngồi chờ. maxWait tách riêng vì chờ mượn kết nối là chuyện của pool,
 * không liên quan tới việc mình giữ khóa bao lâu.
 */
const GIAO_DICH_GIU_KHOA = { timeout: 20_000, maxWait: 10_000 };

/**
 * Dịch lỗi hạ tầng của một giao dịch thành câu theo ngôn ngữ đang chọn; null
 * nếu không phải loại đã biết (nơi gọi ném tiếp).
 *
 * Ba mã này đều KHÔNG phải ActionError nên khối catch sẵn có không giữ chúng
 * lại: không dịch thì chúng bay thẳng ra màn hình 500 và người dùng mất toàn bộ
 * dữ liệu vừa nhập, trong khi cả ba đều là chuyện thử lại được.
 */
function thongBaoLoiGiaoDich(t: HamDich, error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (error.code) {
    // P2028: giao dịch quá hạn (thường vì nằm chờ khóa quá lâu).
    // P2024: hết kết nối rảnh trong pool.
    case "P2028":
    case "P2024":
      return t("actions.giaoDich_heThongBan");
    // P2002: hai người ghi cùng lúc lọt qua được khe hẹp và đụng khóa duy nhất.
    case "P2002":
      return t("actions.giaoDich_ghiTrung");
    default:
      return null;
  }
}

// Hash bcrypt hợp lệ dùng để cân bằng thời gian phản hồi khi email không tồn tại,
// tránh dò tài khoản qua timing.
const DUMMY_HASH =
  "$2b$10$p2eUvUoaC5LHxELi.I7wTur0Jaof9nj86cELvEzX0lepltGRldBEi";

function formValues(formData: FormData, keys: string[]) {
  const values: Record<string, string> = {};
  for (const key of keys) {
    values[key] = String(formData.get(key) ?? "");
  }
  return values;
}

function safeNextPath(raw: string, fallback = "/dashboard") {
  if (
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\") &&
    raw !== "/login" &&
    raw !== "/locked"
  ) {
    return raw;
  }
  return fallback;
}

export async function login(
  _prevState: { message: string; email?: string },
  formData: FormData
): Promise<{ message: string; email?: string }> {
  const { t } = await layT();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");
  if (!email || !password) {
    return { message: t("actions.dangNhap_thieuEmailMatKhau"), email };
  }
  // Lấy IP đúng cách proxy.ts đang lấy: đứng sau reverse proxy thì địa chỉ TCP
  // là của chính proxy, đếm theo nó là gộp cả thế giới vào một khóa.
  const h = await headers();
  const ip = ipThat(h.get("x-forwarded-for"), h.get("x-real-ip"));
  // Hỏi bộ đếm TRƯỚC khi chạm database và trước bcrypt — xem lib/chanDangNhap.ts.
  // Đặt sau chỗ này thì mỗi lần bị chặn vẫn tốn một truy vấn và một lần bcrypt,
  // tức vẫn còn nguyên cái giá mà bộ đếm sinh ra để khỏi phải trả.
  const chan = kiemTraChan(email, ip);
  if (chan.chan) {
    const phut = Math.ceil(chan.conLaiGiay / 60);
    // Ghi đúng MỘT dòng cho cả đợt khóa, không ghi từng lần bị chặn: ghi từng
    // lần thì bảng nhật ký vẫn phình đúng như trước khi có bộ đếm.
    if (chan.lanDauBiKhoa) {
      await ghiNhatKy({
        email,
        action: "dang-nhap",
        method: "ACTION",
        path: "/login",
        ketQua: "TU_CHOI",
        detail: `quá nhiều lần đăng nhập hỏng (đếm theo ${chan.vi}) — tạm khóa ${phut} phút`,
        ip,
        userAgent: h.get("user-agent"),
      });
    }
    // Nói thẳng là đang bị tạm khóa chứ không giả vờ "sai mật khẩu": khóa áp
    // cho cả email không tồn tại nên câu này không tiết lộ email nào có thật,
    // mà người dùng thật thì biết đường chờ thay vì gõ lại thêm mười lần.
    return {
      message: t("actions.dangNhap_tamKhoa", { phut }),
      email,
    };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  // Luôn chạy đúng một lần bcrypt.compare dù email có tồn tại hay không,
  // để thời gian phản hồi không tiết lộ email nào có tài khoản.
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !user.isActive || !valid) {
    // Ghi rõ LÝ DO hỏng vào nhật ký. Màn hình vẫn chỉ nói "email hoặc mật khẩu
    // không đúng" — nói rõ hơn là chỉ cho người dò biết email nào có thật —
    // nhưng quản trị đọc nhật ký thì phải phân biệt được ba chuyện khác hẳn
    // nhau: gõ nhầm email, tài khoản bị khóa, và sai mật khẩu. Không tách ra
    // thì mỗi lần có người kêu "không đăng nhập được" lại phải đoán.
    //
    // Nhưng KHÔNG ghi gì về chuỗi vừa gõ, kể cả độ dài. Độ dài là thông tin về
    // chính mật khẩu thật (người ta thường gõ đúng số ký tự mà sai một phím),
    // nó nằm vĩnh viễn trong bảng mà mọi quản trị đều đọc được, và ai lấy được
    // bản sao lưu là thu hẹp được không gian dò. Lý do hỏng đã đủ để tra sổ.
    await ghiNhatKy({
      userId: user?.id ?? null,
      email,
      role: user?.role ?? null,
      action: "dang-nhap",
      method: "ACTION",
      path: "/login",
      ketQua: "TU_CHOI",
      detail: !user
        ? "không có tài khoản nào mang email này"
        : !user.isActive
          ? "tài khoản đang bị khóa"
          : "sai mật khẩu",
      ip,
      userAgent: h.get("user-agent"),
    });
    ghiNhanHong(email, ip);
    return { message: t("actions.dangNhap_saiThongTin"), email };
  }
  // Mật khẩu đã đúng — xóa bộ đếm ngay tại đây chứ không đợi tạo phiên xong.
  // Nhánh createSession hỏng bên dưới là lỗi CẤU HÌNH MÁY CHỦ, không phải người
  // dùng gõ sai; để nó cộng dồn thì một máy chủ thiếu SESSION_SECRET vừa không
  // cho ai vào vừa khóa luôn tài khoản của họ.
  xoaSauKhiThanhCong(email, ip);
  // Đặt cookie TRƯỚC rồi mới ghi "đăng nhập thành công": ghi trước thì khi
  // createSession hỏng (SESSION_SECRET rỗng chẳng hạn), nhật ký nói đăng nhập
  // được còn thực tế không có phiên nào — quản trị đọc nhật ký sẽ đi sai hướng.
  try {
    await createSession({
      userId: user.id,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    await ghiNhatKy({
      userId: user.id,
      email: user.email,
      role: user.role,
      vesselId: user.vesselId,
      action: "dang-nhap",
      method: "ACTION",
      path: "/login",
      ketQua: "TU_CHOI",
      detail: `không tạo được phiên: ${error instanceof Error ? error.message : String(error)}`,
    });
    return {
      message: t("actions.dangNhap_thieuSessionSecret"),
      email,
    };
  }
  await ghiNhatKy({
    userId: user.id,
    email: user.email,
    role: user.role,
    vesselId: user.vesselId,
    action: "dang-nhap",
    method: "ACTION",
    path: "/login",
    detail: "đăng nhập thành công",
  });
  redirect(safeNextPath(next));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function createVessel(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "imo",
    "flag",
    "vesselType",
    "mainEngineGroup",
    "mainEngineModel",
  ]);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const imo = String(formData.get("imo") || "").trim();
  const flag = String(formData.get("flag") || "").trim();
  const vesselType = String(formData.get("vesselType") || "").trim();
  const may = docMayChinh(t, formData);
  if ("error" in may) {
    return { message: may.error, values };
  }
  if (!code || !name) {
    return { message: t("actions.tau_maVaTenBatBuoc"), values };
  }
  try {
    await prisma.vessel.create({
      data: {
        code,
        name,
        imo: imo || null,
        flag: flag || null,
        vesselType: vesselType || null,
        ...may.data,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.tau_maDaTonTai", { ma: code }), values };
    }
    throw error;
  }
  revalidatePath("/vessels");
  return { message: t("actions.tau_daThem", { ten: name }), success: true };
}

/**
 * Đọc chức danh giữ vật tư từ biểu mẫu người dùng.
 *
 * Bỏ trống được — khi đó hệ thống suy từ vai trò đăng nhập (máy hai → 2E). Chỉ
 * những chức danh không có vai trò riêng (thủy thủ trưởng, thợ máy, sĩ quan
 * điện, bếp trưởng) mới bắt buộc khai tay, vì họ đều đăng nhập bằng CREW.
 */
function docChucDanhGiuVatTu(
  t: HamDich,
  formData: FormData
): { rankCode: string | null } | { error: string } {
  const raw = String(formData.get("rankCode") || "").trim();
  if (!raw) return { rankCode: null };
  if (!CHUC_DANH[raw]) {
    return {
      error: t("actions.taiKhoan_chucDanhKhongCoTrongQuyUoc", { ma: raw }),
    };
  }
  return { rankCode: raw };
}

/**
 * Số đơn mua theo quy ước chứng từ: PO-<mã tàu>-<năm 2 số>-<số thứ tự>.
 * VD PO-MLS001-26-0007.
 *
 * Trước đây số đơn là dấu thời gian kèm số ngẫu nhiên (PO-1787711139511-115):
 * máy đọc được, người thì không. Số yêu cầu vật tư đã đổi sang quy ước này rồi,
 * để đơn mua lệch chuẩn thì hai chứng từ của cùng một việc mua lại đánh số theo
 * hai kiểu, và không đối chiếu được với nhau khi tra sổ.
 *
 * Lấy số LỚN NHẤT đã dùng trong năm của tàu rồi +1, không dựa vào số lượng đơn:
 * xóa một đơn giữa chừng mà đếm lại thì số vừa xóa được cấp lần hai, trong khi
 * số cũ có thể đã nằm trên chứng từ gửi cho nhà cung cấp.
 */
// Vùng khóa tư vấn dành cho việc cấp số đơn mua. Xem chú thích KHOA_TON_KHO về
// lý do mỗi nghiệp vụ phải có số vùng riêng.
const KHOA_SINH_SO_PO = 811002;

/**
 * Băm tiền tố dãy số PO thành một số int32 để làm chìa khóa thứ hai.
 *
 * Phải khóa theo ĐÚNG thứ chia dãy số chứ không phải theo vesselId: tiền tố
 * dựng từ vessel.code sau khi bỏ hết ký tự không phải chữ/số, nên hai tàu khai
 * "MLS-001" và "MLS001" — hoặc hai tàu có mã toàn ký tự đặc biệt, cùng lùi về
 * "NA" — dùng CHUNG một dãy số trong khi vesselId khác nhau. Khóa theo vesselId
 * thì hai bên đó không xếp hàng với nhau, cùng đọc thấy số lớn nhất giống nhau,
 * cùng sinh một poNo, và một bên vỡ vì poNo là khóa duy nhất.
 *
 * Đụng độ băm chỉ khiến hai dãy số chẳng liên quan phải chờ nhau — chậm một
 * nhịp, KHÔNG bao giờ sai số liệu.
 */
function khoaDaySoPO(tienTo: string) {
  let bam = 0;
  for (let i = 0; i < tienTo.length; i++) {
    bam = (Math.imul(bam, 31) + tienTo.charCodeAt(i)) | 0;
  }
  return bam;
}

/**
 * Nhận Prisma.TransactionClient chứ KHÔNG nhận client trần, vì hàm này tự xin
 * khóa tư vấn: pg_advisory_xact_lock chỉ giữ tới hết giao dịch, gọi ngoài giao
 * dịch thì khóa nhả ngay và chẳng xếp hàng được ai. Ràng buộc kiểu ở đây là để
 * không đường cấp số nào quên xin khóa — khóa tư vấn chỉ có tác dụng khi MỌI
 * bên ghi đều xin, một cửa bỏ qua là cửa kia có xin cũng thành trang trí.
 */
async function sinhSoDonMua(
  tx: Prisma.TransactionClient,
  vesselId: number
): Promise<string> {
  const vessel = await tx.vessel.findUnique({
    where: { id: vesselId },
    select: { code: true },
  });
  const maTau = (vessel?.code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  // Khóa theo mã tàu nhưng KHÔNG kèm năm: dãy số chia theo năm, còn khóa thì
  // không nên chia, nếu không thì đúng khoảnh khắc giao thừa hai đơn của cùng
  // một tàu lại rơi vào hai khóa khác nhau. Khóa rộng hơn dãy số chỉ tốn thêm
  // một nhịp chờ; khóa hẹp hơn dãy số là mất tác dụng.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_SINH_SO_PO}::int, ${khoaDaySoPO(
    `PO-${maTau || "NA"}-`
  )}::int)`;
  const nam = String(new Date().getFullYear()).slice(-2);
  const dau = `PO-${maTau || "NA"}-${nam}-`;
  const ganNhat = await tx.purchaseOrder.findFirst({
    where: { poNo: { startsWith: dau } },
    orderBy: { poNo: "desc" },
    select: { poNo: true },
  });
  const so = ganNhat ? Number(ganNhat.poNo.slice(dau.length)) || 0 : 0;
  return `${dau}${String(so + 1).padStart(4, "0")}`;
}

const VESSEL_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"];


/**
 * Đọc họ máy chính và model của tàu từ biểu mẫu.
 *
 * Bỏ trống được — nhiều tàu khai dần — nhưng đã khai thì phải là một họ có
 * trong quy ước, vì phụ tùng máy chính xếp nhóm theo đúng chuỗi này.
 */
function docMayChinh(
  t: HamDich,
  formData: FormData
):
  | { data: { mainEngineGroup: string | null; mainEngineModel: string | null } }
  | { error: string } {
  const nhom = String(formData.get("mainEngineGroup") || "").trim();
  const model = String(formData.get("mainEngineModel") || "").trim();
  if (nhom && !(NHOM_MAY_CHINH as readonly string[]).includes(nhom)) {
    return { error: t("actions.tau_hoMayChinhKhongCoTrongQuyUoc", { nhom }) };
  }
  return {
    data: { mainEngineGroup: nhom || null, mainEngineModel: model || null },
  };
}


export async function updateVessel(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("actions.tau_khongTimThay") };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "imo",
    "flag",
    "vesselType",
    "mainEngineGroup",
    "mainEngineModel",
    "status",
  ]);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const imo = String(formData.get("imo") || "").trim();
  const flag = String(formData.get("flag") || "").trim();
  const vesselType = String(formData.get("vesselType") || "").trim();
  const status = String(formData.get("status") || "ACTIVE");
  const may = docMayChinh(t, formData);
  if ("error" in may) {
    return { message: may.error, values };
  }
  if (!code || !name) {
    return { message: t("actions.tau_maVaTenBatBuoc"), values };
  }
  if (!VESSEL_STATUSES.includes(status)) {
    return { message: t("actions.tau_trangThaiKhongHopLe"), values };
  }
  const before = await prisma.vessel.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!before) {
    return { message: t("actions.tau_khongTimThay") };
  }
  let renamedWarehouses = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vessel.update({
        where: { id },
        data: {
          code,
          name,
          imo: imo || null,
          flag: flag || null,
          vesselType: vesselType || null,
          status,
          ...may.data,
        },
      });
      // Tên kho nhúng sẵn tên tàu ("Kho máy - M. ODYSSEY") nên đổi tên tàu mà không
      // đổi kho là dữ liệu lệch ngay. Chỉ sửa kho còn theo đúng quy ước đuôi
      // " - <tên tàu cũ>"; kho đã được đặt tên riêng thì giữ nguyên.
      if (before.name !== name) {
        const suffix = ` - ${before.name}`;
        const warehouses = await tx.warehouse.findMany({
          where: { vesselId: id },
          select: { id: true, name: true },
        });
        for (const wh of warehouses) {
          if (!wh.name.endsWith(suffix)) continue;
          await tx.warehouse.update({
            where: { id: wh.id },
            data: { name: `${wh.name.slice(0, -suffix.length)} - ${name}` },
          });
          renamedWarehouses += 1;
        }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { message: t("actions.tau_maDaTonTai", { ma: code }), values };
      }
      if (error.code === "P2025") {
        return { message: t("actions.tau_khongTimThay") };
      }
    }
    throw error;
  }
  revalidatePath("/vessels");
  revalidatePath(`/vessels/${id}`);
  revalidatePath("/inventory");
  return {
    message: renamedWarehouses
      ? t("actions.tau_daLuuVaDoiTenKho", { n: renamedWarehouses })
      : t("actions.daLuuThayDoi"),
    success: true,
  };
}

export async function deleteVessel(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("actions.tau_khongTimThay") };
  }
  const [requestCount, assignedUserCount] = await Promise.all([
    prisma.materialRequest.count({ where: { vesselId: id } }),
    prisma.user.count({ where: { vesselId: id } }),
  ]);
  if (requestCount > 0) {
    return {
      message: t("actions.tau_conYeuCauKhongXoaDuoc", { n: requestCount }),
    };
  }
  if (assignedUserCount > 0) {
    return {
      message: t("actions.tau_conNguoiDungKhongXoaDuoc", {
        n: assignedUserCount,
      }),
    };
  }
  let daXoa;
  try {
    // delete() trả về chính bản ghi vừa xóa, nên lấy được mã và tên tàu cho
    // nhật ký mà không tốn thêm một lượt truy vấn.
    daXoa = await prisma.vessel.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: t("actions.tau_khongTimThay") };
      }
      if (error.code === "P2003") {
        return { message: t("actions.tau_conDuLieuLienQuan") };
      }
    }
    throw error;
  }
  // Xóa một con tàu là thao tác không hoàn lại và kéo theo cả kho, tồn kho,
  // chứng từ của tàu đó. Vết tự động ở proxy.ts chỉ thấy "POST /vessels" nên
  // không trả lời được đã xóa tàu nào và ai xóa — đúng khoảng trống mà đường
  // ghi thủ công sinh ra để lấp.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    // Tàu của chính bản ghi, không phải tàu của ông quản trị (xem createUser).
    vesselId: id,
    action: "xoa-tau",
    path: "/vessels",
    detail: `Xóa tàu #${id} (${daXoa.code} — ${daXoa.name})`,
  });
  revalidatePath("/vessels");
  redirect("/vessels");
}

/**
 * Ba cột department / equipGroup / responsibleRank chính là các phân đoạn của
 * mã vật tư — mọi chỗ lọc đều đọc CỘT chứ không đọc chuỗi mã (trang /materials
 * lọc theo responsibleRank, dashboard đếm "mặt hàng bạn quản lý", bảng phân
 * nhóm đọc department). Mã đổi mà cột không đổi thì nhãn dán trên thùng hàng
 * nói một đằng, phần mềm xếp món hàng vào tay người khác.
 *
 * CHỈ ghi những cột mà mã THẬT SỰ nói ra. Khuôn đang dùng (`D-IMPA-0075`) chỉ
 * mang bộ phận; nó không nói ai giữ và không nói thuộc thiết bị nào. Ghi null
 * cho hai cột kia thì mỗi lần sửa mã là xóa mất phân loại mà người vận hành đã
 * gán bằng tay hoặc bằng `gan-ma-vat-tu.cmd` — mã không hề mâu thuẫn với chúng,
 * nó chỉ im lặng về chúng.
 *
 * Mã sai quy ước thì mới trả null cho cả ba: thà chưa phân loại còn hơn giữ lại
 * phân loại của một mã đã không còn nghĩa gì.
 */
function phanLoaiTuMa(ma: string): {
  department?: string | null;
  equipGroup?: string | null;
  responsibleRank?: string | null;
} {
  const kq = phanTichMa(ma);
  if ("loi" in kq) {
    return { department: null, equipGroup: null, responsibleRank: null };
  }
  return {
    department: kq.boPhan,
    ...(kq.nhomThietBi ? { equipGroup: kq.nhomThietBi } : {}),
    ...(kq.chucDanh ? { responsibleRank: kq.chucDanh } : {}),
  };
}

export async function createMaterial(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "code",
    "nameVn",
    "nameEn",
    "impa",
    "partNumber",
    "manufacturer",
    "materialType",
    "equipment",
    "uom",
    "categoryId",
    "minStock",
    "maxStock",
    "isCritical",
  ]);
  const code = String(formData.get("code") || "").trim();
  const nameVn = String(formData.get("nameVn") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const impa = String(formData.get("impa") || "").trim();
  const partNumber = String(formData.get("partNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const materialType =
    String(formData.get("materialType") || "STORE") === "SPARE"
      ? "SPARE"
      : "STORE";
  const equipment = String(formData.get("equipment") || "").trim();
  const uom = String(formData.get("uom") || "PCS").trim();
  const categoryIdRaw = String(formData.get("categoryId") || "");
  const minStock = Number(formData.get("minStock") || 0);
  const maxStock = Number(formData.get("maxStock") || 0);
  const isCritical = formData.get("isCritical") === "on";
  if (!code || !nameVn) {
    return { message: t("actions.vatTu_maVaTenBatBuoc"), values };
  }
  try {
    await prisma.material.create({
      data: {
        code,
        nameVn,
        nameEn: nameEn || null,
        impa: impa || null,
        partNumber: partNumber || null,
        manufacturer: manufacturer || null,
        materialType,
        equipment: materialType === "SPARE" ? equipment || null : null,
        uom,
        categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
        minStock,
        maxStock,
        isCritical,
        ...phanLoaiTuMa(code),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.vatTu_maDaTonTai", { ma: code }), values };
    }
    throw error;
  }
  revalidatePath("/materials");
  return { message: t("actions.vatTu_daThem", { ten: nameVn }), success: true };
}

// Ngừng / mở lại sử dụng vật tư — giữ nguyên tồn kho và lịch sử.
export async function setMaterialActive(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const active = String(formData.get("active") || "") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  try {
    await prisma.material.update({
      where: { id },
      data: { isActive: active },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: t("actions.vatTu_khongTimThay") };
    }
    throw error;
  }
  revalidatePath("/materials");
  return { message: "", success: true };
}

// Xóa vĩnh viễn — chỉ khi vật tư chưa có tồn kho và chưa dùng trong yêu cầu nào.
export async function deleteMaterial(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const [requestItemCount, inventoryCount] = await Promise.all([
    prisma.materialRequestItem.count({ where: { materialId: id } }),
    prisma.inventory.count({ where: { materialId: id } }),
  ]);
  if (requestItemCount > 0) {
    return { message: t("actions.vatTu_daDungTrongYeuCau") };
  }
  if (inventoryCount > 0) {
    return { message: t("actions.vatTu_dangCoTonKho") };
  }
  let daXoa;
  try {
    daXoa = await prisma.material.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: t("actions.vatTu_daBiXoa") };
      }
      if (error.code === "P2003") {
        return { message: t("actions.vatTu_dangDuocThamChieu") };
      }
    }
    throw error;
  }
  // Xóa khỏi danh mục dùng chung là thao tác không hoàn lại: mã vật tư biến
  // mất khỏi mọi tàu cùng lúc. Ghi lại mã và tên để còn dựng lại được món hàng
  // đã mất, chứ "POST /materials" trong vết tự động thì không nói lên gì.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    // Danh mục dùng chung cả đội tàu — không thuộc tàu nào.
    vesselId: null,
    action: "xoa-vat-tu",
    path: "/materials",
    detail: `Xóa vật tư #${id} (${daXoa.code} — ${daXoa.nameVn})`,
  });
  revalidatePath("/materials");
  return { message: "", success: true };
}

// Gán một vật tư vào danh mục của một tàu.
export async function assignMaterialToVessel(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const vesselId = Number(formData.get("vesselId"));
  const materialId = Number(formData.get("materialId"));
  if (
    !Number.isInteger(vesselId) ||
    vesselId <= 0 ||
    !Number.isInteger(materialId) ||
    materialId <= 0
  ) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material) {
    return { message: t("actions.vatTu_khongTonTai") };
  }
  await prisma.vesselMaterial.upsert({
    where: { vesselId_materialId: { vesselId, materialId } },
    update: {},
    create: { vesselId, materialId },
  });
  revalidatePath("/materials");
  return { message: "", success: true };
}

/**
 * Vùng khóa tư vấn cho việc CẤP MÃ vật tư khai mới tại tàu. Cùng không gian với
 * 811001 (tồn kho), 811002 (số PO), 811003 (số yêu cầu), 811004 (tồn nhiên
 * liệu) — xem chú thích KHOA_TON_KHO về lý do mỗi nghiệp vụ một vùng riêng.
 *
 * Mã cấp theo "số lớn nhất đang có + 1" (sttTheoNhom), nên hai người khai cùng
 * lúc mà không xếp hàng là cùng đọc thấy một số, cùng sinh một mã, và một bên
 * vỡ vì `code` là khóa duy nhất. Khóa một chìa cho cả danh mục: cấp mã chỉ mất
 * vài mili-giây, không đáng chia nhỏ theo khuôn.
 */
const KHOA_CAP_MA_VAT_TU = 811005;

/**
 * Khai một mặt hàng MỚI — chưa có trong danh mục gốc — ngay tại danh mục của
 * một tàu, gắn chức danh giữ. Vì sao có và quy tắc: lib/vatTuMoiChoTau.ts.
 *
 * Quyền: cùng cửa với assignMaterialToVessel — chỉ huy của ĐÚNG tàu đó, hoặc
 * ADMIN. Mã KHÔNG nhận từ form: cấp trong giao dịch có khóa, bằng đúng bộ đếm
 * của bước nhập file (sttTheoNhom + sinhMaNgan) để hai cửa vào danh mục xếp số
 * như nhau. Trùng với hàng sẵn có thì không tạo — chỉ sang ô "chọn từ danh mục
 * gốc" với đúng mã.
 */
export async function khaiVatTuMoiChoTau(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t, tenChucDanh } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "rankCode",
    "boPhan",
    "materialType",
    "nameVn",
    "nameEn",
    "equipment",
    "impa",
    "partNumber",
    "manufacturer",
    "categoryId",
    "uom",
    "minStock",
    "isCritical",
  ]);
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: t("chung.duLieuKhongHopLe"), values };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: t("chung.khongCoQuyen"), values };
  }
  const doc = docKhaiMoi(values);
  if (!doc.ok) {
    return { message: doc.loi, values };
  }
  const khai = doc.gt;

  const [vessel, nhom] = await Promise.all([
    prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { name: true },
    }),
    khai.categoryId === null
      ? null
      : prisma.category.findUnique({
          where: { id: khai.categoryId },
          select: { id: true },
        }),
  ]);
  if (!vessel) {
    return { message: t("actions.tau_khongTonTai"), values };
  }
  if (khai.categoryId !== null && !nhom) {
    return { message: t("actions.nhomThietBi_khongTonTai"), values };
  }

  const loai = doanLoai(khai.materialType);
  try {
    const kq = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_CAP_MA_VAT_TU}::int, 0::int)`;
      // Đọc danh mục SAU khi cầm khóa: người xếp hàng trước có thể vừa thêm
      // một mã, và soát trùng cũng phải thấy được mặt hàng vừa thêm đó.
      const daCo = await tx.material.findMany({
        select: {
          code: true,
          categoryId: true,
          nameVn: true,
          equipment: true,
          impa: true,
          partNumber: true,
          manufacturer: true,
          isActive: true,
        },
      });
      const trung = timTrung(khai, daCo);
      if (trung) return { ket: "trung" as const, trung };

      const cho = sttTheoNhom(
        khai.boPhan,
        loai,
        daCo.map((m) => ({ ma: m.code, nhom: m.categoryId })),
        khai.categoryId
      );
      const daDung = new Set(daCo.map((m) => m.code));
      let stt = cho.stt;
      let ma = sinhMaNgan({ boPhan: khai.boPhan, loai, stt });
      while ("ma" in ma && daDung.has(ma.ma)) {
        stt++;
        ma = sinhMaNgan({ boPhan: khai.boPhan, loai, stt });
      }
      if ("loi" in ma) {
        throw new ActionError(
          t("actions.vatTu_khongCapDuocMa", { loi: ma.loi })
        );
      }
      const material = await tx.material.create({
        data: {
          code: ma.ma,
          nameVn: khai.nameVn,
          nameEn: khai.nameEn,
          impa: khai.impa,
          partNumber: khai.partNumber,
          manufacturer: khai.manufacturer,
          materialType: khai.materialType,
          equipment: khai.equipment,
          uom: khai.uom,
          categoryId: khai.categoryId,
          minStock: khai.minStock,
          maxStock: 0,
          isCritical: khai.isCritical,
          // Ghi thẳng từ khai báo, không suy từ mã: mã ngắn chỉ nói bộ phận,
          // còn người giữ là điều người khai vừa chọn — cột "Giữ bởi" và bộ
          // lọc chức danh coi đây là nguồn "đã gán", tin cậy nhất.
          department: khai.boPhan,
          responsibleRank: khai.rankCode,
        },
        select: { id: true },
      });
      // Chỉ gắn vào tàu đang khai — tàu khác muốn dùng thì thêm từ danh mục gốc.
      await tx.vesselMaterial.create({
        data: { vesselId, materialId: material.id },
      });
      return { ket: "ok" as const, ma: ma.ma, trongKhoi: cho.trongKhoi };
    }, GIAO_DICH_GIU_KHOA);

    if (kq.ket === "trung") {
      return { message: loiTrung(kq.trung), values };
    }
    revalidatePath("/materials");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    let message = t("actions.vatTu_daTaoChoTau", {
      ma: kq.ma,
      ten: khai.nameVn,
      chucDanh: tenChucDanh(khai.rankCode),
      maChucDanh: khai.rankCode,
      tau: vessel.name,
    });
    if (!kq.trongKhoi) {
      message += ` ${t("actions.vatTu_khoiMaDaKin")}`;
    }
    return { message, success: true };
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message, values };
    }
    const dich = thongBaoLoiGiaoDich(t, error);
    if (dich) {
      return { message: dich, values };
    }
    throw error;
  }
}

// Gỡ một vật tư khỏi danh mục của một tàu (không xóa định nghĩa gốc, không xóa tồn kho).
export async function unassignMaterialFromVessel(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const vesselId = Number(formData.get("vesselId"));
  const materialId = Number(formData.get("materialId"));
  if (
    !Number.isInteger(vesselId) ||
    vesselId <= 0 ||
    !Number.isInteger(materialId) ||
    materialId <= 0
  ) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  await prisma.vesselMaterial.deleteMany({
    where: { vesselId, materialId },
  });
  revalidatePath("/materials");
  return { message: "", success: true };
}

// Vùng khóa tư vấn (advisory lock) dành riêng cho tồn kho. Postgres chỉ có MỘT
// không gian khóa (int, int) dùng chung cho cả tiến trình, nên phải đặt số vùng
// riêng cho từng nghiệp vụ; trùng vùng với chỗ khác thì hai việc chẳng liên quan
// gì lại chặn nhau.
const KHOA_TON_KHO = 811001;

/**
 * Gộp (vật tư, kho) thành một số int32 làm chìa khóa thứ hai.
 *
 * Đụng độ băm chỉ khiến hai dòng tồn khác nhau phải xếp hàng chờ nhau — chậm
 * một nhịp, KHÔNG bao giờ sai số liệu. Ngược lại, thiếu khóa thì hai phiếu cùng
 * lúc trên một dòng tồn mới sẽ cùng INSERT và một bên vỡ vì trùng khóa.
 */
function khoaDongTon(materialId: number, warehouseId: number) {
  return (Math.imul(materialId, 100003) + warehouseId) | 0;
}

export async function createInventoryTransaction(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const scope = vesselScopeDayDu(actor);
  const values = formValues(formData, [
    "materialId",
    "warehouseId",
    "type",
    "quantity",
    "note",
    "occurredAt",
  ]);
  const returnTo = safeNextPath(
    String(formData.get("returnTo") || ""),
    "/inventory"
  );
  const type = String(formData.get("type") || "");
  const materialId = Number(formData.get("materialId"));
  const warehouseId = Number(formData.get("warehouseId"));
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") || "").trim();
  if (!["IN", "OUT"].includes(type)) {
    return { message: t("actions.kho_loaiGiaoDichKhongHopLe"), values };
  }
  if (!materialId || !warehouseId || !(quantity > 0)) {
    return { message: t("actions.kho_duLieuNhapXuatKhongHopLe"), values };
  }
  // Thời điểm thực hiện: để trống = bây giờ; cho phép ghi lùi, không cho ghi trước tương lai.
  const occurredRaw = String(formData.get("occurredAt") || "").trim();
  let occurredAt = new Date();
  if (occurredRaw) {
    const d = new Date(occurredRaw);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) {
      return { message: t("actions.kho_thoiDiemKhongHopLe"), values };
    }
    if (d.getTime() > Date.now() + 5 * 60 * 1000) {
      return {
        message: t("actions.kho_thoiDiemTuongLai"),
        values,
      };
    }
    occurredAt = d;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse || !warehouse.vesselId) {
        throw new ActionError(t("actions.kho_khongHopLeHoacKhongThuocTau"));
      }
      if (!trongPhamVi(scope, warehouse.vesselId)) {
        throw new ActionError(t("actions.kho_chiTauMinhPhuTrach"));
      }
      const vesselId = warehouse.vesselId;
      // Xếp hàng mọi phiếu động tới CÙNG một dòng tồn. Khóa tự nhả khi giao
      // dịch kết thúc (commit hay rollback), không có gì phải dọn.
      //
      // Cần khóa này cho nhánh NHẬP: hai phiếu nhập cùng lúc cho một cặp
      // (vật tư, kho) chưa từng có dòng tồn thì cả hai cùng thấy "chưa có" và
      // cùng INSERT — một bên vỡ vì đụng ràng buộc duy nhất, người dùng nhận
      // màn hình lỗi thay vì thông báo tiếng Việt.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO}::int, ${khoaDongTon(
        materialId,
        warehouseId
      )}::int)`;
      if (type === "OUT") {
        // Trừ tồn bằng MỘT lệnh UPDATE có điều kiện, không đọc-rồi-ghi.
        // Điều kiện quantity >= số xuất nằm ngay trong mệnh đề WHERE nên
        // database tự là trọng tài: hai người cùng xuất một vật tư thì người
        // sau chỉ trừ được nếu phần còn lại thật sự đủ. Kiểu cũ (đọc số, so
        // sánh trong Node, rồi ghi đè) làm cả hai đọc thấy số cũ và tồn kho
        // tụt xuống ÂM, hoặc mất hẳn một lần xuất.
        const daTru = await tx.inventory.updateMany({
          where: {
            materialId,
            warehouseId,
            quantity: { gte: quantity },
          },
          data: {
            quantity: {
              decrement: quantity,
            },
          },
        });
        // count === 0 gồm cả hai khả năng: chưa có dòng tồn, hoặc tồn không đủ.
        // Với người dùng thì cùng một việc — không xuất được vì thiếu hàng.
        if (daTru.count === 0) {
          throw new ActionError(t("actions.kho_khongDuTon"));
        }
      } else {
        await tx.inventory.upsert({
          where: {
            materialId_warehouseId: {
              materialId,
              warehouseId,
            },
          },
          update: {
            quantity: {
              increment: quantity,
            },
            vesselId,
          },
          create: {
            materialId,
            warehouseId,
            vesselId,
            quantity,
          },
        });
      }
      await tx.inventoryTransaction.create({
        data: {
          type,
          materialId,
          warehouseId,
          vesselId,
          quantity,
          note: note || null,
          occurredAt,
          performedBy: actor.name,
        },
      });
    }, GIAO_DICH_GIU_KHOA);
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message, values };
    }
    const thongBao = thongBaoLoiGiaoDich(t, error);
    if (thongBao) {
      return { message: thongBao, values };
    }
    throw error;
  }
  revalidatePath("/inventory");
  revalidatePath(returnTo);
  return { message: t("actions.kho_daGhiNhanGiaoDich"), success: true };
}

const allowedFrom = REQUEST_ALLOWED_FROM;

// Ghi một mốc vào nhật ký phê duyệt. Gọi trong cùng transaction với thao tác
// đổi trạng thái để nhật ký không bao giờ lệch với trạng thái thực tế.
async function logRequestEvent(
  tx: Prisma.TransactionClient,
  args: {
    requestId: number;
    fromStatus: string | null;
    toStatus: string;
    actorName: string;
    actorRole: string;
    note?: string | null;
  }
) {
  await tx.materialRequestEvent.create({
    data: {
      requestId: args.requestId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      actorName: args.actorName,
      actorRole: args.actorRole,
      note: args.note ?? null,
    },
  });
}

/**
 * Duyệt yêu cầu kèm số lượng duyệt (S.L Duyệt / APP) cho từng dòng.
 *
 * MỘT hàm lo cả hai cấp, tự xác định cấp theo trạng thái hiện tại của yêu cầu:
 *   PENDING_MASTER -> PENDING_OFFICE   thuyền trưởng / máy trưởng duyệt
 *   PENDING_OFFICE -> APPROVED         quản lý kỹ thuật công ty duyệt
 *
 * Tách thành hai hàm thì phần chốt trạng thái atomic, cắt số lượng và ghi nhật
 * ký phải viết hai lần — sớm muộn cũng lệch nhau.
 *
 * Cấp công ty được sửa lại số lượng tàu đã duyệt (giảm tiếp), vì công ty mới là
 * nơi quyết định cuối cùng mua bao nhiêu.
 */
export async function approveRequestQuantities(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const actor = await requireActiveRole([
    ...new Set([...CHI_HUY_TAU, ...DUYET_CONG_TY]),
  ]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("actions.yeuCau_khongHopLe") };
  }
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!request) {
    return { message: t("actions.yeuCau_khongTimThay") };
  }

  const { cap, uyQuyenTu } = capDuyetChiTiet(actor, request);
  if (!cap) {
    // Báo đúng lý do: sai cấp, sai bộ phận, hay yêu cầu chưa được trình.
    if (request.status === "DRAFT") {
      return { message: t("actions.yeuCau_conLaNhap") };
    }
    if (request.status !== "PENDING_MASTER" && request.status !== "PENDING_OFFICE") {
      return { message: t("actions.yeuCau_daDuocXuLy") };
    }
    if (request.status === "PENDING_OFFICE") {
      return { message: t("actions.yeuCau_buocCuaCongTy") };
    }
    // Tự lập tự duyệt: báo đúng lý do thay vì "không có quyền" chung chung.
    if (request.requestedById != null && request.requestedById === actor.id) {
      return { message: t("actions.yeuCau_tuLapTuDuyet") };
    }
    return { message: t(khoaViSaoKhongDuyet(actor.role)) };
  }

  const tuTrangThai = cap === "TAU" ? "PENDING_MASTER" : "PENDING_OFFICE";
  const denTrangThai = cap === "TAU" ? "PENDING_OFFICE" : "APPROVED";
  const now = new Date();
  // Ký thay thì chứng từ phải ghi CẢ HAI: người đặt bút và thẩm quyền họ mượn.
  // Ghi mỗi tên người ký là mất dấu vì sao họ có quyền; ghi mỗi tên người ủy
  // quyền là ghi khống chữ ký của một người không có mặt.
  const tenNguoiKy = uyQuyenTu
    ? `${actor.name} (ký thay ${ROLE_LABEL[uyQuyenTu.delegatorRole] ?? uyQuyenTu.delegatorRole} ${uyQuyenTu.delegatorName})`
    : actor.name;
  const chucDanhKy = uyQuyenTu ? uyQuyenTu.delegatorRole : actor.role;
  const dau =
    cap === "TAU"
      ? {
          shipApprovedBy: tenNguoiKy,
          shipApprovedRole: chucDanhKy,
          shipApprovedAt: now,
        }
      : { approvedBy: tenNguoiKy, approvedAt: now };

  let soLuongDuyet = 0;
  try {
    await prisma.$transaction(async (tx) => {
      // Chốt trạng thái atomic trước — nếu người khác vừa duyệt/từ chối thì count=0 → rollback
      const guard = await tx.materialRequest.updateMany({
        where: { id, status: tuTrangThai },
        data: { status: denTrangThai, ...dau },
      });
      if (guard.count === 0) {
        throw new ActionError(t("actions.yeuCau_daDuocXuLy"));
      }
      let totalApproved = 0;
      for (const item of request.items) {
        const raw = formData.get(`approved_${item.id}`);
        let approved = Number(raw);
        if (!Number.isFinite(approved) || approved < 0) approved = 0;
        // Không cấp nào được duyệt vượt số lượng tàu đã xin; cấp công ty còn
        // không được vượt số lượng tàu đã duyệt ở bước trước.
        const tran =
          cap === "TAU"
            ? item.quantity
            : Math.min(item.quantity, item.approvedQuantity);
        if (approved > tran) approved = tran;
        totalApproved += approved;
        await tx.materialRequestItem.update({
          where: { id: item.id },
          data: { approvedQuantity: approved },
        });
      }
      const note = String(formData.get("note") || "").trim();
      const tenCap =
        cap === "TAU"
          ? `${ROLE_LABEL[chucDanhKy] ?? chucDanhKy} duyệt cấp tàu`
          : "Quản lý kỹ thuật duyệt cấp công ty";
      await logRequestEvent(tx, {
        requestId: id,
        fromStatus: request.status,
        toStatus: denTrangThai,
        actorName: tenNguoiKy,
        actorRole: chucDanhKy,
        note:
          note ||
          `${tenCap}: ${request.items.length} dòng, tổng SL duyệt ${totalApproved}`,
      });
      soLuongDuyet = totalApproved;
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    throw error;
  }
  await ghiNhatKyNguoiDung(actor, {
    action: "duyet-yeu-cau",
    path: `/requests/${id}`,
    vesselId: request.vesselId,
    onBehalfOfId: uyQuyenTu?.delegatorId ?? null,
    detail: `#${id} ${request.status} → ${denTrangThai}, cấp ${cap}, tổng SL duyệt ${soLuongDuyet}`,
  });
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  redirect(`/requests/${id}`);
}

export async function updateRequestStatus(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t, tTuDo } = await layT();
  const status = String(formData.get("status") || "");
  // Những trạng thái này CHỈ được đặt bởi hành động chuyên trách, không bao giờ
  // qua đường chuyển trạng thái tay này:
  //   PENDING_OFFICE, APPROVED       -> approveRequestQuantities: cắt số lượng
  //       duyệt theo từng dòng VÀ chặn người tự duyệt yêu cầu của chính mình.
  //   PARTIALLY_DELIVERED, FULLY_DELIVERED -> receivePurchaseOrder: cuộn theo
  //       số hàng NHẬN THẬT trên phiếu nhận, không phải một cú bấm.
  // Nhận chúng ở đây là mở đúng cửa sau mà các guard kia dựng lên để chặn: máy
  // trưởng tự đẩy yêu cầu mình lập lên "đã duyệt", hay đánh dấu "giao đủ" khi
  // kho chưa nhận được gì. Chỉ kiểm ở giao diện là chưa đủ — server action gọi
  // thẳng bằng POST được, không đi qua nút bấm.
  const CHI_HANH_DONG_CHUYEN_TRACH = new Set([
    "PENDING_OFFICE",
    "APPROVED",
    "PARTIALLY_DELIVERED",
    "FULLY_DELIVERED",
  ]);
  if (CHI_HANH_DONG_CHUYEN_TRACH.has(status)) {
    return {
      message:
        status === "PENDING_OFFICE" || status === "APPROVED"
          ? t("actions.yeuCau_phaiQuaFormDuyet")
          : t("actions.yeuCau_trangThaiGiaoTuDong"),
    };
  }
  // Quyền theo từng bước chuyển, đúng phân cấp:
  //   PENDING_MASTER (trình duyệt)  -> người lập, kể cả sĩ quan/thuyền viên
  //   REJECTED (từ chối)            -> tùy đang ở cấp nào, kiểm tra sau khi
  //                                    đọc trạng thái hiện tại của yêu cầu
  //   còn lại (hủy, chuyển mua sắm) -> chỉ huy tàu + văn phòng
  const roles =
    status === "PENDING_MASTER"
      ? LAP_YEU_CAU
      : status === "REJECTED"
        ? [...new Set([...CHI_HUY_TAU, ...DUYET_CONG_TY])]
        : [...new Set([...CHI_HUY_TAU, ...DUYET_CONG_TY])];
  const actor = await requireActiveRole([...roles]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const scope = vesselScopeDayDu(actor);
  const id = Number(formData.get("id"));
  const returnTo = safeNextPath(
    String(formData.get("returnTo") || ""),
    "/requests"
  );
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Object.hasOwn(allowedFrom, status)
  ) {
    return { message: t("actions.yeuCau_trangThaiKhongHopLe") };
  }
  // Từ chối phải nêu lý do — người lập cần biết sửa gì để trình lại.
  const note = String(formData.get("note") || "").trim();
  if (status === "REJECTED" && !note) {
    return { message: t("actions.yeuCau_thieuLyDoTuChoi") };
  }
  const now = new Date();
  // Thuyền trưởng (và quản trị) trình yêu cầu của CHÍNH MÌNH thì bỏ qua bước
  // duyệt cấp tàu, đi thẳng lên công ty. Trên tàu không còn ai trên thuyền
  // trưởng để ký, mà chính ông ấy lại bị chặn tự duyệt — không có lối này thì
  // yêu cầu nằm kẹt vĩnh viễn ở "Chờ tàu duyệt".
  const diThangLenCongTy =
    status === "PENDING_MASTER" && trinhThangLenCongTy(actor.role);
  const statusThat = diThangLenCongTy ? "PENDING_OFFICE" : status;
  const stamp: Record<string, unknown> = {};
  if (status === "PENDING_MASTER") {
    stamp.submittedBy = actor.name;
    stamp.submittedAt = now;
    if (diThangLenCongTy) {
      // Chữ ký cấp tàu chính là người lập — ghi lại để ô ký trên biểu mẫu và
      // bảng tiến độ không bị trống một bậc.
      stamp.shipApprovedBy = actor.name;
      stamp.shipApprovedRole = actor.role;
      stamp.shipApprovedAt = now;
    }
    // Trình lại sau khi bị từ chối: xóa vết từ chối cũ, nếu không bảng đỏ
    // "Yêu cầu bị từ chối" vẫn đứng nguyên trên một yêu cầu đang chờ duyệt.
    stamp.rejectedBy = null;
    stamp.rejectedAt = null;
    stamp.rejectionReason = null;
  } else if (status === "REJECTED") {
    stamp.rejectedBy = actor.name;
    stamp.rejectedAt = now;
    stamp.rejectionReason = note;
  }

  // Giữ lại để ghi nhật ký sau khi giao dịch xong — bên trong giao dịch chưa
  // chắc đi tới nơi, ghi sớm là ghi cả những lần bị rollback.
  let trangThaiCu = "";
  let tauCuaYeuCau: number | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.materialRequest.findUnique({
        where: { id },
        select: {
          status: true,
          vesselId: true,
          department: true,
          requestedById: true,
        },
      });
      if (!before) {
        throw new ActionError(t("actions.yeuCau_khongTimThay"));
      }
      if (!trongPhamVi(scope, before.vesselId)) {
        throw new ActionError(t("chung.khongCoQuyen"));
      }
      trangThaiCu = before.status;
      tauCuaYeuCau = before.vesselId;
      // Từ chối phải đúng cấp: người đang giữ bước duyệt mới được từ chối.
      // Không có kiểm tra này thì máy trưởng từ chối được yêu cầu đang nằm ở
      // bàn của công ty, và ngược lại.
      if (status === "REJECTED") {
        const capTuChoi = capDuyetChoPhep(actor, {
          vesselId: before.vesselId,
          status: before.status,
          department: before.department,
          requestedById: before.requestedById,
        });
        if (!capTuChoi) {
          throw new ActionError(
            before.status === "PENDING_OFFICE"
              ? t("actions.yeuCau_choCongTyDuyetMoiTuChoi")
              : t(khoaViSaoKhongDuyet(actor.role))
          );
        }
      }
      const result = await tx.materialRequest.updateMany({
        where: {
          id,
          status: { in: allowedFrom[status] },
          ...vesselWhere(scope),
        },
        data: { status: statusThat, ...stamp },
      });
      if (result.count === 0) {
        throw new ActionError(
          t("actions.yeuCau_khongChuyenDuocTrangThai", {
            tu: tTuDo(`labels.reqStatus_${before.status}`),
            den: tTuDo(`labels.reqStatus_${status}`),
          })
        );
      }
      if (diThangLenCongTy) {
        // Bỏ qua bước duyệt cấp tàu thì SL tàu duyệt phải bằng SL xin — trần
        // của cấp công ty là số tàu đã duyệt, để 0 thì họ chỉ duyệt được 0.
        const items = await tx.materialRequestItem.findMany({
          where: { requestId: id },
          select: { id: true, quantity: true },
        });
        for (const it of items) {
          await tx.materialRequestItem.update({
            where: { id: it.id },
            data: { approvedQuantity: it.quantity },
          });
        }
      }
      await logRequestEvent(tx, {
        requestId: id,
        fromStatus: before.status,
        toStatus: statusThat,
        actorName: actor.name,
        actorRole: actor.role,
        note:
          note ||
          (diThangLenCongTy
            ? `${ROLE_LABEL[actor.role] ?? actor.role} lập và trình — cấp tàu đã ký, chuyển thẳng lên công ty`
            : null),
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    throw error;
  }
  // Từ chối và hủy là những bước làm chết một yêu cầu — phải tra ngược được ai
  // đã bấm và vì lý do gì. Nhật ký duyệt (RequestEvent) chỉ có trên trang chi
  // tiết yêu cầu; khi soát toàn hệ thống người ta mở sổ nhật ký thao tác, mà ở
  // đó trước đây chỉ thấy "POST /requests/12" không rõ chuyện gì đã xảy ra.
  //
  // Ghi TRƯỚC redirect: redirect() ném NEXT_REDIRECT, đặt sau là không bao giờ
  // chạy tới.
  await ghiNhatKyNguoiDung(actor, {
    action:
      status === "REJECTED"
        ? "tu-choi-yeu-cau"
        : status === "CANCELLED"
          ? "huy-yeu-cau"
          : "doi-trang-thai-yeu-cau",
    path: `/requests/${id}`,
    vesselId: tauCuaYeuCau,
    detail:
      `#${id} ${REQUEST_STATUS_LABEL[trangThaiCu] ?? trangThaiCu} → ` +
      `${REQUEST_STATUS_LABEL[statusThat] ?? statusThat}` +
      (note ? `, lý do: ${note}` : ""),
  });
  revalidatePath("/requests");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteMaterialRequest(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_YEU_CAU]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  // returnTo mặc định về danh sách để không rơi vào trang chi tiết vừa bị xóa.
  const returnTo = safeNextPath(
    String(formData.get("returnTo") || ""),
    "/requests"
  );
  const request = await prisma.materialRequest.findUnique({ where: { id } });
  if (!request) {
    return { message: t("actions.yeuCau_daXoaHoacKhongTonTai") };
  }
  const scope = vesselScopeDayDu(actor);
  if (!trongPhamVi(scope, request.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  if (
    actor.role !== "ADMIN" &&
    !REQUEST_DELETABLE_BY_NON_ADMIN.includes(request.status)
  ) {
    return { message: t("actions.yeuCau_chiQuanTriXoaDuoc") };
  }
  try {
    await prisma.materialRequest.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: t("actions.yeuCau_daBiXoa") };
    }
    throw error;
  }
  // Xóa là thao tác duy nhất không để lại gì trong chính dữ liệu nghiệp vụ —
  // chứng từ biến mất cùng toàn bộ nhật ký duyệt của nó. Không ghi vết ở đây
  // thì không còn chỗ nào biết yêu cầu đó từng tồn tại.
  await ghiNhatKyNguoiDung(actor, {
    action: "xoa-yeu-cau",
    path: "/requests",
    vesselId: request.vesselId,
    detail:
      `Xóa yêu cầu #${id} (${request.requestNo}) — trạng thái ` +
      `${REQUEST_STATUS_LABEL[request.status] ?? request.status}` +
      `, người lập ${request.requestedBy}`,
  });
  revalidatePath("/requests");
  revalidatePath(returnTo);
  redirect(returnTo);
}

// ============ PURCHASING (MUA SẮM) ============

// Gán chuẩn biểu mẫu + Hull No cho một tàu.
export async function setVesselFormStandard(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const formStandard = String(formData.get("formStandard") || "");
  const hullNo = String(formData.get("hullNo") || "").trim();
  if (!Number.isInteger(id) || id <= 0 || !formStandard) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const std = await prisma.formStandard.findUnique({
    where: { code: formStandard },
  });
  if (!std || !std.isActive) {
    return { message: t("actions.bieuMau_khongHopLe") };
  }
  try {
    await prisma.vessel.update({
      where: { id },
      data: { formStandard, hullNo: hullNo || null },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: t("actions.tau_khongTimThay") };
    }
    throw error;
  }
  revalidatePath("/purchasing/forms");
  return { message: t("actions.daLuu"), success: true };
}

// Thêm một biểu mẫu (công ty quản lý) mới.
export async function createFormStandard(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "code",
    "label",
    "companyName",
    "address",
    "repAddress",
    "tel",
    "email",
    "website",
  ]);
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const label = String(formData.get("label") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (!code || !companyName || !address) {
    return {
      message: t("actions.bieuMau_maTenDiaChiBatBuoc"),
      values,
    };
  }
  try {
    await prisma.formStandard.create({
      data: {
        code,
        label: label || code,
        companyName,
        address,
        repAddress: String(formData.get("repAddress") || "").trim() || null,
        tel: String(formData.get("tel") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        website: String(formData.get("website") || "").trim() || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.bieuMau_maDaTonTai", { ma: code }), values };
    }
    throw error;
  }
  revalidatePath("/purchasing/forms");
  return { message: t("actions.bieuMau_daThem", { ma: code }), success: true };
}

// Sửa thông tin một biểu mẫu; nếu đổi mã thì cập nhật luôn các tàu đang gán mã cũ.
export async function updateFormStandard(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "code",
    "label",
    "companyName",
    "address",
    "repAddress",
    "tel",
    "email",
    "website",
  ]);
  const id = Number(formData.get("id"));
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const label = String(formData.get("label") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe"), values };
  }
  if (!code || !companyName || !address) {
    return { message: t("actions.bieuMau_maTenDiaChiBatBuoc"), values };
  }
  const existing = await prisma.formStandard.findUnique({ where: { id } });
  if (!existing) {
    return { message: t("actions.bieuMau_khongTimThay"), values };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.formStandard.update({
        where: { id },
        data: {
          code,
          label: label || code,
          companyName,
          address,
          repAddress: String(formData.get("repAddress") || "").trim() || null,
          tel: String(formData.get("tel") || "").trim() || null,
          email: String(formData.get("email") || "").trim() || null,
          website: String(formData.get("website") || "").trim() || null,
        },
      });
      if (code !== existing.code) {
        // Chuyển các tàu đang gán mã cũ sang mã mới để không đứt tham chiếu.
        await tx.vessel.updateMany({
          where: { formStandard: existing.code },
          data: { formStandard: code },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.bieuMau_maDaTonTai", { ma: code }), values };
    }
    throw error;
  }
  revalidatePath("/purchasing/forms");
  return { message: t("actions.bieuMau_daCapNhat"), success: true };
}

export async function setFormStandardActive(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const active = String(formData.get("active") || "") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const std = await prisma.formStandard.findUnique({ where: { id } });
  if (!std) {
    return { message: t("actions.bieuMau_khongTimThay") };
  }
  // Không cho ngừng dùng biểu mẫu vẫn còn tàu đang gán.
  if (!active) {
    const inUse = await prisma.vessel.count({
      where: { formStandard: std.code },
    });
    if (inUse > 0) {
      return { message: t("actions.bieuMau_conTauDangDung", { n: inUse }) };
    }
  }
  await prisma.formStandard.update({
    where: { id },
    data: { isActive: active },
  });
  revalidatePath("/purchasing/forms");
  return { message: "", success: true };
}

export async function deleteFormStandard(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const std = await prisma.formStandard.findUnique({ where: { id } });
  if (!std) {
    return { message: t("actions.bieuMau_khongTimThay") };
  }
  const inUse = await prisma.vessel.count({
    where: { formStandard: std.code },
  });
  if (inUse > 0) {
    return {
      message: t("actions.bieuMau_conTauDangDungKhongXoaDuoc", {
        n: inUse,
        ma: std.code,
      }),
    };
  }
  await prisma.formStandard.delete({ where: { id } });
  // Chuẩn biểu mẫu quyết định đầu chứng từ PO/RFQ gửi ra ngoài cho nhà cung
  // cấp. Xóa mất là mọi tàu đang dùng nó phải chuyển sang chuẩn khác, nên phải
  // biết ai đã bỏ chuẩn nào đi.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    // Chuẩn biểu mẫu dùng chung cả đội tàu — không thuộc tàu nào.
    vesselId: null,
    action: "xoa-bieu-mau",
    path: "/purchasing/forms",
    detail: `Xóa chuẩn biểu mẫu "${std.code}" (${std.label} — ${std.companyName})`,
  });
  revalidatePath("/purchasing/forms");
  return { message: "", success: true };
}

export async function createSupplier(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "contact",
    "email",
    "phone",
    "address",
  ]);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!code || !name) {
    return { message: t("actions.ncc_maVaTenBatBuoc"), values };
  }
  try {
    await prisma.supplier.create({
      data: {
        code,
        name,
        contact: String(formData.get("contact") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        address: String(formData.get("address") || "").trim() || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.ncc_maDaTonTai", { ma: code }), values };
    }
    throw error;
  }
  revalidatePath("/purchasing/suppliers");
  return { message: t("actions.ncc_daThem", { ten: name }), success: true };
}

export async function setSupplierActive(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const active = String(formData.get("active") || "") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  await prisma.supplier.update({ where: { id }, data: { isActive: active } });
  revalidatePath("/purchasing/suppliers");
  return { message: "", success: true };
}

// Sửa thông tin nhà cung cấp.
export async function updateSupplier(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "contact",
    "email",
    "phone",
    "address",
  ]);
  const id = Number(formData.get("id"));
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe"), values };
  }
  if (!code || !name) {
    return { message: t("actions.ncc_maVaTenBatBuoc"), values };
  }
  try {
    await prisma.supplier.update({
      where: { id },
      data: {
        code,
        name,
        contact: String(formData.get("contact") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        address: String(formData.get("address") || "").trim() || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { message: t("actions.ncc_maDaTonTai", { ma: code }), values };
      }
      if (error.code === "P2025") {
        return { message: t("actions.ncc_khongTimThay"), values };
      }
    }
    throw error;
  }
  revalidatePath("/purchasing/suppliers");
  revalidatePath("/purchasing");
  return { message: t("actions.ncc_daCapNhat"), success: true };
}

// Xóa nhà cung cấp — chặn khi đã có đơn mua tham chiếu (dùng Ngừng dùng thay thế).
export async function deleteSupplier(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return { message: t("actions.ncc_khongTimThay") };
  }
  const poCount = await prisma.purchaseOrder.count({
    where: { supplierId: id },
  });
  if (poCount > 0) {
    return { message: t("actions.ncc_daCoDonMua", { n: poCount }) };
  }
  await prisma.supplier.delete({ where: { id } });
  // Nhà cung cấp chưa có đơn nào mới xóa được, nhưng hồ sơ liên hệ vẫn là dữ
  // liệu người khác đã nhập tay; mất mà không biết ai xóa thì không truy lại
  // được đó là dọn rác hay xóa nhầm.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    // Nhà cung cấp dùng chung cả đội tàu — không thuộc tàu nào.
    vesselId: null,
    action: "xoa-nha-cung-cap",
    path: "/purchasing/suppliers",
    detail: `Xóa nhà cung cấp "${supplier.code}" (${supplier.name})`,
  });
  revalidatePath("/purchasing/suppliers");
  return { message: "", success: true };
}

// Nhập danh mục vật tư/phụ tùng cho một tàu từ file Excel (MLS-11-06) hoặc Word (MLS-11-04).
export async function importMaterials(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t, tTuDo } = await layT();
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: t("actions.vuiLongChonTau") };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: t("actions.danhMuc_chiTauMinhPhuTrach") };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return { message: t("actions.tau_khongTonTai") };
  }
  const kind = String(formData.get("kind") || "STORE");
  if (!["STORE", "SPARE"].includes(kind)) {
    return { message: t("actions.vatTu_loaiKhongHopLe") };
  }
  // Kho ghi tồn (tùy chọn) — phải thuộc tàu đã chọn.
  const warehouseRaw = String(formData.get("warehouseId") || "");
  let warehouseId: number | null = null;
  // "AUTO" = định tuyến theo sheet: Phụ tùng→kho máy, Boong→kho boong, còn lại→kho tiêu hao.
  let warehouseByKind: Partial<
    Record<"ENG" | "DECK" | "STORE", number>
  > | null = null;
  if (warehouseRaw === "AUTO") {
    const vesselWarehouses = await prisma.warehouse.findMany({
      where: { vesselId },
      select: { id: true, code: true },
    });
    const map: Partial<Record<"ENG" | "DECK" | "STORE", number>> = {};
    for (const w of vesselWarehouses) {
      if (/-ENG$/i.test(w.code)) map.ENG = w.id;
      else if (/-DECK$/i.test(w.code)) map.DECK = w.id;
      else if (/-STORE$/i.test(w.code)) map.STORE = w.id;
    }
    if (!map.ENG && !map.DECK && !map.STORE) {
      return { message: t("actions.kho_khongTuDinhTuyenDuoc") };
    }
    warehouseByKind = map;
  } else if (warehouseRaw) {
    const wid = Number(warehouseRaw);
    if (!Number.isInteger(wid) || wid <= 0) {
      return { message: t("actions.kho_khongHopLe") };
    }
    const warehouse = await prisma.warehouse.findUnique({ where: { id: wid } });
    if (!warehouse || warehouse.vesselId !== vesselId) {
      return { message: t("actions.kho_khongThuocTauDaChon") };
    }
    warehouseId = wid;
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: t("actions.nhap_vuiLongChonFile") };
  }
  const ext = fileExtension(file.name);
  if (![".xls", ".xlsx", ".doc", ".docx"].includes(ext)) {
    return { message: t("actions.nhap_fileSaiDinhDang") };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { message: t("actions.nhap_fileQua10MB") };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { parseMaterialExcel, parseMaterialDoc } = await import(
    "@/lib/materialImport"
  );
  const parsed = [".xls", ".xlsx"].includes(ext)
    ? parseMaterialExcel(buffer)
    : await parseMaterialDoc(buffer);
  if (parsed.error) {
    return { message: parsed.error };
  }

  const { applyMaterialImport } = await import("@/lib/materialImportApply");
  const { createdCount, linkedCount, robCount, conflict, khoiDay } =
    await applyMaterialImport({
      vesselId,
      warehouseId,
      warehouseByKind,
      fallbackKind: kind,
      items: parsed.items,
      fileName: file.name,
      actorName: actor.name,
    });
  if (conflict) {
    return { message: t("actions.nhap_trungMaDoDongThoi") };
  }

  revalidatePath("/materials");
  revalidatePath("/inventory");
  const parts = [
    t("actions.nhap_daNhapDong", {
      n: parsed.items.length,
      tau: vessel.name,
    }),
    t("actions.nhap_vatTuMoi", { n: createdCount }),
    t("actions.nhap_vatTuDaCo", { n: linkedCount }),
  ];
  if (robCount > 0) parts.push(t("actions.nhap_dongGhiTon", { n: robCount }));
  if (parsed.skippedRows > 0)
    parts.push(t("actions.nhap_dongBoQua", { n: parsed.skippedRows }));
  // Báo ngay khi bố cục khối bắt đầu chật: mã vẫn đúng và không trùng, chỉ là
  // hàng mới không còn nằm cạnh hàng cùng nhóm nữa. Để im thì danh mục cứ lộn
  // xộn dần cho tới lúc không ai lần ra vì sao.
  if (khoiDay?.length) {
    parts.push(
      t("actions.nhap_khoiMaDaKin", { khuon: khoiDay.join(", ") })
    );
  }
  // Liệt kê từng sheet để người dùng đối chiếu — file kiểm kê thật tách nhiều sheet
  // theo bộ phận, im lặng bỏ sót một sheet là mất cả trăm dòng mà không ai biết.
  if (parsed.sheets?.length) {
    const read = parsed.sheets.filter((s) => !s.skipped);
    const ignored = parsed.sheets.filter((s) => s.skipped);
    if (read.length) {
      parts.push(
        t("actions.nhap_sheetDaDoc", {
          ds: read
            .map((s) =>
              s.materialType
                ? t("actions.nhap_sheetMoTa", {
                    ten: s.name,
                    n: s.count,
                    loai: tTuDo(`labels.type_${s.materialType}`),
                  })
                : t("actions.nhap_sheetMoTaKhongLoai", {
                    ten: s.name,
                    n: s.count,
                  })
            )
            .join("; "),
        })
      );
    }
    if (ignored.length) {
      parts.push(
        t("actions.nhap_sheetBoQua", {
          ds: ignored.map((s) => s.name).join("; "),
        })
      );
    }
  }
  if (parsed.truncated) {
    parts.push(t("actions.nhap_vuotGioiHan3000"));
  }
  return { message: parts.join(" · "), success: true };
}

// Tạo IFQ/PO trực tiếp từ Phòng Kỹ thuật - Vật tư (không cần yêu cầu từ tàu):
// dòng vật tư nhập tay và/hoặc đọc từ file Excel theo form công ty.
export async function createDirectPurchaseOrder(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const scope = vesselScopeDayDu(actor);
  const vesselId = Number(formData.get("vesselId"));
  const supplierId = Number(formData.get("supplierId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: t("actions.vuiLongChonTau") };
  }
  if (!trongPhamVi(scope, vesselId)) {
    return { message: t("actions.muaSam_chiTauMinhPhuTrach") };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return { message: t("actions.tau_khongTonTai") };
  }
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return { message: t("actions.vuiLongChonNcc") };
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier || !supplier.isActive) {
    return { message: t("actions.ncc_khongHopLe") };
  }
  const currency = String(formData.get("currency") || "USD").trim() || "USD";
  const notes = String(formData.get("notes") || "").trim() || null;
  const subject = String(formData.get("subject") || "").trim() || null;
  const supplierRef = String(formData.get("supplierRef") || "").trim() || null;
  const finiteOrZero = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const discountPercent = Math.min(
    100,
    finiteOrZero(formData.get("discountPercent"))
  );
  const transportFee = finiteOrZero(formData.get("transportFee"));
  const deliveryFee = finiteOrZero(formData.get("deliveryFee"));
  const expectedRaw = String(formData.get("expectedDate") || "");
  let expectedDate: Date | null = null;
  if (expectedRaw) {
    const d = new Date(expectedRaw);
    if (!isNaN(d.getTime())) expectedDate = d;
  }

  type DirectLine = {
    description: string;
    partNo: string | null;
    uom: string;
    quantity: number;
    unitPrice: number;
  };
  const lines: DirectLine[] = [];
  let skippedRows = 0;

  // 1) Dòng từ file Excel theo form công ty (nếu có)
  const excel = formData.get("excel");
  if (excel instanceof File && excel.size > 0) {
    const ext = fileExtension(excel.name);
    if (![".xls", ".xlsx"].includes(ext)) {
      return { message: t("actions.donMua_fileExcelSaiDinhDang") };
    }
    if (excel.size > 10 * 1024 * 1024) {
      return { message: t("actions.donMua_fileExcelQua10MB") };
    }
    const { parsePurchaseExcel } = await import("@/lib/excelPurchase");
    const parsed = parsePurchaseExcel(Buffer.from(await excel.arrayBuffer()));
    if (parsed.error) {
      return { message: parsed.error };
    }
    lines.push(...parsed.lines);
    skippedRows = parsed.skippedRows;
  }

  // 2) Dòng nhập tay: line_desc_i / line_pn_i / line_uom_i / line_qty_i / line_price_i
  const manualIdx = [...formData.keys()]
    .filter((k) => k.startsWith("line_desc_"))
    .map((k) => Number(k.slice("line_desc_".length)))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);
  for (const i of manualIdx) {
    const description = String(formData.get(`line_desc_${i}`) || "").trim();
    const qtyRaw = String(formData.get(`line_qty_${i}`) || "").trim();
    if (!description && !qtyRaw) continue; // dòng trống — bỏ qua
    const qty = Number(qtyRaw);
    if (!description) {
      return {
        message: t("actions.donMua_dongNhapTayThieuMoTa", { stt: i + 1 }),
      };
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        message: t("actions.donMua_dongSoLuongKhongHopLe", {
          moTa: description.slice(0, 40),
        }),
      };
    }
    lines.push({
      description,
      partNo: String(formData.get(`line_pn_${i}`) || "").trim() || null,
      uom: String(formData.get(`line_uom_${i}`) || "").trim() || "PCS",
      quantity: qty,
      unitPrice: finiteOrZero(formData.get(`line_price_${i}`)),
    });
  }

  if (!lines.length) {
    return { message: t("actions.donMua_chuaCoDongNao") };
  }
  if (lines.length > 200) {
    return { message: t("actions.donMua_toiDa200Dong") };
  }

  // Cấp số PO và ghi đơn trong CÙNG một giao dịch, để sinhSoDonMua xin được
  // khóa tư vấn. Đây là cửa cấp số thứ hai, dùng chung dãy số với
  // createPurchaseOrder: chỉ một trong hai cửa xin khóa thì cửa kia vẫn chạy
  // song song, cả hai cùng đọc thấy số lớn nhất giống nhau, cùng sinh một poNo,
  // và bên commit sau vỡ P2002 — người lập đơn trực tiếp mất trắng tới 200 dòng
  // vừa nhập từ Excel.
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const poNo = await sinhSoDonMua(tx, vesselId);
      return tx.purchaseOrder.create({
        data: {
          poNo,
          supplierId,
          vesselId,
          status: "DRAFT",
          currency,
          orderDate: new Date(),
          expectedDate,
          notes,
          subject,
          supplierRef,
          discountPercent,
          transportFee,
          deliveryFee,
          createdBy: `${actor.name} (KT-VT)`,
          items: { create: lines },
        },
      });
    }, GIAO_DICH_GIU_KHOA);
  } catch (error) {
    const thongBao = thongBaoLoiGiaoDich(t, error);
    if (thongBao) {
      return { message: thongBao };
    }
    throw error;
  }
  revalidatePath("/purchasing");
  redirect(
    `/purchasing/${created.id}${skippedRows > 0 ? `?skipped=${skippedRows}` : ""}`
  );
}

// Tạo đơn mua hàng từ các dòng yêu cầu đã duyệt đã chọn.
export async function createPurchaseOrder(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const scope = vesselScopeDayDu(actor);
  const vesselId = Number(formData.get("vesselId"));
  const supplierId = Number(formData.get("supplierId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: t("actions.tau_khongHopLe") };
  }
  if (!trongPhamVi(scope, vesselId)) {
    return { message: t("actions.muaSam_chiTauMinhPhuTrach") };
  }
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return { message: t("actions.vuiLongChonNcc") };
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier || !supplier.isActive) {
    return { message: t("actions.ncc_khongHopLe") };
  }
  const currency = String(formData.get("currency") || "USD").trim() || "USD";
  const notes = String(formData.get("notes") || "").trim() || null;
  const subject = String(formData.get("subject") || "").trim() || null;
  const supplierRef = String(formData.get("supplierRef") || "").trim() || null;
  const finiteOrZero = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const discountPercent = Math.min(100, finiteOrZero(formData.get("discountPercent")));
  const transportFee = finiteOrZero(formData.get("transportFee"));
  const deliveryFee = finiteOrZero(formData.get("deliveryFee"));
  const expectedRaw = String(formData.get("expectedDate") || "");
  let expectedDate: Date | null = null;
  if (expectedRaw) {
    const d = new Date(expectedRaw);
    if (!isNaN(d.getTime())) expectedDate = d;
  }
  // Các dòng yêu cầu được chọn: chk_<requestItemId> = "on", price_<id>, qty_<id>
  const selectedIds = [...formData.keys()]
    .filter((k) => k.startsWith("chk_"))
    .map((k) => Number(k.slice(4)))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!selectedIds.length) {
    return { message: t("actions.donMua_chonItNhatMotDong") };
  }
  // Chặn số dòng ngang với createDirectPurchaseOrder. Mỗi dòng là một INSERT
  // nằm trong giao dịch đang giữ khóa, nên đơn càng dài thì người xếp hàng sau
  // càng lâu được vào; không chặn thì độ dài đơn phụ thuộc hoàn toàn vào việc
  // người dùng tick bao nhiêu ô.
  if (selectedIds.length > 200) {
    return { message: t("actions.donMua_toiDa200Dong") };
  }
  // Nới 1e-9 vì số lượng là Float: 10 chia ba lần rồi cộng lại có thể ra
  // 10.000000000000002, chặn cứng sẽ báo vượt oan.
  const NGUONG_LAM_TRON = 1e-9;
  // Đọc dòng yêu cầu, tính trần, rồi ghi đơn — tất cả trong CÙNG một giao dịch,
  // sau khi sinhSoDonMua đã xin khóa tư vấn theo dãy số PO của tàu.
  //
  // Đọc ngoài giao dịch thì mọi căn cứ để chặn đều là ảnh chụp TRƯỚC lúc xếp
  // hàng: hai người cùng mở /purchasing/new, cùng thấy dòng duyệt 10 còn nguyên
  // 10, cả hai cùng qua cửa kiểm tra; khóa chỉ xếp hàng phần cấp số nên cả hai
  // đơn vẫn được ghi, chỉ khác số PO — đặt 20 cho một dòng duyệt 10. Đọc lại
  // dưới khóa thì người vào sau nhìn thấy đơn của người vào trước.
  //
  // Phải nhận cả PARTIALLY_DELIVERED: receivePurchaseOrder tự cuộn yêu cầu sang
  // trạng thái đó ngay lần nhận thiếu đầu tiên, mà không có đường quay lại
  // IN_PROCUREMENT. Chỉ lọc IN_PROCUREMENT thì phần hàng còn thiếu vĩnh viễn
  // không lập được đơn mua bổ sung.
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const poNo = await sinhSoDonMua(tx, vesselId);
      const requestItems = await tx.materialRequestItem.findMany({
        where: {
          id: { in: selectedIds },
          request: {
            vesselId,
            status: { in: ["IN_PROCUREMENT", "PARTIALLY_DELIVERED"] },
          },
        },
        include: {
          material: true,
          // Bỏ SL của các đơn đã hủy ra ngoài, để dòng đó mua lại được — giống
          // hệt bộ lọc của trang /purchasing/new.
          poItems: { where: { po: { status: { not: "CANCELLED" } } } },
        },
      });
      if (!requestItems.length) {
        throw new ActionError(t("actions.donMua_khongCoDongHopLe"));
      }
      // Trần đặt mua của mỗi dòng là phần CÒN LẠI của số đã duyệt, đo bằng SỐ
      // ĐÃ ĐẶT — tổng dòng đơn của các PO chưa hủy — đúng công thức mà
      // app/(app)/purchasing/new/page.tsx dùng để hiện "SL cần mua". Server và
      // màn hình phải đo bằng cùng một cây thước, nếu không thì cái người dùng
      // nhìn thấy và cái server chấp nhận là hai chuyện khác nhau.
      //
      // Tuyệt đối không đo bằng suppliedQuantity: cột đó chỉ tăng lúc NHẬN
      // HÀNG, nên chừng nào hàng chưa về thì nó vẫn bằng 0 và cùng một dòng
      // duyệt 10 được đặt lại 10 qua bao nhiêu đơn cũng lọt. Ô số lượng nằm
      // trong biểu mẫu (lại còn prefill sẵn phần còn lại) nên chỉ cần bấm Tạo
      // đơn hai lần từ hai tab đã mở là đủ; hàng và tiền vượt ra ngoài phê
      // duyệt, và khi cả hai đơn về kho thì suppliedQuantity vượt
      // approvedQuantity nên tiến độ cấp phát của yêu cầu vĩnh viễn không khớp.
      const vuotDuyet: string[] = [];
      const lines = requestItems.map((ri) => {
        const ten = ri.material ? ri.material.nameVn : (ri.itemName ?? "—");
        const donVi = ri.material ? ri.material.uom : (ri.itemUom ?? "PCS");
        const priceRaw = Number(formData.get(`price_${ri.id}`));
        const qtyRaw = Number(formData.get(`qty_${ri.id}`));
        const approved =
          ri.approvedQuantity > 0 ? ri.approvedQuantity : ri.quantity;
        const daDat = ri.poItems.reduce((tong, p) => tong + p.quantity, 0);
        const remaining = Math.max(0, approved - daDat);
        // Bỏ trống ô số lượng = đặt nốt phần còn lại. Trước đây khi remaining = 0
        // nó lại lùi về `approved`, tức tự động đặt lại từ đầu một dòng đã đặt đủ.
        const quantity =
          Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : remaining;
        if (remaining <= NGUONG_LAM_TRON) {
          vuotDuyet.push(
            t("actions.donMua_daDatDu", {
              ten,
              sl: approved,
              dvt: donVi,
            })
          );
        } else if (quantity > remaining + NGUONG_LAM_TRON) {
          vuotDuyet.push(
            t("actions.donMua_vuotConLai", {
              ten,
              dat: quantity,
              dvt: donVi,
              conLai: remaining,
              duyet: approved,
              daDat: daDat,
              vuot: quantity - remaining,
            })
          );
        }
        return {
          requestItemId: ri.id,
          materialId: ri.materialId,
          description: ten,
          partNo: ri.material
            ? (ri.material.partNumber ?? ri.material.impa ?? null)
            : (ri.itemCode ?? null),
          uom: donVi,
          quantity,
          unitPrice: Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0,
        };
      });
      if (vuotDuyet.length) {
        throw new ActionError(
          t("actions.donMua_vuotSoDuyet", { chiTiet: vuotDuyet.join("; ") })
        );
      }
      return tx.purchaseOrder.create({
        data: {
          poNo,
          supplierId,
          vesselId,
          status: "DRAFT",
          currency,
          orderDate: new Date(),
          expectedDate,
          notes,
          subject,
          supplierRef,
          discountPercent,
          transportFee,
          deliveryFee,
          createdBy: actor.name,
          items: { create: lines },
        },
      });
    }, GIAO_DICH_GIU_KHOA);
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    const thongBao = thongBaoLoiGiaoDich(t, error);
    if (thongBao) {
      return { message: thongBao };
    }
    throw error;
  }
  revalidatePath("/purchasing");
  redirect(`/purchasing/${created.id}`);
}

const PO_ALLOWED_FROM: Record<string, string[]> = {
  SENT: ["DRAFT"],
  CONFIRMED: ["SENT"],
  CLOSED: ["RECEIVED", "PARTIALLY_RECEIVED"],
  CANCELLED: ["DRAFT", "SENT", "CONFIRMED"],
};

export async function updatePurchaseOrderStatus(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "");
  if (!Number.isInteger(id) || id <= 0 || !PO_ALLOWED_FROM[status]) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) {
    return { message: t("actions.donMua_khongTimThay") };
  }
  const scope = vesselScopeDayDu(actor);
  if (!trongPhamVi(scope, po.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  const result = await prisma.purchaseOrder.updateMany({
    where: { id, status: { in: PO_ALLOWED_FROM[status] } },
    data: { status },
  });
  if (result.count === 0) {
    return { message: t("actions.donMua_daDoiTrangThai") };
  }
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${id}`);
  return { message: "", success: true };
}

// Nhận hàng: nhập kho + cập nhật tiến độ giao của yêu cầu, cuộn trạng thái PO.
export async function receivePurchaseOrder(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const warehouseId = Number(formData.get("warehouseId"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po) {
    return { message: t("actions.donMua_khongTimThay") };
  }
  const scope = vesselScopeDayDu(actor);
  if (!trongPhamVi(scope, po.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  if (!["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    return { message: t("actions.donMua_chiNhanKhiDaGui") };
  }
  // Kho nhận phải thuộc tàu của đơn (chỉ bắt buộc khi có dòng gắn vật tư danh mục).
  const hasMaterialLine = po.items.some((it) => it.materialId !== null);
  let warehouse = null;
  if (Number.isInteger(warehouseId) && warehouseId > 0) {
    warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse || warehouse.vesselId !== po.vesselId) {
      return { message: t("actions.kho_nhanKhongThuocTauCuaDon") };
    }
  } else if (hasMaterialLine) {
    return { message: t("actions.kho_vuiLongChonKhoNhan") };
  }

  // SL người dùng muốn nhận cho từng dòng (chưa kẹp — kẹp lại trong transaction từ dữ liệu mới).
  const requestedByItem = new Map<number, number>();
  for (const it of po.items) {
    const raw = Number(formData.get(`recv_${it.id}`));
    if (Number.isFinite(raw) && raw > 0) requestedByItem.set(it.id, raw);
  }
  if (requestedByItem.size === 0) {
    return { message: t("actions.donMua_chuaNhapSoLuongNhan") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Đọc lại PO + dòng MỚI TRONG transaction để tránh nhận trùng (double-submit).
      const fresh = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!fresh) throw new ActionError(t("actions.donMua_khongTimThay"));
      if (
        !["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(fresh.status)
      ) {
        throw new ActionError(t("actions.donMua_daDoiTrangThai"));
      }
      // Xin khóa tồn kho TRƯỚC vòng lặp, y hệt createInventoryTransaction.
      // Đường nhận hàng bên dưới cũng upsert vào Inventory trên cùng cặp (vật
      // tư, kho); nếu chỉ một trong hai đường xin khóa thì đường kia vẫn chạy
      // song song, cả hai cùng thấy cặp đó "chưa có dòng tồn" và cùng INSERT —
      // bên thua vỡ P2002 trên ràng buộc materialId_warehouseId, mà khối catch
      // ở đây chỉ giữ ActionError nên lỗi bay ra màn hình 500.
      //
      // Gom hết khóa cần xin rồi xin theo thứ tự TĂNG DẦN: hai đơn nhiều dòng
      // chạm cùng một nhóm dòng tồn mà xin theo thứ tự khác nhau là kẹp chết
      // nhau (deadlock), thứ tự chung thì không bao giờ có vòng chờ.
      if (warehouse) {
        const khoNhan = warehouse;
        const khoaCanXin = [
          ...new Set(
            fresh.items
              .filter((it) => (requestedByItem.get(it.id) ?? 0) > 0)
              .map((it) => it.materialId)
              .filter((materialId): materialId is number => materialId !== null)
              .map((materialId) => khoaDongTon(materialId, khoNhan.id))
          ),
        ].sort((a, b) => a - b);
        for (const khoa of khoaCanXin) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO}::int, ${khoa}::int)`;
        }
      }
      const affectedRequestIds = new Set<number>();
      let totalReceived = 0;
      for (const item of fresh.items) {
        const desired = requestedByItem.get(item.id) ?? 0;
        const remaining = Math.max(0, item.quantity - item.quantityReceived);
        const qty = Math.min(desired, remaining);
        if (qty <= 0) continue;
        totalReceived += qty;
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: { increment: qty },
            warehouseId:
              item.materialId && warehouse ? warehouse.id : item.warehouseId,
          },
        });
        // Nhập kho cho vật tư có trong danh mục
        if (item.materialId && warehouse) {
          await tx.inventory.upsert({
            where: {
              materialId_warehouseId: {
                materialId: item.materialId,
                warehouseId: warehouse.id,
              },
            },
            update: { quantity: { increment: qty }, vesselId: fresh.vesselId },
            create: {
              materialId: item.materialId,
              warehouseId: warehouse.id,
              vesselId: fresh.vesselId,
              quantity: qty,
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              type: "IN",
              materialId: item.materialId,
              warehouseId: warehouse.id,
              vesselId: fresh.vesselId,
              quantity: qty,
              note: `Nhận hàng ${fresh.poNo}`,
              performedBy: actor.name,
            },
          });
        }
        // Cập nhật tiến độ giao của dòng yêu cầu
        if (item.requestItemId) {
          const ri = await tx.materialRequestItem.update({
            where: { id: item.requestItemId },
            data: { suppliedQuantity: { increment: qty } },
          });
          affectedRequestIds.add(ri.requestId);
        }
      }
      if (totalReceived === 0) {
        throw new ActionError(t("actions.donMua_daNhanDu"));
      }
      // Cuộn trạng thái PO
      const freshItems = await tx.purchaseOrderItem.findMany({
        where: { poId: id },
      });
      const allReceived = freshItems.every(
        (it) => it.quantityReceived >= it.quantity
      );
      const anyReceived = freshItems.some((it) => it.quantityReceived > 0);
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived
            ? "RECEIVED"
            : anyReceived
              ? "PARTIALLY_RECEIVED"
              : fresh.status,
        },
      });
      // Cuộn trạng thái giao của các yêu cầu liên quan
      for (const reqId of affectedRequestIds) {
        const req = await tx.materialRequest.findUnique({
          where: { id: reqId },
          include: { items: true },
        });
        if (!req) continue;
        if (["CLOSED", "CANCELLED", "REJECTED"].includes(req.status)) continue;
        const allDelivered = req.items.every((it) => {
          const target =
            it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
          return it.suppliedQuantity >= target;
        });
        const anyDelivered = req.items.some((it) => it.suppliedQuantity > 0);
        await tx.materialRequest.update({
          where: { id: reqId },
          data: {
            status: allDelivered
              ? "FULLY_DELIVERED"
              : anyDelivered
                ? "PARTIALLY_DELIVERED"
                : req.status,
          },
        });
      }
    }, GIAO_DICH_GIU_KHOA);
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    const thongBao = thongBaoLoiGiaoDich(t, error);
    if (thongBao) {
      return { message: thongBao };
    }
    throw error;
  }
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${id}`);
  revalidatePath("/requests");
  revalidatePath("/inventory");
  return { message: t("actions.donMua_daGhiNhanNhanHang"), success: true };
}

export async function createLashingReport(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{ message: string; values?: Record<string, string> }> {
  const echoValues = () => {
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        values[key] = value;
      }
    }
    return values;
  };
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen"), values: echoValues() };
  }
  const scope = vesselScopeDayDu(actor);
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: t("actions.tau_khongHopLe"), values: echoValues() };
  }
  if (!trongPhamVi(scope, vesselId)) {
    return {
      message: t("actions.baoCao_chiTauMinhPhuTrach"),
      values: echoValues(),
    };
  }
  const reportDateRaw = String(formData.get("reportDate") || "");
  const reportDate = new Date(reportDateRaw);
  if (isNaN(reportDate.getTime())) {
    return { message: t("actions.baoCao_ngayKhongHopLe"), values: echoValues() };
  }
  const voyageNo = String(formData.get("voyageNo") || "").trim();
  const position = String(formData.get("position") || "").trim();
  const gears = await prisma.lashingGear.findMany({
    where: { vesselId },
    orderBy: { sortOrder: "asc" },
  });
  if (!gears.length) {
    return {
      message: t("actions.changBuoc_chuaCoDanhMuc"),
      values: echoValues(),
    };
  }
  const lines = [];
  for (const gear of gears) {
    const rawIn = formData.get(`inOrder_${gear.id}`);
    const rawOut = formData.get(`outOfOrder_${gear.id}`);
    if (rawIn === null || rawOut === null) {
      return {
        message: t("actions.changBuoc_danhMucVuaDoi"),
        values: echoValues(),
      };
    }
    const inOrder = Number(rawIn);
    const outOfOrder = Number(rawOut);
    lines.push({
      gearId: gear.id,
      gearName: gear.name,
      partNo: gear.partNo,
      minQty: gear.minQty,
      standardQty: gear.standardQty,
      inOrder: Number.isFinite(inOrder) && inOrder >= 0 ? inOrder : 0,
      outOfOrder:
        Number.isFinite(outOfOrder) && outOfOrder >= 0 ? outOfOrder : 0,
    });
  }
  const report = await prisma.lashingReport.create({
    data: {
      vesselId,
      reportDate,
      voyageNo: voyageNo || null,
      position: position || null,
      createdBy: actor.name,
      lines: { create: lines },
    },
  });
  revalidatePath("/lashing");
  redirect(`/lashing/${report.id}`);
}

export async function updateLashingGear(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "name",
    "partNo",
    "minQty",
    "standardQty",
  ]);
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const partNo = String(formData.get("partNo") || "").trim();
  const minQty = Number(formData.get("minQty") || 0);
  const standardQty = Number(formData.get("standardQty") || 0);
  if (!Number.isInteger(id) || id <= 0 || !name) {
    return { message: t("chung.duLieuKhongHopLe"), values };
  }
  if (!(minQty >= 0) || !(standardQty >= 0)) {
    return { message: t("actions.soLuongKhongHopLe"), values };
  }
  try {
    await prisma.lashingGear.update({
      where: { id },
      data: { name, partNo: partNo || null, minQty, standardQty },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: t("actions.changBuoc_khongTimThayDungCu"), values };
      }
      if (error.code === "P2002") {
        return {
          message: t("actions.changBuoc_tenDaTonTai", { ten: name }),
          values,
        };
      }
    }
    throw error;
  }
  revalidatePath("/lashing");
  return { message: t("actions.daLuu"), success: true };
}

export async function createLashingGear(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "name",
    "partNo",
    "minQty",
    "standardQty",
  ]);
  const vesselId = Number(formData.get("vesselId"));
  const name = String(formData.get("name") || "").trim();
  const partNo = String(formData.get("partNo") || "").trim();
  const minQty = Number(formData.get("minQty") || 0);
  const standardQty = Number(formData.get("standardQty") || 0);
  if (!Number.isInteger(vesselId) || vesselId <= 0 || !name) {
    return { message: t("actions.changBuoc_tenBatBuoc"), values };
  }
  if (!(minQty >= 0) || !(standardQty >= 0)) {
    return { message: t("actions.soLuongKhongHopLe"), values };
  }
  const maxOrder = await prisma.lashingGear.aggregate({
    where: { vesselId },
    _max: { sortOrder: true },
  });
  try {
    await prisma.lashingGear.create({
      data: {
        vesselId,
        name,
        partNo: partNo || null,
        minQty,
        standardQty,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        message: t("actions.changBuoc_tenDaTonTai", { ten: name }),
        values,
      };
    }
    throw error;
  }
  revalidatePath("/lashing");
  return { message: t("actions.changBuoc_daThem", { ten: name }), success: true };
}

export async function deleteLashingGear(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const lineCount = await prisma.lashingReportLine.count({
    where: { gearId: id },
  });
  if (lineCount > 0) {
    return { message: t("actions.changBuoc_daCoTrongBaoCao") };
  }
  let daXoa;
  try {
    daXoa = await prisma.lashingGear.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: t("actions.changBuoc_khongTimThayDungCu") };
    }
    throw error;
  }
  // Dụng cụ chằng buộc bị bỏ khỏi danh mục là lần kiểm đếm sau không còn dòng
  // đó nữa — nhìn báo cáo sẽ tưởng tàu chưa bao giờ có món này. Ghi lại để
  // phân biệt "bỏ khỏi danh mục" với "chưa từng khai".
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    vesselId: daXoa.vesselId,
    action: "xoa-dung-cu-chang-buoc",
    path: "/lashing",
    detail:
      `Xóa dụng cụ chằng buộc #${id} ("${daXoa.name}"` +
      `, part no ${daXoa.partNo ?? "không có"}) của tàu ${daXoa.vesselId}`,
  });
  revalidatePath("/lashing");
  return { message: "", success: true };
}

const REPORT_TYPES = ["MLS-11-01", "MLS-11-04", "MLS-11-13", "KHÁC"];

export async function uploadReportDocument(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_YEU_CAU]);
  if (!actor) {
    return { message: t("chung.khongCoQuyen") };
  }
  const scope = vesselScopeDayDu(actor);
  const values = formValues(formData, [
    "vesselId",
    "reportType",
    "period",
    "title",
    "note",
  ]);
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: t("actions.tau_khongHopLe"), values };
  }
  if (!trongPhamVi(scope, vesselId)) {
    return {
      message: scope.unassigned
        ? t("actions.hoSo_chuaGanTau")
        : t("actions.hoSo_chiTauMinhPhuTrach"),
      values,
    };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return { message: t("actions.tau_khongTonTai"), values };
  }
  const reportType = String(formData.get("reportType") || "");
  if (!REPORT_TYPES.includes(reportType)) {
    return { message: t("actions.hoSo_loaiBaoCaoKhongHopLe"), values };
  }
  const period = String(formData.get("period") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: t("actions.hoSo_vuiLongChonFile"), values };
  }
  const ext = fileExtension(file.name);
  const allowed = ALLOWED_EXTENSIONS[ext];
  if (!allowed) {
    return {
      message: t("actions.hoSo_dinhDangKhongHoTro"),
      values,
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { message: t("actions.hoSo_fileQua20MB"), values };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const storedName = `${randomUUID()}${ext}`;
  const dir = await ensureUploadDir();
  const fullPath = path.join(dir, storedName);
  await writeFile(fullPath, buffer);
  try {
    await prisma.reportDocument.create({
      data: {
        vesselId,
        title: title || file.name,
        reportType,
        period: period || null,
        fileName: file.name,
        storedName,
        mimeType: allowed.mime,
        size: file.size,
        sha256,
        note: note || null,
        uploadedById: actor.id,
      },
    });
  } catch (error) {
    // Ghi DB lỗi -> dọn file vừa ghi để không để lại file mồ côi trên đĩa
    await unlink(fullPath).catch(() => {});
    throw error;
  }
  revalidatePath("/documents");
  return {
    message: t("actions.hoSo_daLuuFile", {
      ten: file.name,
      tau: vessel.code,
      bam: sha256.slice(0, 16),
    }),
    success: true,
  };
}

export async function deleteReportDocument(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const doc = await prisma.reportDocument.findUnique({ where: { id } });
  if (!doc) {
    return { message: t("actions.hoSo_khongTimThay") };
  }
  await prisma.reportDocument.delete({ where: { id } });
  // Ghi vết TRƯỚC khi đụng tới đĩa: bản ghi đã mất, file sắp mất, và dòng nhật
  // ký này là thứ duy nhất còn lại. deleteUser từ chối xóa tài khoản đã nộp
  // file với lý do "file là bản lưu bất biến, phải giữ được vết ai đã nộp" —
  // giữ vết người nộp mà không giữ vết người xóa thì lập luận đó tự mâu thuẫn,
  // và khi thanh tra hỏi hồ sơ PSC đâu thì không ai trả lời được.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    // Tàu của hồ sơ, không phải tàu của ông quản trị (xem createUser).
    vesselId: doc.vesselId,
    action: "xoa-ho-so",
    path: "/documents",
    detail:
      `Xóa hồ sơ #${id} "${doc.title}" (${doc.reportType}` +
      `${doc.period ? `, kỳ ${doc.period}` : ""}) — file ${doc.fileName}` +
      `, người nộp #${doc.uploadedById}`,
  });
  try {
    await unlink(path.join(getUploadDir(), path.basename(doc.storedName)));
  } catch {
    // file đã không còn trên đĩa — bỏ qua
  }
  revalidatePath("/documents");
  return { message: "", success: true };
}

// Danh sách vai trò hợp lệ lấy thẳng từ lib/roles.ts — trước đây là một mảng
// chép tay ở đây, thêm vai trò mới vào ô chọn mà quên sửa mảng này là server
// từ chối với thông báo "Vai trò không hợp lệ" mà giao diện không hề báo trước.
const USER_ROLES: readonly string[] = ROLES;

async function parseVesselAssignment(
  t: HamDich,
  formData: FormData
): Promise<{ vesselId: number | null } | { error: string }> {
  const raw = String(formData.get("vesselId") || "");
  if (!raw) {
    return { vesselId: null };
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: t("actions.tauPhuTrach_khongHopLe") };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: parsed } });
  if (!vessel) {
    return { error: t("actions.tauPhuTrach_khongTonTai") };
  }
  return { vesselId: parsed };
}

export async function createUser(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, [
    "name",
    "email",
    "role",
    "vesselId",
    "rankCode",
  ]);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "");
  if (!name || !email || !password) {
    return { message: t("actions.taiKhoan_tenEmailMatKhauBatBuoc"), values };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: t("actions.taiKhoan_emailKhongHopLe"), values };
  }
  if (password.length < 8) {
    return { message: t("actions.taiKhoan_matKhauToiThieu8"), values };
  }
  if (!USER_ROLES.includes(role)) {
    return { message: t("actions.taiKhoan_vaiTroKhongHopLe"), values };
  }
  const vesselResult = await parseVesselAssignment(t, formData);
  if ("error" in vesselResult) {
    return { message: vesselResult.error, values };
  }
  const chucDanh = docChucDanhGiuVatTu(t, formData);
  if ("error" in chucDanh) {
    return { message: chucDanh.error, values };
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        vesselId: vesselResult.vesselId,
        rankCode: chucDanh.rankCode,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.taiKhoan_emailDaDung", { email }), values };
    }
    throw error;
  }
  // Mở một lối vào hệ thống là việc phải truy ngược được: ai mở, cho ai, quyền
  // gì, tàu nào. Vết tự động ở proxy.ts chỉ thấy "POST /users" nên không trả
  // lời được câu hỏi nào trong số đó.
  //
  // Ghi thẳng bằng ghiNhatKy chứ không qua ghiNhatKyNguoiDung: hàm kia có nhánh
  // `vesselId ?? user.vesselId`, nên truyền null — tài khoản văn phòng, không
  // gán tàu — lại rơi về tàu của chính ông quản trị đang thao tác. Cột vesselId
  // phải là tàu của ĐỐI TƯỢNG, nếu không thì dòng nhật ký bị xếp sang một con
  // tàu chẳng liên quan, và ngày nào trang /audit thêm bộ lọc theo tàu là bản
  // ghi lập tức nhảy nhầm chỗ.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    vesselId: vesselResult.vesselId,
    action: "tao-tai-khoan",
    path: "/users",
    detail:
      `Tạo "${email}" (${name}) — quyền ${ROLE_LABEL[role] ?? role}` +
      `, tàu ${vesselResult.vesselId ?? "không gán"}` +
      `, chức danh giữ vật tư ${chucDanh.rankCode ?? "không đặt"}`,
  });
  revalidatePath("/users");
  return { message: t("actions.taiKhoan_daTao", { email }), success: true };
}

export async function updateUserRole(
  _prevState: { message: string },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const values = formValues(formData, ["role", "vesselId", "rankCode"]);
  const id = Number(formData.get("id"));
  const role = String(formData.get("role") || "");
  if (!Number.isInteger(id) || id <= 0 || !USER_ROLES.includes(role)) {
    return { message: t("chung.duLieuKhongHopLe"), values };
  }
  if (id === admin.id) {
    return { message: t("actions.taiKhoan_khongTuDoiQuyen"), values };
  }
  const vesselResult = await parseVesselAssignment(t, formData);
  if ("error" in vesselResult) {
    return { message: vesselResult.error, values };
  }
  const chucDanh = docChucDanhGiuVatTu(t, formData);
  if ("error" in chucDanh) {
    return { message: chucDanh.error, values };
  }
  // Đọc trạng thái CŨ trước khi ghi đè: nhật ký chỉ nói "đổi thành máy trưởng"
  // thì sau này không ai dựng lại được người đó trước đó có quyền gì, mà đúng
  // cái "trước đó" mới là thứ cần khi soát lại một thao tác đáng ngờ.
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) {
    return { message: t("actions.taiKhoan_khongTimThay"), values };
  }
  await prisma.user.update({
    where: { id },
    data: {
      role,
      vesselId: vesselResult.vesselId,
      rankCode: chucDanh.rankCode,
    },
  });
  // Ghi thẳng bằng ghiNhatKy — xem lý do ở createUser. Ở đây còn dễ sai hơn:
  // gỡ gán tàu cho một thuyền viên thì vesselId đúng phải là null, mà rơi vào
  // nhánh mặc định là thao tác "gỡ khỏi tàu" lại bị ghi thành của tàu ông
  // quản trị.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    vesselId: vesselResult.vesselId,
    action: "doi-quyen",
    path: "/users",
    detail:
      `Đổi quyền "${before.email}" (${before.name}): ` +
      `${ROLE_LABEL[before.role] ?? before.role} → ${ROLE_LABEL[role] ?? role}` +
      `; tàu ${before.vesselId ?? "không gán"} → ${vesselResult.vesselId ?? "không gán"}` +
      `; chức danh giữ vật tư ${before.rankCode ?? "không đặt"} → ${chucDanh.rankCode ?? "không đặt"}`,
  });
  revalidatePath("/users");
  return { message: "", success: true };
}

export async function toggleUserActive(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!id) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  if (id === admin.id) {
    return { message: t("actions.taiKhoan_khongTuKhoa") };
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { message: t("actions.taiKhoan_khongTimThay") };
  }
  const trangThaiMoi = !user.isActive;
  await prisma.user.update({
    where: { id },
    data: { isActive: trangThaiMoi },
  });
  // Khóa tài khoản là cách thay cho xóa trong hầu hết trường hợp, nên nó phải
  // để lại vết ngang với xóa: người bị khóa mất đường vào hệ thống ngay lập
  // tức, và nếu không ghi thì không ai trả lời được ai đã khóa, khi nào.
  // Ghi thẳng bằng ghiNhatKy — xem lý do ở createUser. user.vesselId là null với
  // tài khoản văn phòng, đúng thứ rơi vào nhánh mặc định.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    vesselId: user.vesselId,
    action: trangThaiMoi ? "mo-tai-khoan" : "khoa-tai-khoan",
    path: "/users",
    detail:
      `${trangThaiMoi ? "Mở khóa" : "Khóa"} "${user.email}" (${user.name}, ` +
      `${ROLE_LABEL[user.role] ?? user.role})`,
  });
  revalidatePath("/users");
  return { message: "", success: true };
}

/**
 * Xóa hẳn một tài khoản.
 *
 * KHÓA vẫn là cách nên dùng trong hầu hết trường hợp — thuyền viên hết hạn hợp
 * đồng rời tàu thì khóa lại là xong, hồ sơ vẫn tra ngược được. Xóa chỉ dành cho
 * tài khoản lập nhầm, trùng, hoặc tài khoản thử nghiệm.
 *
 * Ba lớp chặn, theo thứ tự từ rẻ tới đắt:
 *   1. Chỉ quản trị, và không tự xóa mình — xóa nhầm tài khoản quản trị cuối
 *      cùng là mất đường vào hệ thống.
 *   2. Không xóa tài khoản đã TẢI FILE BÁO CÁO lên: file là bản lưu bất biến,
 *      phải giữ được vết ai đã nộp. Trường hợp này bắt khóa thay vì xóa.
 *   3. Bắt được lỗi khóa ngoại của database và dịch ra tiếng người, phòng khi
 *      sau này có bảng mới trỏ tới User mà quên xét ở đây.
 *
 * Yêu cầu vật tư người đó đã lập thì KHÔNG cản: bảng đó cố ý không khai khóa
 * ngoại tới User (chép sẵn tên và chức danh lúc lập), nên chứng từ vẫn nguyên
 * vẹn sau khi tài khoản biến mất.
 */
export async function deleteUser(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  if (id === admin.id) {
    return { message: t("actions.taiKhoan_khongTuXoa") };
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { message: t("actions.taiKhoan_khongTimThay") };
  }

  const [soFile, soYeuCau, soUyQuyen, soPhanCong] = await Promise.all([
    prisma.reportDocument.count({ where: { uploadedById: id } }),
    prisma.materialRequest.count({ where: { requestedById: id } }),
    prisma.delegation.count({
      where: { OR: [{ delegatorId: id }, { delegateId: id }] },
    }),
    prisma.fleetAssignment.count({ where: { userId: id } }),
  ]);

  if (soFile > 0) {
    return {
      message: t("actions.taiKhoan_daTaiFileKhongXoaDuoc", { n: soFile }),
    };
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: t("actions.taiKhoan_khongTimThay") };
      }
      if (error.code === "P2003") {
        return { message: t("actions.taiKhoan_conDuLieuLienQuan") };
      }
    }
    throw error;
  }

  // Ghi thẳng bằng ghiNhatKy — xem lý do ở createUser. Trước đây chỗ này không
  // truyền vesselId nên dòng nhật ký luôn mang tàu của ông quản trị, kể cả khi
  // tài khoản bị xóa thuộc tàu khác.
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    vesselId: user.vesselId,
    action: "xoa-tai-khoan",
    path: "/users",
    detail:
      `Xóa "${user.email}" (${ROLE_LABEL[user.role] ?? user.role}, ${user.name})` +
      ` — còn ${soYeuCau} yêu cầu vật tư mang tên người này (giữ nguyên),` +
      ` xóa theo ${soUyQuyen} ủy quyền và ${soPhanCong} dòng phân công đội tàu.`,
  });

  revalidatePath("/users");
  return {
    message: t("actions.taiKhoan_daXoa", { email: user.email }),
    success: true,
  };
}

// Xóa hẳn một đơn mua ĐÃ HỦY. Đơn hủy là rác trong danh sách nhưng vẫn phải
// thận trọng: chỉ xóa khi chắc chắn nó chưa ảnh hưởng tới tồn kho hay yêu cầu.
export async function deletePurchaseOrder(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  // Xóa chứng từ mua sắm là việc hệ trọng — chỉ quản trị viên.
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) {
    return { message: t("actions.donMua_chiQuanTriXoaDuoc") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po) {
    return { message: t("actions.donMua_daXoaHoacKhongTonTai") };
  }
  const scope = vesselScopeDayDu(actor);
  if (!trongPhamVi(scope, po.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  if (po.status !== "CANCELLED") {
    return { message: t("actions.donMua_chiXoaDonDaHuy") };
  }
  // Đã nhận hàng nghĩa là tồn kho đã bị tác động — xóa đơn sẽ mất căn cứ của
  // số tồn đó, nên chặn lại kể cả khi đơn đã hủy.
  const received = po.items.reduce((s, i) => s + i.quantityReceived, 0);
  if (received > 0) {
    return {
      message: t("actions.donMua_daNhanHangKhongXoaDuoc", { n: received }),
    };
  }

  await prisma.$transaction(async (tx) => {
    // Dòng đơn có gắn với dòng yêu cầu thì trả lại phần "đã đặt" cho yêu cầu,
    // để yêu cầu đó lại hiện trong hàng chờ mua sắm.
    for (const item of po.items) {
      if (item.requestItemId) {
        await tx.materialRequestItem.update({
          where: { id: item.requestItemId },
          data: { suppliedQuantity: { decrement: item.quantityReceived } },
        });
      }
    }
    // PurchaseOrderItem tự xóa theo (onDelete: Cascade).
    await tx.purchaseOrder.delete({ where: { id } });
  });

  // Số PO đã xóa không bao giờ được cấp lại (sinhSoDonMua lấy số lớn nhất +1),
  // nên trong sổ sẽ có một khoảng trống. Ghi lại để sau này còn giải thích
  // được khoảng trống đó là do ai xóa, chứ không phải chứng từ thất lạc.
  await ghiNhatKyNguoiDung(actor, {
    action: "xoa-don-mua",
    path: "/purchasing",
    vesselId: po.vesselId,
    detail:
      `Xóa đơn ${po.poNo} (đã hủy, ${po.items.length} dòng, chưa nhận hàng)` +
      `, người lập ${po.createdBy}`,
  });

  revalidatePath("/purchasing");
  revalidatePath("/dashboard");
  return { message: t("actions.donMua_daXoa", { ma: po.poNo }), success: true };
}

// Sửa vật tư ngay tại dòng trong bảng danh mục — không phải mở form riêng.
export async function updateMaterial(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const before = await prisma.material.findUnique({ where: { id } });
  if (!before) {
    return { message: t("actions.vatTu_daXoaHoacKhongTonTai") };
  }

  const str = (k: string) => String(formData.get(k) || "").trim();
  const code = str("code");
  const nameVn = str("nameVn");
  if (!code || !nameVn) {
    return { message: t("actions.vatTu_maVaTenBatBuoc") };
  }
  const materialType = str("materialType") === "SPARE" ? "SPARE" : "STORE";
  const equipment = str("equipment");
  const categoryIdRaw = str("categoryId");
  const minStock = Number(formData.get("minStock") || 0);
  const maxStock = Number(formData.get("maxStock") || 0);
  if (!Number.isFinite(minStock) || minStock < 0) {
    return { message: t("actions.vatTu_tonToiThieuKhongHopLe") };
  }
  if (!Number.isFinite(maxStock) || maxStock < 0) {
    return { message: t("actions.vatTu_tonToiDaKhongHopLe") };
  }

  try {
    await prisma.material.update({
      where: { id },
      data: {
        code,
        nameVn,
        nameEn: str("nameEn") || null,
        impa: str("impa") || null,
        partNumber: str("partNumber") || null,
        manufacturer: str("manufacturer") || null,
        materialType,
        // Thiết bị chỉ có nghĩa với phụ tùng — đổi sang Vật tư thì xóa đi cho
        // khỏi treo dữ liệu cũ gây gom nhóm sai.
        equipment: materialType === "SPARE" ? equipment || null : null,
        uom: str("uom") || "PCS",
        categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
        minStock,
        maxStock,
        isCritical: formData.get("isCritical") === "on",
        // Mã đổi thì phân loại phải đổi theo. Giữ nguyên khi mã không đổi để
        // không xóa mất phân loại do gan-ma-vat-tu.cmd gán cho mã cũ.
        ...(code !== before.code ? phanLoaiTuMa(code) : {}),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actions.vatTu_maDaCoOVatTuKhac", { ma: code }) };
    }
    throw error;
  }
  revalidatePath("/materials");
  revalidatePath("/inventory");
  return { message: t("actions.daLuuTen", { ten: nameVn }), success: true };
}
