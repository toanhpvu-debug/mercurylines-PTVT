/**
 * Kiểm TỒN KHO VẬT TƯ & PHỤ TÙNG THEO KỲ (quý) và KIỂM KÊ THEO NGÀY / THEO KỲ:
 *   - phần thuần: đọc ô kỳ "From month / Từ tháng … đến …" (lib/tonKhoQuy.ts), kỳ của
 *     một lần kiểm kê, đầu biểu mẫu MLS-11-06 từ lưới ô, xếp dòng kho vào kỳ (điều
 *     chỉnh kiểm kê cũ gộp, dòng file kiểm kê theo cột), MLS-11-01 theo cột, thống kê
 *     nhiều quý, bộ đọc AI chế độ "kiemKe" với ba cột kỳ;
 *   - đọc file: MLS-11-06 dựng tại chỗ (đầu biểu mẫu + bốn cột), tờ mẫu gốc và file
 *     app đã xuất trên Desktop nếu có;
 *   - trên database thật trong MỘT giao dịch rồi cuộn ngược: kiểm kê ngày cũ giữ
 *     nguyên phát sinh sau ngày đó, kiểm kê theo kỳ đưa ba cột về đúng file và in lại
 *     quý ra đúng file, lần hai không ghi gì, chặn tồn âm, gỡ trả tồn như cũ.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-ton-kho-quy.ts
 */
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { loaiGiaoDich, tongHop1101 } from "@/lib/baoCao1101";
import { chuanHoaKetQuaAi } from "@/lib/docPhieuBangAi";
import { dauBieuMauKiemKe, dongTuAi, dongTuExcel, kyCuaKiemKe, ngayTuOExcel, type DongKiemKe } from "@/lib/kiemKe";
import { apDungKeHoachKiemKe, goKiemKeTx, lapKeHoachKiemKe, LoiKiemKe } from "@/lib/kiemKeServer";
import { chuoiNgayVN, dauThangVN, mocQuy } from "@/lib/kyQuy";
import { docDauKiemKeExcel, parseMaterialExcel } from "@/lib/materialImport";
import { cacQuyThongKe, giaoDichKyVatTu, kyKiemKeTuFile, kyTuChuMls1106, soLieuKyVatTu, tenKyThang, thongKeNhieuQuy, type GiaoDichVatTu } from "@/lib/tonKhoQuy";

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
const ngayVN = (d: Date | null) => (d ? chuoiNgayVN(d) : null);

