/**
 * Kiểm SỬA / GỠ SƠN ĐÃ NHẬP và BẢN IN BÁO CÁO SƠN MLS-11-05:
 *   - phần thuần (lib/tonSon.ts): mô tả sơn trên tờ in, số in kiểu Việt Nam, đọc
 *     số tồn, dòng báo cáo từ tồn (gợi ý theo định mức), bản sửa tay áp lên số
 *     liệu mới (sửa ô / gõ lại số gốc / bỏ / thêm / đổi chỗ / dọn dòng đã gỡ /
 *     đếm chỗ khác / đọc từ localStorage hỏng), ước số trang;
 *   - trên database thật trong MỘT giao dịch rồi cuộn ngược (lib/tonSonServer.ts):
 *     sửa số tồn (dòng điều chỉnh, số đổi giữa chừng, thiếu lý do), sửa tên loại
 *     sơn riêng / dùng chung, xóa dòng nhập/xuất (hoàn tồn, chặn dòng của phiếu),
 *     gỡ phiếu giao (thiếu tồn thì chặn, gỡ xong phiếu mở lại, loại mới bị xóa,
 *     gỡ lần hai bị chặn, phiếu cũ chưa gắn phieuSonId), gỡ dòng tồn giữ lịch sử /
 *     xóa hẳn (chặn khi đã thi công).
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-sua-ton-son.ts
 */
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  apDungBanSua,
  banSuaRong,
  boDongBanIn,
  demChoKhac,
  docBanSua,
  docSoTon,
  doiChoDongBanIn,
  dongBaoCaoTuTon,
  gonBanSua,
  moTaSonIn,
  soIn,
  suaDauBanIn,
  suaOBanIn,
  uocSoTrang,
  type DauBaoCaoSon,
} from "@/lib/tonSon";
import { LoiTonSon, goPhieuSonTx, goTonSonTx, suaTonSonTx, xoaGiaoDichSonTx } from "@/lib/tonSonServer";
import { nhapPhieuSonTx } from "@/lib/phieuSonServer";
import type { DongNhanSon } from "@/lib/phieuSon";

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

