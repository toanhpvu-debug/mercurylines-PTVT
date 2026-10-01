/**
 * Kiểm KIỂM SOÁT DUYỆT PO: vai trò Chuyên viên mua sắm, ai được duyệt PO (lãnh
 * đạo phòng KT-VT do quản trị chỉ định, người được ủy quyền, quản trị tạm duyệt
 * khi chưa chỉ định), luật không tự duyệt, ủy quyền "chỉ duyệt PO" không mở
 * thêm quyền nào, và — trên database thật trong một giao dịch rồi cuộn ngược —
 * cột / bảng mới cùng việc ghi lịch sử duyệt.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-duyet-po.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  LAP_DON_MUA,
  NHAN_HANG_PO,
  QUAN_LY_NCC,
  VAI_TRO_DUYET_PO,
  XEM_KIEM_SOAT_PO,
  coQuyenDuyetPo,
  duocDuyet,
  gioChoDuyet,
  kiemChiDinhLanhDao,
  kiemUyQuyenDuyetPo,
  tenNguoiDuyet,
  tuCachDuyetPo,
} from "@/lib/donMuaQuyTrinh";
import { ROLES, ROLE_LABEL, ROLE_LABEL_EN, danhTinhHieuLuc, phanLoaiUyQuyen, vesselScope } from "@/lib/roles";
import { ghiLichSuDuyet } from "@/lib/duyetPoServer";

const prisma = new PrismaClient();
let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
class CuonNguoc extends Error {}

async function main() {
  // ─── 1) Vai trò Chuyên viên mua sắm ────────────────────────────────────────
  console.log("\n=== 1) Vai tro Chuyen vien mua sam ===");
  kiemTra("co trong ROLES + nhan", [ROLES.includes("PURCHASER"), ROLE_LABEL.PURCHASER, ROLE_LABEL_EN.PURCHASER], [true, "Chuyên viên mua sắm", "Purchasing Officer"]);
  kiemTra("pham vi toan doi", vesselScope({ role: "PURCHASER", vesselId: null }), { all: true, vesselId: null, vesselIds: null, unassigned: false });
  kiemTra(
    "lap PO / quan ly NCC / xem kiem soat: co; nhan hang / duyet: khong",
    [LAP_DON_MUA.includes("PURCHASER"), QUAN_LY_NCC.includes("PURCHASER"), XEM_KIEM_SOAT_PO.includes("PURCHASER"), NHAN_HANG_PO.includes("PURCHASER"), VAI_TRO_DUYET_PO.includes("PURCHASER")],
    [true, true, true, false, false]
  );
  kiemTra("thuyen truong van lap PO nhung khong duyet", [LAP_DON_MUA.includes("MASTER"), VAI_TRO_DUYET_PO.includes("MASTER")], [true, false]);

  // ─── 2) Ai có tư cách duyệt ────────────────────────────────────────────────
  console.log("\n=== 2) Tu cach duyet ===");
  const truongPhong = { id: 10, role: "TECH_MANAGER", name: "Nguyễn Trưởng Phòng", duyetDonMua: true };
  const quanLyKhac = { id: 11, role: "TECH_MANAGER", name: "Lê Quản Lý" };
  const duocUyQuyen = { id: 12, role: "TECH_MANAGER", name: "Phạm Phó Phòng", duyetPoTu: [{ delegatorId: 10, delegatorName: "Nguyễn Trưởng Phòng" }] };
  const chuyenVien = { id: 20, role: "PURCHASER", name: "Trần Chuyên Viên" };
  const admin = { id: 1, role: "ADMIN", name: "Quản Trị" };
  kiemTra("truong phong duoc chi dinh", tuCachDuyetPo(truongPhong, true), [{ kyThay: null, tamThoi: false }]);
  kiemTra("quan ly ky thuat khac: khong", tuCachDuyetPo(quanLyKhac, true), []);
  kiemTra("nguoi duoc uy quyen: ky thay", tuCachDuyetPo(duocUyQuyen, true), [{ kyThay: { id: 10, name: "Nguyễn Trưởng Phòng" }, tamThoi: false }]);
  kiemTra("chuyen vien mua sam: khong, ke ca co co / uy quyen", tuCachDuyetPo({ ...chuyenVien, duyetDonMua: true, duyetPoTu: duocUyQuyen.duyetPoTu }, true), []);
  kiemTra("thuyen truong nhan uy quyen: khong", tuCachDuyetPo({ id: 30, role: "MASTER", name: "TT", duyetPoTu: duocUyQuyen.duyetPoTu }, true), []);
  kiemTra("quan tri khi da co lanh dao: khong", tuCachDuyetPo(admin, true), []);
  kiemTra("quan tri khi CHUA co lanh dao: tam duyet", tuCachDuyetPo(admin, false), [{ kyThay: null, tamThoi: true }]);
  kiemTra("quan ly ky thuat khi chua co lanh dao: van khong", tuCachDuyetPo(quanLyKhac, false), []);
  kiemTra("quan tri duoc chi dinh: khong phai tam", tuCachDuyetPo({ ...admin, duyetDonMua: true }, true), [{ kyThay: null, tamThoi: false }]);
  kiemTra("uy quyen cho chinh minh bi bo", tuCachDuyetPo({ ...truongPhong, duyetPoTu: [{ delegatorId: 10, delegatorName: "x" }] }, true).length, 1);
  kiemTra("coQuyenDuyetPo", [coQuyenDuyetPo(truongPhong, true), coQuyenDuyetPo(chuyenVien, true), coQuyenDuyetPo(admin, false)], [true, false, true]);

  // ─── 3) Duyệt một PO cụ thể ────────────────────────────────────────────────
  console.log("\n=== 3) Duyet PO ===");
  const poCV = { status: "PENDING_APPROVAL", submittedBy: "Trần Chuyên Viên", submittedById: 20 };
  kiemTra("truong phong duyet PO chuyen vien trinh", duocDuyet(truongPhong, poCV, true), { ok: true, kyThay: null, tamThoi: false });
  kiemTra("nguoi uy quyen duyet: ghi ky thay", duocDuyet(duocUyQuyen, poCV, true), { ok: true, kyThay: { id: 10, name: "Nguyễn Trưởng Phòng" }, tamThoi: false });
  kiemTra("quan ly khac: khong quyen", duocDuyet(quanLyKhac, poCV, true), { ok: false, lyDo: "khongQuyen" });
  kiemTra("chuyen vien tu duyet: khong quyen", duocDuyet(chuyenVien, poCV, true), { ok: false, lyDo: "khongQuyen" });
  kiemTra("PO nhap: khong cho duyet", duocDuyet(truongPhong, { ...poCV, status: "DRAFT" }, true), { ok: false, lyDo: "khongChoDuyet" });
  const poTP = { status: "PENDING_APPROVAL", submittedBy: "Nguyễn Trưởng Phòng", submittedById: 10 };
  kiemTra("truong phong khong tu duyet PO minh trinh", duocDuyet(truongPhong, poTP, true), { ok: false, lyDo: "tuDuyet" });
  kiemTra("nguoi uy quyen khong duyet PO cua nguoi giao quyen", duocDuyet(duocUyQuyen, poTP, true), { ok: false, lyDo: "tuDuyet" });
  kiemTra("nguoi uy quyen khong duyet PO minh trinh", duocDuyet(duocUyQuyen, { status: "PENDING_APPROVAL", submittedBy: "Phạm Phó Phòng", submittedById: 12 }, true), { ok: false, lyDo: "tuDuyet" });
  kiemTra("khong co id: so theo ten (bo hoa / khoang trang)", duocDuyet(truongPhong, { status: "PENDING_APPROVAL", submittedBy: " nguyễn trưởng phòng " }, true), { ok: false, lyDo: "tuDuyet" });
  kiemTra("co id: trung ten nhung khac nguoi van duyet duoc", duocDuyet(truongPhong, { status: "PENDING_APPROVAL", submittedBy: "Nguyễn Trưởng Phòng", submittedById: 99 }, true), { ok: true, kyThay: null, tamThoi: false });
  kiemTra("quan tri duoc chi dinh tu duyet (ngoai le)", duocDuyet({ ...admin, duyetDonMua: true }, { status: "PENDING_APPROVAL", submittedBy: "Quản Trị", submittedById: 1 }, true), { ok: true, kyThay: null, tamThoi: false });
  kiemTra("quan tri tam duyet", duocDuyet(admin, poCV, false), { ok: true, kyThay: null, tamThoi: true });
  // Vừa là lãnh đạo vừa nhận ủy quyền của lãnh đạo khác: PO do chính mình trình
  // thì không tư cách nào duyệt được; PO của lãnh đạo kia thì dùng quyền của mình.
  const haiTuCach = { ...truongPhong, duyetPoTu: [{ delegatorId: 13, delegatorName: "Võ Lãnh Đạo 2" }] };
  kiemTra("hai tu cach, PO cua lanh dao kia: dung quyen minh", duocDuyet(haiTuCach, { status: "PENDING_APPROVAL", submittedBy: "Võ Lãnh Đạo 2", submittedById: 13 }, true), { ok: true, kyThay: null, tamThoi: false });
  kiemTra("hai tu cach, PO minh trinh: khong", duocDuyet(haiTuCach, poTP, true), { ok: false, lyDo: "tuDuyet" });
  kiemTra("ten nguoi duyet", [tenNguoiDuyet("Phạm Phó Phòng", { name: "Nguyễn Trưởng Phòng" }), tenNguoiDuyet("Nguyễn Trưởng Phòng", null)], [
    "Phạm Phó Phòng (ký thay Nguyễn Trưởng Phòng)",
    "Nguyễn Trưởng Phòng",
  ]);
  const goc = new Date("2026-10-01T08:00:00");
  kiemTra("gio cho duyet", [gioChoDuyet(goc, new Date("2026-10-03T09:30:00")), gioChoDuyet(null, goc), gioChoDuyet(new Date("2026-10-02T00:00:00"), goc)], [49, 0, 0]);

  // ─── 4) Chỉ định & ủy quyền ────────────────────────────────────────────────
  console.log("\n=== 4) Chi dinh & uy quyen ===");
  kiemTra(
    "chi dinh lanh dao",
    [kiemChiDinhLanhDao({ role: "TECH_MANAGER", isActive: true }), kiemChiDinhLanhDao({ role: "ADMIN", isActive: true }), kiemChiDinhLanhDao({ role: "PURCHASER", isActive: true }), kiemChiDinhLanhDao({ role: "MASTER", isActive: true }), kiemChiDinhLanhDao({ role: "TECH_MANAGER", isActive: false })],
    [null, null, "saiVaiTro", "saiVaiTro", "biKhoa"]
  );
  const giao = { id: 10, role: "TECH_MANAGER", isActive: true, duyetDonMua: true };
  const nhan = { id: 12, role: "TECH_MANAGER", isActive: true };
  const tu = new Date("2026-10-05T00:00:00");
  const den = new Date("2026-10-20T23:59:59");
  kiemTra("uy quyen hop le", kiemUyQuyenDuyetPo({ giao, nhan, tu, den }), null);
  kiemTra("nguoi giao chua duoc chi dinh", kiemUyQuyenDuyetPo({ giao: { ...giao, duyetDonMua: false }, nhan, tu, den }), "giaoKhongPhaiLanhDao");
  kiemTra("nguoi giao bi khoa", kiemUyQuyenDuyetPo({ giao: { ...giao, isActive: false }, nhan, tu, den }), "giaoKhongPhaiLanhDao");
  kiemTra("tu uy quyen", kiemUyQuyenDuyetPo({ giao, nhan: { ...nhan, id: 10 }, tu, den }), "tuUyQuyen");
  kiemTra("giao cho chuyen vien mua sam: chan", kiemUyQuyenDuyetPo({ giao, nhan: { ...nhan, role: "PURCHASER" }, tu, den }), "nhanSaiVaiTro");
  kiemTra("giao cho thuyen truong: chan", kiemUyQuyenDuyetPo({ giao, nhan: { ...nhan, role: "MASTER" }, tu, den }), "nhanSaiVaiTro");
  kiemTra("nguoi nhan bi khoa", kiemUyQuyenDuyetPo({ giao, nhan: { ...nhan, isActive: false }, tu, den }), "nhanBiKhoa");
  kiemTra("thieu ngay", kiemUyQuyenDuyetPo({ giao, nhan, tu: null, den }), "thieuNgay");
  kiemTra("den truoc tu", kiemUyQuyenDuyetPo({ giao, nhan, tu: den, den: tu }), "denTruocTu");
  kiemTra("qua mot nam", kiemUyQuyenDuyetPo({ giao, nhan, tu, den: new Date("2027-10-21T00:00:00") }), "quaMotNam");

  // ─── 5) Ủy quyền "chỉ duyệt PO" không cho mượn vai trò ─────────────────────
  console.log("\n=== 5) Phan loai uy quyen ===");
  const lanhDao = { id: 10, name: "Nguyễn Trưởng Phòng", role: "TECH_MANAGER", vesselId: null, isActive: true, duyetDonMua: true, fleetAssignments: [] };
  const mayTruong = { id: 40, name: "Máy Trưởng", role: "CHIEF_ENGINEER", vesselId: 3, isActive: true, duyetDonMua: false, fleetAssignments: [] };
  const het = new Date("2026-12-31T23:59:59");
  const pl = phanLoaiUyQuyen([
    { phamVi: "DUYET_PO", endAt: het, delegator: lanhDao },
    { phamVi: null, endAt: het, delegator: mayTruong },
  ]);
  kiemTra("chi duyet PO: vao duyetPoTu, khong vao uyQuyen", [pl.duyetPoTu.map((u) => u.delegatorId), pl.uyQuyen.map((u) => u.delegatorId)], [[10], [40]]);
  const nguoiNhan = { id: 12, role: "SECOND_ENGINEER", vesselId: 3, uyQuyen: pl.uyQuyen };
  kiemTra("danh tinh muon chi tu uy quyen toan bo", danhTinhHieuLuc(nguoiNhan).map((d) => d.role), ["SECOND_ENGINEER", "CHIEF_ENGINEER"]);
  const plToanBo = phanLoaiUyQuyen([{ phamVi: null, endAt: het, delegator: lanhDao }]);
  kiemTra("uy quyen toan bo cua lanh dao: ca muon vai tro lan duyet PO", [plToanBo.uyQuyen.length, plToanBo.duyetPoTu.length], [1, 1]);
  kiemTra("lanh dao bi bo chi dinh: uy quyen duyet PO het tac dung", phanLoaiUyQuyen([{ phamVi: "DUYET_PO", endAt: het, delegator: { ...lanhDao, duyetDonMua: false } }]).duyetPoTu.length, 0);
  kiemTra("lanh dao bi khoa: het ca hai", phanLoaiUyQuyen([{ phamVi: null, endAt: het, delegator: { ...lanhDao, isActive: false } }]), { uyQuyen: [], duyetPoTu: [] });
  kiemTra("pham vi la: bo qua", phanLoaiUyQuyen([{ phamVi: "KHAC", endAt: het, delegator: lanhDao }]), { uyQuyen: [], duyetPoTu: [] });

  // ─── 6) Database (giao dịch, cuộn ngược) ───────────────────────────────────
  console.log("\n=== 6) Database (cuon nguoc) ===");
  try {
    await prisma.$transaction(async (tx) => {
      const tem = Date.now();
      const tao = (ten: string, role: string, duyetDonMua = false) =>
        tx.user.create({ data: { email: `kt-duyet-${ten}-${tem}@kiem-thu.local`, password: "x", name: `KT ${ten}`, role, duyetDonMua } });
      const tp = await tao("tp", "TECH_MANAGER", true);
      const pp = await tao("pp", "TECH_MANAGER");
      const cv = await tao("cv", "PURCHASER");
      kiemTra("cot duyetDonMua", [tp.duyetDonMua, pp.duyetDonMua, cv.role], [true, false, "PURCHASER"]);
      await tx.delegation.create({ data: { delegatorId: tp.id, delegateId: pp.id, startAt: new Date(Date.now() - 3600_000), endAt: new Date(Date.now() + 86400_000), phamVi: "DUYET_PO", createdById: tp.id } });
      // Đọc lại đúng như lib/auth.ts (quyenDong) đọc, rồi phân loại.
      const bayGio = new Date();
      const rows = await tx.delegation.findMany({
        where: { delegateId: pp.id, revokedAt: null, startAt: { lte: bayGio }, endAt: { gte: bayGio } },
        include: { delegator: { select: { id: true, name: true, role: true, vesselId: true, isActive: true, duyetDonMua: true, fleetAssignments: { select: { vesselId: true } } } } },
      });
      const q = phanLoaiUyQuyen(rows);
      kiemTra("uy quyen DB: duyet PO, khong muon vai tro", [q.duyetPoTu.map((u) => u.delegatorId), q.uyQuyen.length], [[tp.id], 0]);
      kiemTra("nguoi nhan duyet duoc PO chuyen vien trinh", duocDuyet({ ...pp, duyetPoTu: q.duyetPoTu }, { status: "PENDING_APPROVAL", submittedBy: cv.name, submittedById: cv.id }, true), {
        ok: true,
        kyThay: { id: tp.id, name: tp.name },
        tamThoi: false,
      });
      const po = { id: 2_000_000_000, poNo: "PO-KT-26-9999", currency: "USD", discountPercent: 10, transportFee: 20, deliveryFee: 0, items: [{ quantity: 2, unitPrice: 50 }] };
      await ghiLichSuDuyet(tx, { po, hanhDong: "TRINH", nguoi: cv });
      await ghiLichSuDuyet(tx, { po, hanhDong: "DUYET", nguoi: pp, kyThay: { id: tp.id, name: tp.name }, ghiChu: "OK" });
      const ls = await tx.lichSuDuyetPo.findMany({ where: { poId: po.id }, orderBy: { id: "asc" } });
      kiemTra(
        "lich su duyet ghi du",
        ls.map((l) => [l.hanhDong, l.nguoiId === (l.hanhDong === "TRINH" ? cv.id : pp.id), l.kyThay, l.ghiChu, l.tong, l.tienTe]),
        [
          ["TRINH", true, null, null, 110, "USD"],
          ["DUYET", true, tp.name, "OK", 110, "USD"],
        ]
      );
      throw new CuonNguoc();
    });
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  await prisma.$disconnect();
  if (truot) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