function phanThuan() {
  // ── Ô kỳ của MLS-11-06 ──
  const k = (s: string, ngay?: Date) => {
    const r = kyTuChuMls1106(s, ngay);
    return r ? `${r.tu.thang}/${r.tu.nam}-${r.den.thang}/${r.den.nam}` : null;
  };
  kiemTra(
    "ky tu chu",
    [
      k("Tháng 8/2026"),
      k("7/2026 đến 9/2026"),
      k("Từ tháng 7 đến tháng 9/2026"),
      k("07/2026 - 09/2026"),
      k("Quý III/2026"),
      k("Q4 2026"),
      k("From 7 to 9/2026"),
      k("11/2026 - 01/2027"),
      k("…… đến ……201x"),
      k("tháng 7 đến tháng 9", new Date("2026-09-30T05:00:00Z")),
      k("9/2026 đến 7/2026"),
    ],
    ["8/2026-8/2026", "7/2026-9/2026", "7/2026-9/2026", "7/2026-9/2026", "7/2026-9/2026", "10/2026-12/2026", "7/2026-9/2026", "11/2026-1/2027", null, "7/2026-9/2026", null]
  );
  kiemTra("ten ky", [tenKyThang({ nam: 2026, thang: 7 }, { nam: 2026, thang: 9 }), tenKyThang({ nam: 2026, thang: 8 }, { nam: 2026, thang: 8 })], ["07/2026 đến 09/2026 (quý III)", "Tháng 08/2026"]);

  // ── Kỳ của một lần kiểm kê ──
  const bayGio = new Date("2026-10-03T03:00:00Z");
  const kyFile = kyKiemKeTuFile({ kyChu: "7/2026 đến 9/2026", ngayFile: null, ngayChon: null, coCotKy: true, bayGio });
  kiemTra("ky file: dau ky + ngay cuoi ky", [ngayVN(kyFile.tuNgay), ngayVN(kyFile.ngayKiemKe)], ["2026-07-01", "2026-09-30"]);
  const chiDem = kyKiemKeTuFile({ kyChu: "7/2026 đến 9/2026", ngayFile: null, ngayChon: null, coCotKy: false, bayGio });
  kiemTra("ky file: khong co cot ky -> chi so dem", [chiDem.tuNgay, ngayVN(chiDem.ngayKiemKe)], [null, "2026-09-30"]);
  const khongKy = kyKiemKeTuFile({ kyChu: null, ngayFile: new Date("2026-09-28T05:00:00Z"), ngayChon: null, coCotKy: true, bayGio });
  kiemTra("ky file: khong ghi ky -> quy chua ngay", [ngayVN(khongKy.tuNgay), ngayVN(khongKy.ngayKiemKe), Boolean(khongKy.ghiChu?.includes("quý III/2026"))], ["2026-07-01", "2026-09-28", true]);
  const tuongLai = kyKiemKeTuFile({ kyChu: "Quý IV/2026", ngayFile: null, ngayChon: null, coCotKy: true, bayGio });
  kiemTra("ky file: quy dang chay -> ngay kiem ke = hom nay", [ngayVN(tuongLai.tuNgay), tuongLai.ngayKiemKe.getTime()], ["2026-10-01", bayGio.getTime()]);
  const kk = kyCuaKiemKe({ tuNgay: dauThangVN(2026, 7), ngayKiemKe: new Date("2026-09-30T05:00:00Z") });
  kiemTra("ky kiem ke: [0h 01/07, 0h 01/10) gio VN", [kk.batDau.toISOString(), kk.ketThuc.toISOString(), kk.coKy], ["2026-06-30T17:00:00.000Z", "2026-09-30T17:00:00.000Z", true]);
  const kk2 = kyCuaKiemKe({ tuNgay: null, ngayKiemKe: new Date("2026-09-28T05:00:00Z") });
  kiemTra("ky kiem ke chi so dem: ky rong het ngay", [kk2.batDau.toISOString(), kk2.ketThuc.toISOString(), kk2.coKy], ["2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z", false]);

  // ── Đầu biểu mẫu từ lưới ô ──
  const luoi = [
    ["MERCURY LINES", null, null, "STORES INVENTORY", null, null, null, "MLS-11-06"],
    [],
    ["Vsl./Tàu:", null, "M. ODYSSEY", null, "Date/Ngày:", null, null, 46295],
    ["Dept./ Bộ phận:", null, "Máy", null, "From month/", null, null, "7/2026 đến 9/2026"],
    [null, null, null, null, "Từ tháng:", null, null, null],
  ];
  const dau = dauBieuMauKiemKe(luoi);
  kiemTra("dau bieu mau", [dau.tau, ngayVN(dau.ngay), dau.kyChu], ["M. ODYSSEY", "2026-09-30", "7/2026 đến 9/2026"]);
  kiemTra("o ngay excel", [ngayVN(ngayTuOExcel("30/09/2026")), ngayVN(ngayTuOExcel("2026-09-30")), ngayTuOExcel("abc")], ["2026-09-30", "2026-09-30", null]);

  // ── Xếp dòng kho vào kỳ ──
  const q3 = mocQuy({ nam: 2026, quy: 3 });
  const g = (id: number, type: string, quantity: number, luc: string, note: string | null = null, cotBaoCao: string | null = null): GiaoDichVatTu => ({
    materialId: id,
    type,
    quantity,
    note,
    occurredAt: new Date(luc),
    cotBaoCao,
  });
  kiemTra(
    "dong kho -> dong ky",
    [
      giaoDichKyVatTu(g(1, "IN", 5, "2026-08-01T00:00:00Z", "Kiểm kê theo file X (#3)")).dieuChinh,
      giaoDichKyVatTu(g(1, "IN", 5, "2026-08-01T00:00:00Z", "Nhận hàng PO-2026-001")).dieuChinh,
      giaoDichKyVatTu(g(1, "OUT", 5, "2026-08-01T00:00:00Z", "Tiêu thụ trong kỳ theo kiểm kê X (#3)", "tieuThu")).dieuChinh,
      giaoDichKyVatTu(g(1, "IN", 5, "2026-06-30T16:59:59Z", "Còn tồn đợt trước theo kiểm kê X (#3)", "tonDau")).dieuChinh,
    ],
    [true, false, false, true]
  );
  // Kiểm kê kiểu cũ (+3, ghi chú — nạp tồn / đếm lại): gộp vào Còn tồn đợt trước, KHÔNG thành nhận; dòng file kiểm kê theo cột nằm đúng cột.
  const sl = soLieuKyVatTu(
    new Map([
      [1, 26],
      [2, 9],
    ]),
    [
      g(1, "IN", 18, "2026-08-10T03:00:00Z"),
      g(1, "IN", 3, "2026-08-20T03:00:00Z", "Kiểm kê theo file A (#1)"),
      g(1, "OUT", 5, "2026-09-30T16:59:59Z", "Tiêu thụ trong kỳ theo kiểm kê B (#2)", "tieuThu"),
      g(2, "IN", 2, "2026-09-30T16:59:59Z", "Điều chỉnh kiểm kê B (#2): tồn ngày kiểm kê 7 → 9", "tonCuoi"),
    ],
    q3
  );
  kiemTra(
    "bon cot quy: kiem ke cu gop vao Con ton dot truoc, dong file dung cot",
    sl.map((s) => [s.materialId, s.cot.tonDau, s.cot.nhan, s.cot.tieuThu, s.cot.tonCuoi, s.cot.dieuChinh]),
    [
      [1, 13, 18, 5, 26, 3],
      [2, 9, 0, 0, 9, 2],
    ]
  );
  // MLS-11-01: dòng file theo cột Nhận / Tiêu thụ là nhận / dùng thật (kể cả dòng "bớt"), còn lại là điều chỉnh.
  kiemTra(
    "1101 theo cot",
    [loaiGiaoDich({ type: "OUT", note: "Tiêu thụ trong kỳ theo kiểm kê", cotBaoCao: "tieuThu" }), loaiGiaoDich({ type: "IN", note: "Nhận trong kỳ theo kiểm kê", cotBaoCao: "nhan" }), loaiGiaoDich({ type: "IN", note: "x", cotBaoCao: "tonCuoi" }), loaiGiaoDich({ type: "IN", note: "Nhận hàng PO-1" })],
    ["DUNG", "NHAN", "KIEM_KE", "NHAN"]
  );
  const th = tongHop1101({
    tonHienTai: new Map([[1, 20]]),
    giaoDich: [
      { materialId: 1, type: "IN", quantity: 10, occurredAt: new Date("2026-09-05T03:00:00Z"), note: "Nhận hàng PO-1", performedBy: null },
      { materialId: 1, type: "OUT", quantity: 2, occurredAt: new Date("2026-09-30T16:00:00Z"), note: "Sửa số nhận trong kỳ theo kiểm kê X", performedBy: null, cotBaoCao: "nhan" },
      { materialId: 1, type: "IN", quantity: 1, occurredAt: new Date("2026-09-30T16:00:00Z"), note: "Sửa số tiêu thụ trong kỳ theo kiểm kê X", performedBy: null, cotBaoCao: "tieuThu" },
      { materialId: 1, type: "OUT", quantity: 4, occurredAt: new Date("2026-09-20T03:00:00Z"), note: "Xuất dùng", performedBy: null },
    ],
    dau: dauThangVN(2026, 9),
    cuoi: dauThangVN(2026, 10),
    nhanDauTien: new Map(),
  }).get(1)!;
  kiemTra("1101: bot nhan / bot tieu thu tru dung cot", [th.tonDau, th.nhan, th.dung, th.dieuChinh, th.tonCuoi], [15, 8, 3, 0, 20]);

  // ── Thống kê nhiều quý ──
  const bayGioTk = new Date("2026-10-03T03:00:00Z");
  const cacQuy = cacQuyThongKe(bayGioTk, null);
  kiemTra("4 quy gan nhat", cacQuy.map((x) => `${x.quy}/${x.nam}`), ["1/2026", "2/2026", "3/2026", "4/2026"]);
  kiemTra("quy cua nam (toi quy hien tai)", cacQuyThongKe(bayGioTk, 2026).length, 4);
  const tk = thongKeNhieuQuy(
    new Map([
      [1, 12],
      [2, 7],
    ]),
    [
      g(1, "IN", 20, "2026-01-10T03:00:00Z"),
      g(1, "OUT", 6, "2026-02-10T03:00:00Z"),
      g(1, "OUT", 4, "2026-05-10T03:00:00Z"),
      g(1, "OUT", 2, "2026-08-10T03:00:00Z"),
      g(1, "IN", 4, "2026-10-02T03:00:00Z"),
    ],
    cacQuy,
    bayGioTk
  );
  const a = tk.find((x) => x.materialId === 1)!;
  const b = tk.find((x) => x.materialId === 2)!;
  kiemTra("thong ke: tieu thu tung quy, TB 3 quy da het, du dung", [a.theoQuy.map((q) => [q.nhan, q.tieuThu, q.soLanNhan, q.soLanXuat]), a.tongNhan, a.tongTieuThu, a.tbTieuThuQuy, a.duDungQuy], [
    [
      [20, 6, 1, 1],
      [0, 4, 0, 1],
      [0, 2, 0, 1],
      [4, 0, 1, 0],
    ],
    24,
    12,
    4,
    3,
  ]);
  kiemTra("thong ke: hang nam kho", [b.khongBienDong, b.tbTieuThuQuy, b.duDungQuy], [true, 0, null]);

  // ── Bộ đọc AI chế độ "kiemKe" với ba cột kỳ ──
  const ai = chuanHoaKetQuaAi({
    tau: "M. ODYSSEY",
    ngayGiao: "30/09/2026",
    kyBaoCao: "7/2026 đến 9/2026",
    dong: [
      { stt: 1, ten: "Găng tay", impa: "190101", donVi: "PAIR", soLuong: 40, tonDau: 50, nhan: 20, tieuThu: 30, loai: "STORE" },
      { stt: 2, ten: "Lọc dầu", partNo: "LF-1", donVi: "PCS", soLuong: null, tonDau: 4, nhan: null, tieuThu: "-", loai: "SPARE" },
    ],
  });
  kiemTra("ai kiem ke: ky + dong", [ai.kyBaoCao, ai.dong.map((d) => [d.soLuong, d.soLuongTrong, d.bc])], [
    "7/2026 đến 9/2026",
    [
      [40, false, { tonDau: 50, nhan: 20, tieuThu: 30, tonCuoi: 40 }],
      [0, true, { tonDau: 4, nhan: null, tieuThu: 0, tonCuoi: null }],
    ],
  ]);
  kiemTra("ai kiem ke -> dong kiem ke", dongTuAi(ai.dong).map((d) => [d.ton, d.bc]), [
    [40, { tonDau: 50, nhan: 20, tieuThu: 30 }],
    [null, { tonDau: 4, nhan: null, tieuThu: 0 }],
  ]);
}