function phanThuan() {
  // ── Mô tả sơn trên tờ in: HÃNG TÊN MÃ-MÀU MÀU, không lặp phần đã có trong tên ──
  kiemTra("mo ta day du", moTaSonIn({ name: "HARDTOP XP", maker: "Jotun", colorCode: "RAL 9003", colorName: "White" }), "Jotun HARDTOP XP RAL 9003 White");
  kiemTra("mo ta khong lap", moTaSonIn({ name: "JOTUN HARTOP PAL 9003A WHITE", maker: "Jotun", colorCode: null, colorName: "white" }), "JOTUN HARTOP PAL 9003A WHITE");
  kiemTra("mo ta chi ten + hang", moTaSonIn({ name: " Thinner  No.17 ", maker: "JOTUN", colorCode: null, colorName: null }), "JOTUN Thinner No.17");
  kiemTra("mo ta ma mau = ten mau", moTaSonIn({ name: "Pilot II", maker: null, colorCode: "1023", colorName: "1023" }), "Pilot II 1023");

  // ── Số in kiểu Việt Nam ──
  kiemTra("so in", [soIn(400), soIn(12.5), soIn(1234.5), soIn(0.1 + 0.2), soIn(0), soIn(Number.NaN)], ["400", "12,5", "1.234,5", "0,3", "0", ""]);

  // ── Đọc số tồn người dùng gõ (ô type=number gửi dấu chấm) ──
  kiemTra("doc so ton", [docSoTon("18"), docSoTon("1.5"), docSoTon("1,5"), docSoTon(" 20 "), docSoTon("1.500"), docSoTon("0")], [18, 1.5, 1.5, 20, 1.5, 0]);
  kiemTra("doc so ton sai", [docSoTon(""), docSoTon("-1"), docSoTon("abc"), docSoTon("1e3"), docSoTon("2..5")], [null, null, null, null, null]);

  // ── Dòng báo cáo từ tồn: R.O.B, IMPA trống (không in mã SON-####), gợi ý thiếu định mức ──
  const ton = [
    { productId: 7, quantity: 12.5, minQty: 40, product: { name: "Hardtop XP", maker: "Jotun", colorCode: "RAL 9003", colorName: "White", uom: "Ltr" } },
    { productId: 9, quantity: 0, minQty: 0, product: { name: "Thinner No.17", maker: "Jotun", colorCode: null, colorName: null, uom: "Ltr" } },
  ];
  const dongGoc = dongBaoCaoTuTon(ton);
  kiemTra("dong bao cao", dongGoc, [
    { id: "p7", moTa: "Jotun Hardtop XP RAL 9003 White", impa: "", donVi: "Ltr", rob: "12,5", yeuCau: "", duyet: "", goiY: "27,5" },
    { id: "p9", moTa: "Jotun Thinner No.17", impa: "", donVi: "Ltr", rob: "0", yeuCau: "", duyet: "", goiY: "" },
  ]);

  // ── Bản sửa tay áp lên số liệu mới nhất ──
  const dau: DauBaoCaoSon = { tenTau: "M. KEPLER", ngay: "02/10/2026", boPhan: "BOONG", soYeuCau: "", trang: "" };
  const goc = { dau, dong: dongGoc };
  let ban = banSuaRong();
  kiemTra("ban rong = goc", [apDungBanSua(goc, ban).dong.map((d) => d.id), demChoKhac(goc, ban)], [["p7", "p9"], 0]);
  ban = suaOBanIn(goc, ban, "p7", "yeuCau", "40");
  ban = suaDauBanIn(goc, ban, "soYeuCau", "SON-01/2026");
  kiemTra("sua o + dau", [apDungBanSua(goc, ban).dong[0].yeuCau, apDungBanSua(goc, ban).dau.soYeuCau, demChoKhac(goc, ban)], ["40", "SON-01/2026", 2]);
  ban = suaOBanIn(goc, ban, "p7", "yeuCau", "");
  kiemTra("go lai so goc la xoa cho sua", [ban.sua.p7 ?? null, demChoKhac(goc, ban)], [null, 1]);
  ban = boDongBanIn(ban, "p9");
  kiemTra("bo dong", [apDungBanSua(goc, ban).dong.map((d) => d.id), demChoKhac(goc, ban)], [["p7"], 2]);
  ban = { ...ban, them: [{ id: "them-a", moTa: "Brush 2 inch", impa: "", donVi: "pcs", rob: "", yeuCau: "10", duyet: "" }] };
  ban = doiChoDongBanIn(goc, ban, "them-a", -1);
  kiemTra("them + doi cho", [apDungBanSua(goc, ban).dong.map((d) => d.id), demChoKhac(goc, ban)], [["them-a", "p7"], 4]);
  ban = suaOBanIn(goc, ban, "them-a", "moTa", "Brush 3 inch");
  kiemTra("sua dong them tay", apDungBanSua(goc, ban).dong[0].moTa, "Brush 3 inch");
  // Số liệu mới: p7 vừa nhập thêm (ROB đổi), p9 đã gỡ khỏi tàu, p11 mới nhập — ô không sửa tay hiện số mới, dòng mới nối cuối.
  const moi = { dau, dong: [{ ...dongGoc[0], rob: "30" }, { id: "p11", moTa: "Jotun Pilot II", impa: "", donVi: "Ltr", rob: "5", yeuCau: "", duyet: "" }] };
  const banGon = gonBanSua(moi, ban);
  kiemTra("so lieu moi + don dong da go", [apDungBanSua(moi, banGon).dong.map((d) => [d.id, d.rob]), banGon.bo], [[["them-a", ""], ["p7", "30"], ["p11", "5"]], []]);
  // Đọc từ localStorage: hỏng / khác phiên bản → bỏ; kiểu sai từng ô → bỏ ô đó.
  kiemTra("doc ban sua hong", [docBanSua(null), docBanSua("x"), docBanSua({ v: 2 })], [null, null, null]);
  const doc = docBanSua({ v: 1, dau: { ngay: "03/10/2026", tenTau: 5 }, sua: { p7: { rob: "9", moTa: 1 } }, bo: ["p9", 3], them: [{ id: "x" }, { id: "them-b", moTa: "A" }], thuTu: null });
  kiemTra("doc ban sua loc kieu", doc, { v: 1, dau: { ngay: "03/10/2026" }, sua: { p7: { rob: "9" } }, bo: ["p9"], them: [{ id: "them-b", moTa: "A", impa: "", donVi: "", rob: "", yeuCau: "", duyet: "" }], thuTu: null });

  // ── Ước số trang A4 dọc (vùng in 978 px) ──
  kiemTra("so trang", [uocSoTrang(0), uocSoTrang(500), uocSoTrang(978), uocSoTrang(1100), uocSoTrang(2400)], [1, 1, 1, 2, 3]);
}

