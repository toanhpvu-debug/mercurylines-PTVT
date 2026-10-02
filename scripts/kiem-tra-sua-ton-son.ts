/**
 * Kiểm SỬA / GỠ SƠN ĐÃ NHẬP và BẢN IN BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14:
 *   - phần thuần (lib/tonSon.ts): mô tả sơn trên tờ in, số in kiểu Việt Nam, đọc
 *     số tồn / số trên tờ in, quý theo giờ Việt Nam (mốc, đọc từ địa chỉ trang),
 *     bốn cột của quý từ lịch sử nhập / xuất (điều chỉnh sửa vào Nhận / Tồn đầu
 *     kỳ, giao dịch sau kỳ, loại đã gỡ), dòng báo cáo, kiểm cân đối, bản sửa tay
 *     áp lên số liệu mới (sửa ô / gõ lại số gốc / bỏ / thêm / đổi chỗ / dọn dòng
 *     đã gỡ / đếm chỗ khác / đọc từ localStorage hỏng), chia trang;
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
  chiaTrangBaoCao,
  demChoKhac,
  docBanSua,
  docKyQuy,
  docSoBaoCao,
  docSoTon,
  doiChoDongBanIn,
  dongBaoCaoQuy,
  dongTrongBaoCao,
  gonBanSua,
  lechCanDoi,
  mocQuy,
  moTaSonIn,
  quyCua,
  soIn,
  suaDauBanIn,
  suaOBanIn,
  tinhTonQuy,
  type DauBaoCaoSon,
  type GiaoDichSonKy,
} from "@/lib/tonSon";
import { LoiTonSon, apDungNhanDangTx, goPhieuSonTx, goTonSonTx, suaTonSonTx, xoaGiaoDichSonTx } from "@/lib/tonSonServer";
import { deXuatThongTinSon } from "@/lib/tenSon";
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
  // Tên viết hoa (như mẫu công ty) thì cả dòng viết hoa.
  kiemTra("mo ta day du", moTaSonIn({ name: "HARDTOP XP", maker: "Jotun", colorCode: "RAL 9003", colorName: "White" }), "JOTUN HARDTOP XP RAL 9003 WHITE");
  // Tên chuẩn của bộ nhận dạng: màu đứng trước thành phần, đơn vị thùng thì ghi dung tích.
  kiemTra("mo ta comp + thung", moTaSonIn({ name: "JOTAFIX PU TC COMP A", maker: "Jotun", colorCode: "RAL 3000", colorName: null, packSize: 18, uom: "PAIL" }), "JOTUN JOTAFIX PU TC RAL 3000 COMP A 18L");
  kiemTra("mo ta dong ran", moTaSonIn({ name: "JOTAFIX PU TC COMP B (ĐÓNG RẮN)", maker: "Jotun", colorCode: null, colorName: null, packSize: 2, uom: "PAIL" }), "JOTUN JOTAFIX PU TC COMP B (ĐÓNG RẮN) 2L");
  kiemTra("mo ta thinner (hang trong ten)", moTaSonIn({ name: "JOTUN THINNER NO.10", maker: "Jotun", colorCode: null, colorName: null, packSize: 20, uom: "PAIL" }), "JOTUN THINNER NO.10 20L");
  kiemTra("mo ta don vi lit: khong ghi dung tich", moTaSonIn({ name: "Hardtop XP", maker: "Jotun", colorCode: null, colorName: "Red", packSize: 20, uom: "Ltr" }), "Jotun Hardtop XP Red");
  kiemTra("mo ta dung tich le", moTaSonIn({ name: "JOTAFIX PU TC COMP A", maker: "Jotun", colorCode: "RAL 5002", colorName: null, packSize: 17.91, uom: "PAIL" }), "JOTUN JOTAFIX PU TC RAL 5002 COMP A 17,91L");
  kiemTra("mo ta khong lap", moTaSonIn({ name: "JOTUN HARTOP PAL 9003A WHITE", maker: "Jotun", colorCode: null, colorName: "white" }), "JOTUN HARTOP PAL 9003A WHITE");
  kiemTra("mo ta chi ten + hang", moTaSonIn({ name: " Thinner  No.17 ", maker: "JOTUN", colorCode: null, colorName: null }), "JOTUN Thinner No.17");
  kiemTra("mo ta ma mau = ten mau", moTaSonIn({ name: "Pilot II", maker: null, colorCode: "1023", colorName: "1023" }), "Pilot II 1023");

  // ── Số in kiểu Việt Nam ──
  kiemTra("so in", [soIn(400), soIn(12.5), soIn(1234.5), soIn(0.1 + 0.2), soIn(0), soIn(Number.NaN)], ["400", "12,5", "1.234,5", "0,3", "0", ""]);

  // ── Đọc số tồn người dùng gõ (ô type=number gửi dấu chấm) ──
  kiemTra("doc so ton", [docSoTon("18"), docSoTon("1.5"), docSoTon("1,5"), docSoTon(" 20 "), docSoTon("1.500"), docSoTon("0")], [18, 1.5, 1.5, 20, 1.5, 0]);
  kiemTra("doc so ton sai", [docSoTon(""), docSoTon("-1"), docSoTon("abc"), docSoTon("1e3"), docSoTon("2..5")], [null, null, null, null, null]);

  // ── Đọc số trên tờ in (kiểu soIn in ra, hoặc gõ tay) ──
  kiemTra("doc so bao cao", [docSoBaoCao("1.234,5"), docSoBaoCao("12,5"), docSoBaoCao("12.5"), docSoBaoCao("1.500"), docSoBaoCao(" 16 "), docSoBaoCao("-2")], [1234.5, 12.5, 12.5, 1500, 16, -2]);
  kiemTra("doc so bao cao sai", [docSoBaoCao(""), docSoBaoCao("abc"), docSoBaoCao("1,2,3"), docSoBaoCao("1e3")], [null, null, null, null]);

  // ── Quý theo giờ Việt Nam (máy chủ chạy UTC): 0 giờ 01/10 VN = 17 giờ 30/09 UTC ──
  kiemTra(
    "quy cua thoi diem",
    [quyCua(new Date("2026-09-30T16:59:59Z")), quyCua(new Date("2026-09-30T17:00:00Z")), quyCua(new Date("2026-12-31T17:00:00Z"))],
    [{ nam: 2026, quy: 3 }, { nam: 2026, quy: 4 }, { nam: 2027, quy: 1 }]
  );
  const q4 = mocQuy({ nam: 2026, quy: 4 });
  kiemTra("moc quy IV/2026", [q4.batDau.toISOString(), q4.ketThuc.toISOString(), mocQuy({ nam: 2027, quy: 1 }).batDau.toISOString()], ["2026-09-30T17:00:00.000Z", "2026-12-31T17:00:00.000Z", "2026-12-31T17:00:00.000Z"]);
  const homNay = new Date("2026-10-02T03:00:00Z");
  kiemTra(
    "doc ky tu dia chi trang",
    [docKyQuy("2026", "3", homNay), docKyQuy("2027", "1", homNay), docKyQuy("2026", "5", homNay), docKyQuy("abc", "2", homNay), docKyQuy(["2025"], ["4"], homNay), docKyQuy("1999", "1", homNay), docKyQuy(undefined, undefined, homNay)],
    [{ nam: 2026, quy: 3 }, { nam: 2026, quy: 4 }, { nam: 2026, quy: 4 }, { nam: 2026, quy: 4 }, { nam: 2025, quy: 4 }, { nam: 2026, quy: 4 }, { nam: 2026, quy: 4 }]
  );

  // ── Bốn cột của quý từ lịch sử nhập / xuất, neo vào tồn hiện tại ──
  const gd = (productId: number, type: "IN" | "OUT", quantity: number, luc: string, dieuChinh = false): GiaoDichSonKy => ({ productId, type, quantity, dieuChinh, occurredAt: new Date(luc) });
  const lichSu: GiaoDichSonKy[] = [
    gd(1, "IN", 18, "2026-10-02T02:00:00Z"), // 1: tồn 10 từ trước, nhận 18, thi công 3
    gd(1, "OUT", 3, "2026-11-05T02:00:00Z"),
    gd(2, "IN", 18, "2026-10-02T02:00:00Z"), // 2: nhập theo phiếu 18, sửa nhầm về 16
    gd(2, "OUT", 2, "2026-10-03T02:00:00Z", true),
    gd(3, "OUT", 5, "2026-11-10T02:00:00Z", true), // 3: tồn 35 mang sang, kiểm kê sửa còn 30
    gd(4, "OUT", 10, "2026-11-10T02:00:00Z", true), // 4: gỡ khỏi danh sách (dòng tồn đã xóa)
    gd(5, "IN", 5, "2026-10-20T02:00:00Z"), // 5: nhận 5, sửa thêm 1
    gd(5, "IN", 1, "2026-10-21T02:00:00Z", true),
    gd(6, "IN", 2, "2026-12-01T02:00:00Z", true), // 6: tồn 4 mang sang, sửa thêm 2
    gd(7, "IN", 4, "2026-10-05T02:00:00Z"), // 7: tồn 5, nhận 4, sửa bớt 7 → Nhận về 0, còn 3 vào tồn đầu
    gd(7, "OUT", 7, "2026-10-06T02:00:00Z", true),
    gd(8, "IN", 1, "2026-09-30T16:30:00Z"), // 8: 23 giờ 30 ngày 30/09 giờ VN → quý III
    gd(8, "IN", 2, "2026-09-30T17:30:00Z"), //    0 giờ 30 ngày 01/10 giờ VN → quý IV
    gd(1, "IN", 10, "2026-08-20T02:00:00Z"), // trước quý IV: bỏ qua (tồn neo vào hiện tại); trong quý III
  ];
  const tonNay = new Map([
    [1, 25],
    [2, 16],
    [3, 30],
    [5, 6],
    [6, 6],
    [7, 2],
    [8, 3],
    [9, 0], // 9: dòng tồn 0, không phát sinh → không in
  ]);
  const cot = (r: ReturnType<typeof tinhTonQuy>) => Object.fromEntries(r.map((s) => [s.productId, [s.tonDau, s.nhan, s.tieuThu, s.tonCuoi, s.dieuChinh, s.dieuChinhVao]]));
  kiemTra("bon cot quy IV", cot(tinhTonQuy(tonNay, lichSu, q4)), {
    1: [10, 18, 3, 25, 0, null],
    2: [0, 16, 0, 16, -2, "nhan"],
    3: [30, 0, 0, 30, -5, "tonDau"],
    5: [0, 6, 0, 6, 1, "nhan"],
    6: [6, 0, 0, 6, 2, "tonDau"],
    7: [2, 0, 0, 2, -7, "ca-hai"],
    8: [1, 2, 0, 3, 0, null],
  });
  // Quý III (đã qua): giao dịch quý IV trừ ngược khỏi tồn hiện tại để ra tồn cuối quý III.
  kiemTra("bon cot quy III", cot(tinhTonQuy(tonNay, lichSu, mocQuy({ nam: 2026, quy: 3 }))), {
    1: [0, 10, 0, 10, 0, null],
    3: [35, 0, 0, 35, 0, null],
    4: [10, 0, 0, 10, 0, null],
    6: [4, 0, 0, 4, 0, null],
    7: [5, 0, 0, 5, 0, null],
    8: [0, 1, 0, 1, 0, null],
  });
  // Mọi dòng đều cân: đầu + nhận − tiêu thụ = cuối.
  kiemTra(
    "moi dong can",
    tinhTonQuy(tonNay, lichSu, q4).every((s) => Math.abs(s.tonDau + s.nhan - s.tieuThu - s.tonCuoi) < 1e-9),
    true
  );

  // ── Dòng báo cáo: xếp theo tên, mô tả như tàu ghi, đơn vị, số kiểu Việt Nam ──
  const sanPham = [
    { id: 2, name: "JOTAFIX PU TC COMP A", maker: "Jotun", colorCode: "RAL 5002", colorName: null, uom: "PAIL", packSize: 17.91 },
    { id: 1, name: "HARDTOP XP", maker: "Jotun", colorCode: "RAL 9003", colorName: "WHITE", uom: "PAIL", packSize: 20 },
  ];
  const dongGoc = dongBaoCaoQuy(
    [
      { productId: 2, tonDau: 0, nhan: 16, tieuThu: 0, tonCuoi: 16, dieuChinh: -2, dieuChinhVao: "nhan" },
      { productId: 1, tonDau: 10, nhan: 18, tieuThu: 3.5, tonCuoi: 24.5, dieuChinh: 0, dieuChinhVao: null },
      { productId: 99, tonDau: 1, nhan: 0, tieuThu: 0, tonCuoi: 1, dieuChinh: 0, dieuChinhVao: null },
    ],
    sanPham
  );
  kiemTra("dong bao cao quy", dongGoc, [
    { id: "p1", moTa: "JOTUN HARDTOP XP RAL 9003 WHITE 20L", donVi: "PAIL", tonDau: "10", nhan: "18", tieuThu: "3,5", tonCuoi: "24,5" },
    { id: "p2", moTa: "JOTUN JOTAFIX PU TC RAL 5002 COMP A 17,91L", donVi: "PAIL", tonDau: "0", nhan: "16", tieuThu: "0", tonCuoi: "16" },
  ]);
  kiemTra("can doi sau sua tay", [lechCanDoi(dongGoc[0]), lechCanDoi({ ...dongGoc[0], tonCuoi: "24" }), lechCanDoi({ ...dongGoc[0], tonCuoi: "" }), lechCanDoi({ ...dongGoc[0], nhan: "1.018" })], [false, true, false, true]);

  // ── Bản sửa tay áp lên số liệu mới nhất ──
  const dau: DauBaoCaoSon = { tenTau: "M. KEPLER", quy: "IV", nam: "2026" };
  const goc = { dau, dong: dongGoc };
  let ban = banSuaRong();
  kiemTra("ban rong = goc", [apDungBanSua(goc, ban).dong.map((d) => d.id), demChoKhac(goc, ban)], [["p1", "p2"], 0]);
  ban = suaOBanIn(goc, ban, "p1", "tieuThu", "4");
  ban = suaDauBanIn(goc, ban, "tenTau", "MERCURY KEPLER");
  kiemTra("sua o + dau", [apDungBanSua(goc, ban).dong[0].tieuThu, apDungBanSua(goc, ban).dau.tenTau, demChoKhac(goc, ban)], ["4", "MERCURY KEPLER", 2]);
  ban = suaOBanIn(goc, ban, "p1", "tieuThu", "3,5");
  kiemTra("go lai so goc la xoa cho sua", [ban.sua.p1 ?? null, demChoKhac(goc, ban)], [null, 1]);
  ban = boDongBanIn(ban, "p2");
  kiemTra("bo dong", [apDungBanSua(goc, ban).dong.map((d) => d.id), demChoKhac(goc, ban)], [["p1"], 2]);
  ban = { ...ban, them: [{ ...dongTrongBaoCao("them-a"), moTa: "Thinner No.10", donVi: "PAIL", tonCuoi: "2" }] };
  ban = doiChoDongBanIn(goc, ban, "them-a", -1);
  kiemTra("them + doi cho", [apDungBanSua(goc, ban).dong.map((d) => d.id), demChoKhac(goc, ban)], [["them-a", "p1"], 4]);
  ban = suaOBanIn(goc, ban, "them-a", "moTa", "Thinner No.17");
  kiemTra("sua dong them tay", apDungBanSua(goc, ban).dong[0].moTa, "Thinner No.17");
  // Số liệu mới: p1 vừa nhập thêm (tồn cuối đổi), p2 không còn trong quý, p3 mới nhập — ô không sửa tay hiện số mới, dòng mới nối cuối.
  const moi = { dau, dong: [{ ...dongGoc[0], tonCuoi: "30" }, { ...dongTrongBaoCao("p3"), moTa: "JOTUN PILOT II", donVi: "PAIL", tonCuoi: "5" }] };
  const banGon = gonBanSua(moi, ban);
  kiemTra("so lieu moi + don dong da go", [apDungBanSua(moi, banGon).dong.map((d) => [d.id, d.tonCuoi]), banGon.bo], [[["them-a", "2"], ["p1", "30"], ["p3", "5"]], []]);
  // Đọc từ localStorage: hỏng / bản MLS-11-05 cũ (v1) → bỏ; kiểu sai từng ô → bỏ ô đó.
  kiemTra("doc ban sua hong", [docBanSua(null), docBanSua("x"), docBanSua({ v: 1 })], [null, null, null]);
  const doc = docBanSua({ v: 2, dau: { quy: "III", tenTau: 5 }, sua: { p1: { nhan: "9", moTa: 1 } }, bo: ["p2", 3], them: [{ id: "x" }, { id: "them-b", moTa: "A" }], thuTu: null });
  kiemTra("doc ban sua loc kieu", doc, { v: 2, dau: { quy: "III" }, sua: { p1: { nhan: "9" } }, bo: ["p2"], them: [{ ...dongTrongBaoCao("them-b"), moTa: "A" }], thuTu: null });

  // ── Chia trang theo chiều cao đo được ──
  kiemTra("chia trang", chiaTrangBaoCao([10, 10, 10, 10], { trangDau: 25, trangSau: 35, ky: 8 }), [[0, 1], [2, 3]]);
  kiemTra("khoi ky keo dong cuoi sang trang", chiaTrangBaoCao([10, 10], { trangDau: 25, trangSau: 30, ky: 8 }), [[0], [1]]);
  kiemTra("khong co dong", chiaTrangBaoCao([], { trangDau: 25, trangSau: 30, ky: 8 }), [[]]);
  kiemTra("mot dong khong du cho ky", chiaTrangBaoCao([10], { trangDau: 12, trangSau: 30, ky: 8 }), [[0], []]);
  // M. KEPLER 16 loại: dòng 0,451" (43,3 px), trang đầu còn 717 px, khối ký 55 px → 15 dòng + 1 dòng cùng chữ ký.
  const chia16 = chiaTrangBaoCao(Array(16).fill(43.3), { trangDau: 717.4, trangSau: 791.2, ky: 55.2 });
  kiemTra("16 dong", chia16.map((t) => t.length), [15, 1]);
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

        // ── Nhận dạng lại tên loại sơn đã nhập nguyên chuỗi phiếu giao ──
        const tho = await tx.paintProduct.create({ data: { code: `THU-${randomUUID().slice(0, 8)}`, name: "SON JOTAFIX PU TC RAL 5002 A 17.91L", uom: "PAIL" } });
        await tx.paintStock.create({ data: { vesselId: V.id, productId: tho.id, quantity: 2 } });
        const dx = deXuatThongTinSon({ name: tho.name, maker: tho.maker, paintType: tho.paintType, colorName: tho.colorName, colorCode: tho.colorCode, packSize: tho.packSize });
        kiemTra("de xuat nhan dang", [dx.name, dx.maker, dx.paintType, dx.colorCode, dx.colorName, dx.packSize, dx.coDoi], ["JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "RAL 5002", null, 17.91, true]);
        const nd = { productId: tho.id, name: dx.name, maker: dx.maker, paintType: dx.paintType, colorName: dx.colorName, colorCode: dx.colorCode, packSize: dx.packSize, uom: "PAIL" };
        const nd1 = await apDungNhanDangTx(tx, { vesselId: V.id, ds: [nd], toanDoi: false });
        const sau = await tx.paintProduct.findUniqueOrThrow({ where: { id: tho.id } });
        kiemTra("ap dung nhan dang", [nd1.soLoai, sau.name, sau.maker, sau.paintType, sau.colorCode, sau.packSize, sau.uom, await ton(V.id, tho.id)], [1, "JOTAFIX PU TC COMP A", "Jotun", "TOPCOAT", "RAL 5002", 17.91, "PAIL", 2]);
        await loiCua("nhan dang: loai khong co trong ton tau", () => apDungNhanDangTx(tx, { vesselId: W.id, ds: [nd], toanDoi: true }), "khongCoDong");
        await loiCua("nhan dang: ten trong", () => apDungNhanDangTx(tx, { vesselId: V.id, ds: [{ ...nd, name: " " }], toanDoi: false }), "tenTrong");
        await tx.paintStock.create({ data: { vesselId: W.id, productId: tho.id, quantity: 1 } });
        await loiCua("nhan dang: dung chung tau khac -> chan", () => apDungNhanDangTx(tx, { vesselId: V.id, ds: [nd], toanDoi: false }), "sanPhamDungChung");
        await loiCua("nhan dang: thuyen truong duoc", () => apDungNhanDangTx(tx, { vesselId: V.id, ds: [nd], toanDoi: true }), "khong loi");

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