/** Một MLS-11-06 tối thiểu như tàu điền: đầu biểu mẫu + hai hàng tiêu đề + bốn cột. */
async function mls1106(dong: (string | number | null)[][], ky: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.getRow(1).values = ["MERCURY LINES COMPANY LIMITED", null, null, "STORES INVENTORY", null, null, null, "MLS-11-06"];
  ws.getRow(7).values = ["Vsl./Tàu:", null, "M. ODYSSEY", null, "Date/Ngày:", null, null, new Date(Date.UTC(2026, 8, 30))];
  ws.getRow(8).values = ["Dept./             Bộ phận:", null, "Máy", null, "From month/", null, null, ky];
  ws.getRow(9).values = [null, null, null, null, "Từ tháng:"];
  ws.getRow(11).values = ["S. No.", "Group", "Description", null, "IMPA Code", "Unit", "Last R.O.B", "Receive", "Cons.", "R.O.B"];
  ws.getRow(12).values = ["Stt.", "Nhóm", "Mô tả", null, "Mã IMPA", "Đơn vị", "Còn tồn đợt trước", "Nhận trong kỳ", "Tiêu thụ trong kỳ", "Tồn trên tàu"];
  dong.forEach((d, i) => (ws.getRow(13 + i).values = d));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function phanTep() {
  const buf = await mls1106(
    [
      [1, "Vật tư máy", "Lõi lọc dầu bôi trơn", null, "345678", "PCS", 24, 8, 7, 25],
      [2, "Vật tư máy", "Lõi lọc nhiên liệu", null, "345679", "PCS", 37, null, "-", 37],
      [3, "Vật tư máy", "Gioăng nắp máy", null, null, "PCS", null, null, null, 6],
    ],
    "7/2026 đến 9/2026"
  );
  const kq = parseMaterialExcel(buf);
  const dong = dongTuExcel(kq.items);
  kiemTra("excel 1106: bo hang tieu de thu hai, doc bon cot", dong.map((d) => [d.ten, d.ton, d.bc]), [
    ["Lõi lọc dầu bôi trơn", 25, { tonDau: 24, nhan: 8, tieuThu: 7 }],
    ["Lõi lọc nhiên liệu", 37, { tonDau: 37, nhan: null, tieuThu: 0 }],
    ["Gioăng nắp máy", 6, null],
  ]);
  const dau = docDauKiemKeExcel(buf);
  kiemTra("excel 1106: dau bieu mau", [dau.tau, ngayVN(dau.ngay), dau.kyChu], ["M. ODYSSEY", "2026-09-30", "7/2026 đến 9/2026"]);

  // Tờ mẫu gốc của công ty (chưa điền kỳ) và file app đã xuất (Tháng 8/2026) — có thì kiểm.
  const mau = "C:/Users/admin/Desktop/MLS-11-06 Store & Spare Part Inventory 11.4.2017.xlsx";
  if (existsSync(mau)) {
    const d = docDauKiemKeExcel(readFileSync(mau));
    kiemTra("to mau goc: o ky chua dien -> khong co ky", kyTuChuMls1106(d.kyChu, d.ngay), null);
  } else console.log("  (bo qua to mau goc: khong co file tren Desktop)");
  const xuat = "C:/Users/admin/Desktop/MLS-11-06_ML-001_2026-08-15.xlsx";
  if (existsSync(xuat)) {
    const b = readFileSync(xuat);
    const d = docDauKiemKeExcel(b);
    const ky = kyTuChuMls1106(d.kyChu, d.ngay);
    const ds = dongTuExcel(parseMaterialExcel(b).items);
    kiemTra("file app da xuat: ky thang 8, dong co ba cot ky", [ky && `${ky.tu.thang}/${ky.tu.nam}-${ky.den.thang}/${ky.den.nam}`, ds.length > 0 && ds.every((x) => x.bc !== undefined && x.ton !== null)], ["8/2026-8/2026", true]);
  } else console.log("  (bo qua file app da xuat: khong co tren Desktop)");
}

async function phanDatabase() {
  const kho = await prisma.warehouse.findFirst({ where: { vesselId: { not: null } }, orderBy: { id: "asc" }, select: { id: true, vesselId: true } });
  if (!kho?.vesselId) {
    console.log("  (bo qua phan database: chua co kho cua tau)");
    return;
  }
  const vesselId = kho.vesselId;
  const ma = () => `THU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const dongMau = (ten: string, ton: number | null, bc: DongKiemKe["bc"] = null): DongKiemKe => ({
    ten,
    tenEn: null,
    impa: null,
    partNo: null,
    donVi: "PCS",
    thietBi: null,
    nhom: null,
    loai: "STORE",
    sheet: null,
    ton,
    bc,
    trang: null,
    canhBao: null,
    boQua: false,
    themMoi: false,
  });
  try {
    await prisma.$transaction(
      async (tx) => {
        const tonCua = (materialId: number) =>
          tx.inventory.findUnique({ where: { materialId_warehouseId: { materialId, warehouseId: kho.id } } }).then((r) => r?.quantity ?? null);
        const taoHang = async (ten: string, ton: number, gd: { type: string; quantity: number; luc: string; note?: string }[]) => {
          const m = await tx.material.create({ data: { code: ma(), nameVn: ten, uom: "PCS" } });
          await tx.vesselMaterial.create({ data: { vesselId, materialId: m.id } });
          await tx.inventory.create({ data: { materialId: m.id, warehouseId: kho.id, vesselId, quantity: ton } });
          for (const x of gd) {
            await tx.inventoryTransaction.create({
              data: { type: x.type, materialId: m.id, warehouseId: kho.id, vesselId, quantity: x.quantity, occurredAt: new Date(x.luc), note: x.note ?? null },
            });
          }
          return m;
        };
        const bayGio = new Date("2026-10-10T03:00:00Z");

        // 1. File chỉ có số đếm, ngày kiểm kê 30/09 — sau đó (05/10) đã xuất 3: tồn hiện tại = số đếm − 3.
        const a = await taoHang("HANG THU KIEM KE NGAY ZZQ", 13, [
          { type: "IN", quantity: 16, luc: "2026-08-10T03:00:00Z" },
          { type: "OUT", quantity: 3, luc: "2026-10-05T03:00:00Z" },
        ]);
        const kyA = kyCuaKiemKe({ tuNgay: null, ngayKiemKe: new Date("2026-09-30T05:00:00Z") });
        const keA = await lapKeHoachKiemKe(vesselId, [dongMau(a.nameVn, 12)], "AUTO", kyA, tx);
        kiemTra("ngay cu: so app het ngay KK = 16, chenh -4", [keA.dong[0].trangThai, keA.dong[0].tonNgay, keA.dong[0].chenhLech, keA.dong[0].tonSau], ["THAY_DOI", 16, -4, 9]);
        const kqA = await apDungKeHoachKiemKe(tx, { vesselId, keHoach: keA, kiemKeId: 990001, tenFile: "THU-A.xlsx", nguoi: "Kiểm thử", bayGio });
        const gdA = await tx.inventoryTransaction.findMany({ where: { kiemKeId: 990001 } });
        kiemTra("ngay cu: giu xuat sau ngay KK, dong ghi het ngay 30/09", [kqA.soButToan, await tonCua(a.id), gdA.map((x) => [x.type, x.quantity, x.cotBaoCao, x.occurredAt.toISOString()])], [
          1,
          9,
          [["OUT", 4, "tonCuoi", "2026-09-30T16:59:59.999Z"]],
        ]);
        const keA2 = await lapKeHoachKiemKe(vesselId, [dongMau(a.nameVn, 12)], "AUTO", kyA, tx);
        kiemTra("ngay cu: ap lai lan hai -> khop", keA2.dong[0].trangThai, "KHONG_DOI");

        // 2. File theo kỳ quý III (Còn tồn đợt trước 10 · Nhận 18 · Tiêu thụ 5 · R.O.B 23); app chưa ghi tiêu thụ, sau kỳ đã xuất 2.
        const b = await taoHang("HANG THU KIEM KE KY ZZQ", 26, [
          { type: "IN", quantity: 10, luc: "2026-05-10T03:00:00Z" },
          { type: "IN", quantity: 18, luc: "2026-08-10T03:00:00Z", note: "Nhận hàng PO-THU" },
          { type: "OUT", quantity: 2, luc: "2026-10-05T03:00:00Z" },
        ]);
        const kyB = kyCuaKiemKe({ tuNgay: dauThangVN(2026, 7), ngayKiemKe: new Date("2026-09-30T05:00:00Z") });
        const fileB = [dongMau(b.nameVn, 23, { tonDau: 10, nhan: 18, tieuThu: 5 })];
        const keB = await lapKeHoachKiemKe(vesselId, fileB, "AUTO", kyB, tx);
        kiemTra("ky: chi ghi tieu thu 5", [keB.dong[0].trangThai, keB.dong[0].buToan.map((x) => [x.loai, x.so, x.cot]), keB.dong[0].tonSau], ["THAY_DOI", [["TIEU_THU", 5, "tieuThu"]], 21]);
        await apDungKeHoachKiemKe(tx, { vesselId, keHoach: keB, kiemKeId: 990002, tenFile: "THU-B.xlsx", nguoi: "Kiểm thử", bayGio });
        const gdB = await tx.inventoryTransaction.findMany({ where: { materialId: b.id }, select: { materialId: true, type: true, quantity: true, note: true, occurredAt: true, cotBaoCao: true } });
        const quyB = soLieuKyVatTu(new Map([[b.id, (await tonCua(b.id)) ?? 0]]), gdB, mocQuy({ nam: 2026, quy: 3 }))[0];
        kiemTra("ky: in lai quy III = file, ton hien tai giu xuat sau ky", [[quyB.cot.tonDau, quyB.cot.nhan, quyB.cot.tieuThu, quyB.cot.tonCuoi], await tonCua(b.id)], [[10, 18, 5, 23], 21]);
        const keB2 = await lapKeHoachKiemKe(vesselId, fileB, "AUTO", kyB, tx);
        kiemTra("ky: ap lai lan hai -> khop", keB2.dong[0].trangThai, "KHONG_DOI");

        // 3. Số đếm nhỏ hơn phần đã xuất sau ngày kiểm kê → tồn âm: kế hoạch đánh dấu, áp dụng bị chặn.
        const c = await taoHang("HANG THU KIEM KE AM ZZQ", 1, [
          { type: "IN", quantity: 6, luc: "2026-08-10T03:00:00Z" },
          { type: "OUT", quantity: 5, luc: "2026-10-05T03:00:00Z" },
        ]);
        const keC = await lapKeHoachKiemKe(vesselId, [dongMau(c.nameVn, 2)], "AUTO", kyA, tx);
        let loi: string | null = null;
        try {
          await apDungKeHoachKiemKe(tx, { vesselId, keHoach: keC, kiemKeId: 990003, tenFile: "THU-C.xlsx", nguoi: "Kiểm thử", bayGio });
        } catch (e) {
          loi = e instanceof LoiKiemKe ? e.ma : String(e);
        }
        kiemTra("ton am: danh dau + chan", [keC.dong[0].trangThai, keC.dong[0].tonSau, loi], ["AM", -3, "am"]);

        // 3b. Kho tự động mà mặt hàng có hàng ở HAI kho của tàu: không biết chia số đếm → dừng dòng đó, không ghi gì.
        const kho2 = await tx.warehouse.findFirst({ where: { vesselId, id: { not: kho.id } }, select: { id: true } });
        if (kho2) {
          const d = await taoHang("HANG THU HAI KHO ZZQ", 4, []);
          await tx.inventory.create({ data: { materialId: d.id, warehouseId: kho2.id, vesselId, quantity: 3 } });
          const keD = await lapKeHoachKiemKe(vesselId, [dongMau(d.nameVn, 9)], "AUTO", kyA, tx);
          const kqD = await apDungKeHoachKiemKe(tx, { vesselId, keHoach: keD, kiemKeId: 990004, tenFile: "THU-D.xlsx", nguoi: "Kiểm thử", bayGio });
          kiemTra("hai kho: dung, khong ghi", [keD.dong[0].trangThai, keD.dong[0].nhieuKho?.length, kqD.soButToan, await tonCua(d.id)], ["NHIEU_KHO", 2, 0, 4]);
          const keD2 = await lapKeHoachKiemKe(vesselId, [dongMau(d.nameVn, 9)], String(kho.id), kyA, tx);
          kiemTra("hai kho: chon han kho thi doi chieu duoc", [keD2.dong[0].trangThai, keD2.dong[0].tonSau], ["THAY_DOI", 9]);
        } else console.log("  (bo qua thu hai kho: tau chi co mot kho)");

        // 4. Gỡ: trả tồn như cũ, xóa đúng các dòng đã ghi.
        const go = await goKiemKeTx(tx, 990002);
        kiemTra("go kiem ke ky: ton tro lai, dong da xoa", [go, await tonCua(b.id), await tx.inventoryTransaction.count({ where: { kiemKeId: 990002 } })], [{ soDong: 1, soMatHang: 1 }, 26, 0]);
        await goKiemKeTx(tx, 990001);
        kiemTra("go kiem ke ngay: ton tro lai", await tonCua(a.id), 13);
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
}

async function main() {
  phanThuan();
  await phanTep();
  await phanDatabase();
  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  if (truot) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