const dongNhan = (ten: string, soLuong: number, paintProductId: number | null = null): DongNhanSon => ({
  ten,
  hang: "Hang Thu ZZK",
  mau: null,
  maMau: null,
  ma: null,
  dvt: "Ltr",
  soLuong,
  dungTich: null,
  loaiSon: null,
  paintProductId,
  boQua: false,
  canhBao: null,
  ghiChu: null,
});

async function phanDatabase() {
  const tau = await prisma.vessel.findMany({ orderBy: { id: "asc" }, take: 2, select: { id: true, code: true } });
  if (tau.length < 2) {
    console.log("  (bo qua phan database: can it nhat 2 tau)");
    return;
  }
  const [V, W] = tau;
  const truoc = await Promise.all([prisma.paintProduct.count(), prisma.paintStock.count(), prisma.paintTransaction.count(), prisma.sonPhieuTep.count()]);
  try {
    await prisma.$transaction(
      async (tx) => {
        const loiCua = async (ten: string, fn: () => Promise<unknown>, ma: string) => {
          await tx.$executeRawUnsafe("SAVEPOINT thu_loi");
          let thuc = "khong loi";
          try {
            await fn();
          } catch (e) {
            thuc = e instanceof LoiTonSon ? e.ma : `LOI KHAC: ${(e as Error).message}`;
          }
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT thu_loi");
          kiemTra(ten, thuc, ma);
        };
        const ton = async (vesselId: number, productId: number) =>
          (await tx.paintStock.findUnique({ where: { vesselId_productId: { vesselId, productId } } }))?.quantity ?? null;
        const taoPhieu = (soPhieu: string, trangThai = "CHO_XU_LY") =>
          tx.sonPhieuTep.create({
            data: { vesselId: V.id, fileName: `${soPhieu}.xlsx`, storedName: `thu-${randomUUID()}.xlsx`, loaiTep: "EXCEL", size: 1, sha256: "x", soPhieu, trangThai, nguoiTaiId: 0, nguoiTai: "Kiểm thử" },
          });
        const apDung = async (tepId: number, soPhieu: string, dong: DongNhanSon[]) => {
          const kq = await nhapPhieuSonTx(tx, { vesselId: V.id, dong, ghiChu: `Phiếu giao ${soPhieu}`, ngayNhan: new Date(), nguoi: "Kiểm thử", phieuSonId: tepId });
          await tx.sonPhieuTep.update({ where: { id: tepId }, data: { trangThai: "DA_AP_DUNG", apDungBoi: "Kiểm thử", apDungLuc: new Date(), ketQua: kq as unknown as Prisma.InputJsonValue } });
          return kq;
        };

        // ── Nhập một phiếu giao: 2 loại mới, dòng nhập gắn phieuSonId ──
        const p1 = await taoPhieu("THU-ZZK-1");
        const kq1 = await apDung(p1.id, "THU-ZZK-1", [dongNhan("Son Thu ZZK A", 20), dongNhan("Son Thu ZZK B", 10)]);
        const [A, B] = kq1.sanPham.map((s) => s.productId);
        kiemTra("nhap phieu: 2 loai moi", [kq1.taoMoi, await ton(V.id, A), await ton(V.id, B)], [2, 20, 10]);
        kiemTra("nhap phieu: gan phieuSonId", await tx.paintTransaction.count({ where: { phieuSonId: p1.id } }), 2);

        // ── Sửa số tồn: dòng điều chỉnh OUT 2, có lý do ──
        const s1 = await suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 20, soLuongMoi: 18, minQty: 5, lyDo: "kiem thuc te", nguoi: "Kiểm thử", sanPham: null, toanDoi: false });
        const dc = await tx.paintTransaction.findFirstOrThrow({ where: { vesselId: V.id, productId: A, dieuChinh: true } });
        kiemTra("sua ton: ket qua", [s1.doiSo, s1.doiMin, await ton(V.id, A)], [true, true, 18]);
        kiemTra("sua ton: dong dieu chinh", [dc.type, dc.quantity, dc.note, dc.phieuSonId], ["OUT", 2, "Điều chỉnh tồn 20 → 18 Ltr: kiem thuc te", null]);
        await loiCua("sua ton: so doi giua chung", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 20, soLuongMoi: 15, minQty: null, lyDo: "x", nguoi: "K", sanPham: null, toanDoi: false }), "daDoi");
        await loiCua("sua ton: thieu ly do", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: 15, minQty: null, lyDo: " ", nguoi: "K", sanPham: null, toanDoi: false }), "thieuLyDo");
        await loiCua("sua ton: so am", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: -1, minQty: null, lyDo: "x", nguoi: "K", sanPham: null, toanDoi: false }), "soKhongHopLe");
        const s2 = await suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: 18, minQty: 5, lyDo: "", nguoi: "K", sanPham: null, toanDoi: false });
        kiemTra("sua ton: khong doi gi", [s2.doiSo, s2.doiMin, s2.doiSanPham], [false, false, false]);

        // ── Sửa thông tin loại sơn: riêng tàu này thì được; dùng ở tàu khác thì chỉ toàn đội ──
        const spMoi = { name: "Son Thu ZZK A2", maker: "Hang Thu ZZK", paintType: "TOPCOAT", colorName: "Xanh", colorCode: "RAL 5017", uom: "Ltr", packSize: 20 };
        const s3 = await suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: null, minQty: null, lyDo: "", nguoi: "K", sanPham: spMoi, toanDoi: false });
        const pA = await tx.paintProduct.findUniqueOrThrow({ where: { id: A } });
        kiemTra("sua loai rieng", [s3.doiSanPham, pA.name, pA.paintType, pA.colorCode, pA.packSize], [true, "Son Thu ZZK A2", "TOPCOAT", "RAL 5017", 20]);
        await loiCua("sua loai: ten trong", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: null, minQty: null, lyDo: "", nguoi: "K", sanPham: { ...spMoi, name: "  " }, toanDoi: false }), "tenTrong");
        await loiCua("sua loai: he son sai", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: null, minQty: null, lyDo: "", nguoi: "K", sanPham: { ...spMoi, paintType: "XYZ" }, toanDoi: false }), "loaiKhongHopLe");
        await tx.paintStock.create({ data: { vesselId: W.id, productId: A, quantity: 1 } });
        await loiCua("sua loai dung chung: chan", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: null, minQty: null, lyDo: "", nguoi: "K", sanPham: { ...spMoi, name: "Ten Khac" }, toanDoi: false }), "sanPhamDungChung");
        await loiCua("sua loai dung chung: thuyen truong duoc", () => suaTonSonTx(tx, { vesselId: V.id, productId: A, soLuongCu: 18, soLuongMoi: null, minQty: null, lyDo: "", nguoi: "K", sanPham: { ...spMoi, name: "Ten Khac" }, toanDoi: true }), "khong loi");
        await tx.paintStock.delete({ where: { vesselId_productId: { vesselId: W.id, productId: A } } });

        // ── Xóa dòng nhập/xuất: dòng điều chỉnh → hoàn tồn; dòng của phiếu → chặn; nhập tay → trừ lại ──
        const x1 = await xoaGiaoDichSonTx(tx, { vesselId: V.id, giaoDichId: dc.id, lyDo: "dieu chinh nham" });
        kiemTra("xoa dong dieu chinh: hoan ton", [x1.dieuChinh, await ton(V.id, A)], [true, 20]);
        const inPhieu = await tx.paintTransaction.findFirstOrThrow({ where: { phieuSonId: p1.id, productId: B } });
        await loiCua("xoa dong cua phieu: chan", () => xoaGiaoDichSonTx(tx, { vesselId: V.id, giaoDichId: inPhieu.id, lyDo: "x" }), "thuocPhieu");
        await loiCua("xoa dong tau khac: chan", () => xoaGiaoDichSonTx(tx, { vesselId: W.id, giaoDichId: inPhieu.id, lyDo: "x" }), "khongCoGiaoDich");
        await tx.paintStock.update({ where: { vesselId_productId: { vesselId: V.id, productId: B } }, data: { quantity: { increment: 5 } } });
        const tay = await tx.paintTransaction.create({ data: { vesselId: V.id, productId: B, type: "IN", quantity: 5, note: "nhap tay", performedBy: "K" } });
        await xoaGiaoDichSonTx(tx, { vesselId: V.id, giaoDichId: tay.id, lyDo: "nhap trung" });
        kiemTra("xoa dong nhap tay: tru lai", await ton(V.id, B), 10);
        await loiCua("xoa dong da xoa", () => xoaGiaoDichSonTx(tx, { vesselId: V.id, giaoDichId: tay.id, lyDo: "x" }), "khongCoGiaoDich");

        // ── Gỡ phiếu: sơn đã xuất bớt → chặn; trả lại đủ → gỡ được, phiếu mở lại, loại mới bị xóa ──
        await tx.paintStock.update({ where: { vesselId_productId: { vesselId: V.id, productId: B } }, data: { quantity: { decrement: 3 } } });
        const xuat = await tx.paintTransaction.create({ data: { vesselId: V.id, productId: B, type: "OUT", quantity: 3, note: "dung thu", performedBy: "K" } });
        await loiCua("go phieu: da dung bot", () => goPhieuSonTx(tx, { tepId: p1.id, lyDo: "nham", nguoi: "K", luc: "02/10/2026" }), "daDungBot");
        await xoaGiaoDichSonTx(tx, { vesselId: V.id, giaoDichId: xuat.id, lyDo: "xuat nham" });
        await loiCua("go phieu: thieu ly do", () => goPhieuSonTx(tx, { tepId: p1.id, lyDo: "", nguoi: "K", luc: "x" }), "thieuLyDo");
        const g1 = await goPhieuSonTx(tx, { tepId: p1.id, lyDo: "nhap nham tau", nguoi: "Kiểm thử", luc: "02/10/2026 10:00" });
        const p1Sau = await tx.sonPhieuTep.findUniqueOrThrow({ where: { id: p1.id } });
        kiemTra("go phieu: ket qua", [g1.soLoai, g1.soDong, g1.tong, g1.xoaLoai], [2, 2, 30, 2]);
        kiemTra("go phieu: phieu mo lai", [p1Sau.trangThai, p1Sau.apDungLuc, p1Sau.ketQua, p1Sau.ghiChuDoc], ["CHO_XU_LY", null, null, "Đã gỡ lần nhập (02/10/2026 10:00) bởi Kiểm thử: nhap nham tau"]);
        kiemTra("go phieu: ton + loai sach", [await ton(V.id, A), await ton(V.id, B), await tx.paintProduct.count({ where: { id: { in: [A, B] } } }), await tx.paintTransaction.count({ where: { productId: { in: [A, B] } } })], [null, null, 0, 0]);
        await loiCua("go phieu lan hai: chan", () => goPhieuSonTx(tx, { tepId: p1.id, lyDo: "x", nguoi: "K", luc: "x" }), "phieuDaGo");

        // ── Nhập lại phiếu; gỡ dòng tồn GIỮ lịch sử và XÓA hẳn ──
        const kq2 = await apDung(p1.id, "THU-ZZK-1", [dongNhan("Son Thu ZZK C", 8), dongNhan("Son Thu ZZK D", 6)]);
        const [C, D] = kq2.sanPham.map((s) => s.productId);
        await loiCua("go ton: thieu ly do", () => goTonSonTx(tx, { vesselId: V.id, productId: C, cach: "GIU", lyDo: "", nguoi: "K" }), "thieuLyDo");
        const go1 = await goTonSonTx(tx, { vesselId: V.id, productId: C, cach: "GIU", lyDo: "het dung", nguoi: "K" });
        const dcC = await tx.paintTransaction.findMany({ where: { productId: C }, orderBy: { id: "asc" }, select: { type: true, quantity: true, dieuChinh: true } });
        kiemTra("go ton giu lich su", [go1.soGiaoDich, go1.xoaLoai, await ton(V.id, C), dcC], [1, false, null, [{ type: "IN", quantity: 8, dieuChinh: false }, { type: "OUT", quantity: 8, dieuChinh: true }]]);
        await loiCua("go ton: dong da go", () => goTonSonTx(tx, { vesselId: V.id, productId: C, cach: "GIU", lyDo: "x", nguoi: "K" }), "khongCoDong");
        const go2 = await goTonSonTx(tx, { vesselId: V.id, productId: D, cach: "XOA", lyDo: "nhap nham", nguoi: "K" });
        kiemTra("go ton xoa han", [go2.soGiaoDich, go2.xoaLoai, await ton(V.id, D), await tx.paintProduct.count({ where: { id: D } })], [1, true, null, 0]);
        // Đã thi công dùng sơn → không xóa hẳn được.
        const kq3 = await nhapPhieuSonTx(tx, { vesselId: V.id, dong: [dongNhan("Son Thu ZZK E", 9)], ghiChu: "nhap thu E", ngayNhan: new Date(), nguoi: "K" });
        const E = kq3.sanPham[0].productId;
        await tx.paintJob.create({ data: { vesselId: V.id, jobDate: new Date(), lines: { create: [{ productId: E, quantity: 1 }] } } });
        await loiCua("go ton xoa han: da thi cong", () => goTonSonTx(tx, { vesselId: V.id, productId: E, cach: "XOA", lyDo: "x", nguoi: "K" }), "daThiCong");
        // Loại sơn có sẵn trong danh mục từ trước (không sinh ra cùng lần nhập) → xóa hẳn khỏi tàu nhưng giữ trong danh mục.
        const cu = await tx.paintProduct.create({ data: { code: `THU-${randomUUID().slice(0, 8)}`, name: "Son Thu ZZK F", createdAt: new Date(Date.now() - 86400000) } });
        await nhapPhieuSonTx(tx, { vesselId: V.id, dong: [dongNhan("x", 4, cu.id)], ghiChu: "nhap thu F", ngayNhan: new Date(), nguoi: "K" });
        const go3 = await goTonSonTx(tx, { vesselId: V.id, productId: cu.id, cach: "XOA", lyDo: "nhap nham", nguoi: "K" });
        kiemTra("xoa han loai co san: giu danh muc", [go3.xoaLoai, await tx.paintProduct.count({ where: { id: cu.id } })], [false, 1]);

        // ── Phiếu nhập TRƯỚC khi có phieuSonId: gỡ theo ghi chú + loại + số lượng quanh lúc nhập ──
        const p2 = await taoPhieu("THU-ZZK-CU", "DA_AP_DUNG");
        await tx.paintStock.update({ where: { vesselId_productId: { vesselId: V.id, productId: E } }, data: { quantity: { increment: 4 } } });
        await tx.paintTransaction.create({ data: { vesselId: V.id, productId: E, type: "IN", quantity: 4, note: "Phiếu giao THU-ZZK-CU", performedBy: "K" } });
        await tx.sonPhieuTep.update({ where: { id: p2.id }, data: { apDungLuc: new Date(), ketQua: { sanPham: [{ productId: E, soLuong: 4, taoMoi: false }] } } });
        const tonE = await ton(V.id, E);
        const g2 = await goPhieuSonTx(tx, { tepId: p2.id, lyDo: "phieu cu", nguoi: "K", luc: "x" });
        kiemTra("go phieu cu (khong phieuSonId)", [g2.soDong, g2.tong, g2.xoaLoai, (tonE ?? 0) - ((await ton(V.id, E)) ?? 0)], [1, 4, 0, 4]);

        throw new CuonNguoc();
      },
      { timeout: 60000, maxWait: 10000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  const sau = await Promise.all([prisma.paintProduct.count(), prisma.paintStock.count(), prisma.paintTransaction.count(), prisma.sonPhieuTep.count()]);
  kiemTra("da cuon nguoc (san pham, ton, giao dich, phieu)", sau, truoc);
}

async function main() {
  phanThuan();
  await phanDatabase();
  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  await prisma.$disconnect();
  if (truot) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
