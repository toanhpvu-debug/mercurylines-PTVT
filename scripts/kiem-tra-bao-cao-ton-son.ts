/**
 * Kiểm CẬP NHẬT TỒN SƠN THEO BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14 tải lên:
 *   - phần thuần (lib/baoCaoTonSon.ts): nhận ra báo cáo, đọc ô số / quý / năm, đọc
 *     bảng từ lưới ô (Word / Excel, tiêu đề một hoặc hai hàng), chữ Word .doc tách
 *     tab, lớp chữ PDF (tên xuống dòng, sang trang, tiêu đề lặp, chữ OCR không dấu
 *     ngăn), kế hoạch đưa số app về đúng báo cáo (lập lần đầu, chỉ thiếu tiêu thụ,
 *     khớp sẵn, bớt nhận, chỉ có tồn cuối, tàu cộng sai, phát sinh sau quý), ghi chú
 *     dòng, gộp / soát dòng; bộ đọc AI chế độ "baoCaoTon";
 *   - ghép dòng với danh mục sơn (lib/phieuSon.ts): tờ in MLS-11-14 của app tải lại
 *     về đúng loại, tàu gõ kiểu khác, không chắc thì không chọn;
 *   - đọc tệp thật (lib/baoCaoTonSonTep.ts): .docx dựng tại chỗ, Excel, và tờ Word
 *     mẫu trên Desktop nếu có;
 *   - trên database thật trong MỘT giao dịch rồi cuộn ngược: cập nhật theo báo cáo,
 *     in lại quý ra đúng bốn cột của báo cáo, giữ phát sinh sau quý, chặn tồn âm,
 *     gỡ báo cáo trả tồn về như cũ.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-bao-cao-ton-son.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import {
  boTickThieuTonCuoi,
  cotGhiButToan,
  docChuPdfBaoCaoTon,
  docLuoiBaoCaoTon,
  dongLoiBaoCaoTon,
  dongNhanTuBaoCao,
  ghiChuButToan,
  gopDongBaoCaoTon,
  keHoachBaoCaoTon,
  laBaoCaoTon,
  luoiTuChuWord,
  namTuChu,
  ngayCuoiQuy,
  ngayNhanCuaKy,
  quyTuChu,
  soBaoCao,
  soPhieuBaoCao,
} from "@/lib/baoCaoTonSon";
import { docBaoCaoTonKhongAi, laPhieuYeuCau } from "@/lib/baoCaoTonSonTep";
import { chuanHoaKetQuaAi } from "@/lib/docPhieuBangAi";
import { boSungNhanDang, chiMucNhanDangSon, chonTheoNhanDang, dongTuAiSon, ghepDongSon, type DongNhanSon } from "@/lib/phieuSon";
import { capNhatTheoBaoCaoTonTx } from "@/lib/phieuSonServer";
import { heThongQuy, moTaSonIn, mocQuy, quyCua, tinhTonQuy, type GiaoDichSonKy, type HeThongQuy } from "@/lib/tonSon";
import { LoiTonSon, goPhieuSonTx } from "@/lib/tonSonServer";
import type { SonGhep } from "@/lib/yeuCauSon";

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
const gon = (r: { dong: { stt: number | null; ten: string; donVi: string | null; tonDau: number | null; nhan: number | null; tieuThu: number | null; tonCuoi: number | null }[] }) =>
  r.dong.map((d) => [d.stt, d.ten, d.donVi, d.tonDau, d.nhan, d.tieuThu, d.tonCuoi]);

function phanThuan() {
  // ── Nhận ra báo cáo tồn ──
  kiemTra(
    "nhan ra bao cao",
    [
      laBaoCaoTon("BÁO CÁO LƯỢNG SƠN TỒN\nPAINT INVENTORY\tMLS-11-14"),
      laBaoCaoTon("No. | Paint name | Unit | In stock | Receive | Consume | Remain"),
      laBaoCaoTon("DELIVERY NOTE DN-9001\n1 | Hardtop XP | 20 | LTR"),
      laBaoCaoTon("REQUISITION FOR STORES MLS-11-05 R.O.B"),
    ],
    [true, true, false, false]
  );
  kiemTra("phieu yeu cau MLS-11-05", [laPhieuYeuCau("REQUISITION FOR STORES / YÊU CẦU VẬT TƯ"), laPhieuYeuCau("MLS-11-05B"), laPhieuYeuCau("BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14")], [true, true, false]);

  // ── Ô số / quý / năm ──
  kiemTra("o so", [soBaoCao("17,91"), soBaoCao("1.000"), soBaoCao("-"), soBaoCao(""), soBaoCao("abc"), soBaoCao("3 pail"), soBaoCao(" 0 ")], [17.91, 1000, 0, null, null, 3, 0]);
  kiemTra("quy", [quyTuChu("III"), quyTuChu("3"), quyTuChu("Q4"), quyTuChu("Quý IV/2026"), quyTuChu("ii"), quyTuChu("2026"), quyTuChu("")], [3, 3, 4, 4, 2, null, null]);
  kiemTra("nam", [namTuChu("2026"), namTuChu("IV/2026"), namTuChu("26"), namTuChu(null)], [2026, 2026, null, null]);
  kiemTra("ngay cuoi quy", [ngayCuoiQuy({ nam: 2026, quy: 1 }), ngayCuoiQuy({ nam: 2024, quy: 1 }), ngayCuoiQuy({ nam: 2026, quy: 3 }), ngayCuoiQuy({ nam: 2026, quy: 4 })], [
    "2026-03-31",
    "2024-03-31",
    "2026-09-30",
    "2026-12-31",
  ]);
  // Ngày lưu (trưa ngày cuối quý, giờ máy) đọc lại ra đúng quý dù máy chạy giờ UTC hay giờ Việt Nam.
  kiemTra("ngay luu doc lai dung quy", quyCua(ngayNhanCuaKy({ nam: 2026, quy: 3 })), { nam: 2026, quy: 3 });
  kiemTra("so phieu", [soPhieuBaoCao({ nam: 2026, quy: 3 }), soPhieuBaoCao(null)], ["MLS-11-14 · quý III/2026", "MLS-11-14"]);

  // ── Lưới ô của bảng Word (.docx): bảng thông tin + bảng chính, dòng mẫu trống, chữ ký ──
  const luoi = [
    ["Tên tàu Vessel:", "", "M. KEPLER", "Quý/Quarter:", "", "III", "Năm/Year:", "2026"],
    ["Stt No.", "Tên sơn Paint name", "Đơn vị Unit", "Tồn đầu kỳ In stock", "Nhận Recive", "Tiêu thụ trong kỳ Consume", "Tồn cuối kỳ Remain"],
    ["1", "JOTUN HARDTOP XP RAL 9003 WHITE 20L", "PAIL", "10", "18", "5", "23"],
    ["2", "JOTUN THINNER NO.17 20L", "PAIL", "2", "", "-", "2"],
    ["", "", "", "", "", "", ""],
    ["3", "SON JOTAFIX PU TC RAL 5002 A 17.91L", "PAIL", "", "4", "1", ""],
    ["", "Thuyền Trưởng", "", "", "", "", "Đại Phó"],
    ["9", "không đọc dòng này", "PAIL", "1", "1", "1", "1"],
  ];
  const r1 = docLuoiBaoCaoTon(luoi);
  kiemTra("luoi: dau", r1.dau, { tau: "M. KEPLER", quy: 3, nam: 2026 });
  kiemTra("luoi: dong", gon(r1), [
    [1, "JOTUN HARDTOP XP RAL 9003 WHITE 20L", "PAIL", 10, 18, 5, 23],
    [2, "JOTUN THINNER NO.17 20L", "PAIL", 2, null, 0, 2],
    [3, "SON JOTAFIX PU TC RAL 5002 A 17.91L", "PAIL", null, 4, 1, null],
  ]);
  // Tiêu đề Việt / Anh nằm hai hàng (Excel), cột lệch sang phải, nhãn và giá trị chung ô.
  const r2 = docLuoiBaoCaoTon([
    ["", "BÁO CÁO LƯỢNG SƠN TỒN", "", "", "", "", "", ""],
    ["", "Tên tàu Vessel: M. ODYSSEY", "", "Quý/Quarter: IV", "", "Năm/Year: 2026", "", ""],
    ["", "Stt", "Tên sơn", "Đơn vị", "Tồn đầu kỳ", "Nhận", "Tiêu thụ trong kỳ", "Tồn cuối kỳ"],
    ["", "No.", "Paint name", "Unit", "In stock", "Recive", "Consume", "Remain"],
    ["", "1", "HEMPADUR 45143 GREY", "PAIL", "5", "0", "1", "4"],
  ]);
  kiemTra("excel tieu de hai hang", [r2.dau, gon(r2)], [{ tau: "M. ODYSSEY", quy: 4, nam: 2026 }, [[1, "HEMPADUR 45143 GREY", "PAIL", 5, 0, 1, 4]]]);
  kiemTra("luoi khong phai bao cao", docLuoiBaoCaoTon([["Product", "Qty"], ["Hardtop", "20"]]).coBang, false);

  // ── Chữ Word .doc (word-extractor): ô kết thúc bằng tab, hàng bằng tab + xuống dòng ──
  const chuDoc = [
    "Tên tàu Vessel:\t\tM. KEPLER\tQuý/Quarter:\t\tIII\tNăm/Year:\t2026\t",
    "",
    "Stt",
    "No.\tTên sơn",
    " Paint name\tĐơn vị",
    "Unit\tTồn đầu kỳ",
    "In stock\tNhận",
    "Recive\tTiêu thụ trong kỳ",
    "Consume\tTồn cuối kỳ",
    "Remain\t",
    "1\tJOTUN HARDTOP XP\tPAIL\t10\t18\t5\t23\t",
    "\t\t\t\t\t\t\t",
    "\t\tThuyền Trưởng\t\t\t\tĐại Phó",
    "Captain    Chief Officer",
  ].join("\n");
  const r3 = docLuoiBaoCaoTon(luoiTuChuWord(chuDoc));
  kiemTra("chu word .doc", [r3.dau, gon(r3)], [{ tau: "M. KEPLER", quy: 3, nam: 2026 }, [[1, "JOTUN HARDTOP XP", "PAIL", 10, 18, 5, 23]]]);

  // ── Lớp chữ PDF (tờ in của app): tên xuống dòng chia đều trên / dưới dòng số, sang trang ──
  const chuPdf = [
    "--- trang 1 ---",
    "MLS-11-14",
    "BÁO CÁO LƯỢNG SƠN TỒN | Issued date: 10/01/2024",
    "MERCURY LINES | PAINT INVENTORY",
    "COMPANY LIMITED | Page: 1/2",
    "Tên tàu | M. ODYSSEY | Quý/Quarter: | IV | Năm/Year: | 2026",
    "Vessel:",
    "Tiêu thụ",
    "Stt | Tên sơn | Đơn vị | Tồn đầu kỳ | Nhận | Tồn cuối kỳ",
    "trong kỳ",
    "No. | Paint name | Unit | In stock | Recive | Remain",
    "Consume",
    "HEMPEL HEMPADUR 45143",
    "1 | PAIL | 5 | 0 | 1 | 4",
    "GREY 20L",
    "JOTUN JOTAFIX EPOXY PRIMER",
    "2 | PAIL | 0 | 6 | 2 | 4",
    "GREY COMP A 15L",
    "3 | JOTUN THINNER NO.10 20L | PAIL | 0 | 4 | 0 | 4",
    "Người làm báo cáo: CE, CO | Thời gian lưu: 3 năm",
    "--- trang 2 ---",
    "MLS-11-14",
    "COMPANY LIMITED | Page: 2/2",
    "Tiêu thụ",
    "Stt | Tên sơn | Đơn vị | Tồn đầu kỳ | Nhận | Tồn cuối kỳ",
    "trong kỳ",
    "No. | Paint name | Unit | In stock | Recive | Remain",
    "Consume",
    "4 | Jotun Sơn chống rỉ | PAIL | 35 | 0 | 0 | 35",
    "Thuyền Trưởng | Đại Phó",
    "Captain | Chief Officer",
  ].join("\n");
  const r4 = docChuPdfBaoCaoTon(chuPdf);
  kiemTra("pdf: dau", r4.dau, { tau: "M. ODYSSEY", quy: 4, nam: 2026 });
  kiemTra("pdf: dong", gon(r4), [
    [1, "HEMPEL HEMPADUR 45143 GREY 20L", "PAIL", 5, 0, 1, 4],
    [2, "JOTUN JOTAFIX EPOXY PRIMER GREY COMP A 15L", "PAIL", 0, 6, 2, 4],
    [3, "JOTUN THINNER NO.10 20L", "PAIL", 0, 4, 0, 4],
    [4, "Jotun Sơn chống rỉ", "PAIL", 35, 0, 0, 35],
  ]);
  // Chữ OCR (bản scan) không có dấu ngăn cột.
  const r5 = docChuPdfBaoCaoTon(["Stt Tên sơn Đơn vị Tồn đầu kỳ Nhận Tiêu thụ trong kỳ Tồn cuối kỳ", "1 JOTUN HARDTOP XP WHITE PAIL 10 18 5 23", "2 THINNER NO.17 PAIL 2 0 - 2"].join("\n"));
  kiemTra("pdf chu OCR", gon(r5), [
    [1, "JOTUN HARDTOP XP WHITE", "PAIL", 10, 18, 5, 23],
    [2, "THINNER NO.17", "PAIL", 2, 0, 0, 2],
  ]);

  // ── Kế hoạch đưa số app về đúng báo cáo ──
  const ht = (x: Partial<HeThongQuy>): HeThongQuy => ({ hienTai: 0, dauKy: 0, nhan: 0, tieuThu: 0, dieuChinh: 0, nhanBc: 0, tieuThuBc: 0, cuoiBc: 0, cuoiKy: 0, ...x });
  const gonKh = (k: ReturnType<typeof keHoachBaoCaoTon>) => [k.buToan.map((b) => [b.loai, b.so, b.luc, b.cot]), k.tongDoi, k.hienTaiMoi, k.khop];
  // Lập lần đầu (app chưa có gì): tồn mang sang + nhận + tiêu thụ → in lại quý ra đúng bốn cột.
  kiemTra("ke hoach: lan dau", gonKh(keHoachBaoCaoTon({ tonDau: 10, nhan: 18, tieuThu: 5, tonCuoi: 23 }, ht({}))), [
    [
      ["DIEU_CHINH", 10, "DAU_KY", "tonDau"],
      ["NHAN", 18, "CUOI_KY", "nhan"],
      ["TIEU_THU", 5, "CUOI_KY", "tieuThu"],
    ],
    23,
    23,
    false,
  ]);
  // App đã nhập phiếu giao, chưa ghi tiêu thụ: chỉ thêm dòng xuất dùng.
  const daNhap = ht({ hienTai: 28, dauKy: 10, nhan: 18, cuoiKy: 28 });
  kiemTra("ke hoach: chi thieu tieu thu", gonKh(keHoachBaoCaoTon({ tonDau: 10, nhan: 18, tieuThu: 5, tonCuoi: 23 }, daNhap)), [[["TIEU_THU", 5, "CUOI_KY", "tieuThu"]], -5, 23, false]);
  kiemTra("ke hoach: khop san", gonKh(keHoachBaoCaoTon({ tonDau: 10, nhan: 18, tieuThu: 0, tonCuoi: 28 }, daNhap)), [[], 0, 28, true]);
  // Phiếu nhập nhầm 18, tàu nhận thật 16: điều chỉnh bớt vào Nhận (không thành tiêu thụ).
  kiemTra("ke hoach: bot nhan", gonKh(keHoachBaoCaoTon({ tonDau: 10, nhan: 16, tieuThu: 0, tonCuoi: 26 }, daNhap)), [[["DIEU_CHINH", -2, "CUOI_KY", "nhan"]], -2, 26, false]);
  // Báo cáo chỉ ghi tồn cuối: thiếu = tiêu thụ; thừa = điều chỉnh.
  kiemTra("ke hoach: chi ton cuoi, thieu", gonKh(keHoachBaoCaoTon({ tonDau: null, nhan: null, tieuThu: null, tonCuoi: 20 }, daNhap)), [[["TIEU_THU", 8, "CUOI_KY", "tonCuoi"]], -8, 20, false]);
  kiemTra("ke hoach: chi ton cuoi, thua", gonKh(keHoachBaoCaoTon({ tonDau: null, nhan: null, tieuThu: null, tonCuoi: 30 }, daNhap)), [[["DIEU_CHINH", 2, "CUOI_KY", "tonCuoi"]], 2, 30, false]);
  // Tàu cộng trừ sai (10 + 18 − 5 ≠ 22): khớp đủ cột rồi điều chỉnh để tồn cuối đúng báo cáo.
  kiemTra("ke hoach: tau cong sai", gonKh(keHoachBaoCaoTon({ tonDau: 10, nhan: 18, tieuThu: 5, tonCuoi: 22 }, daNhap)), [
    [
      ["TIEU_THU", 5, "CUOI_KY", "tieuThu"],
      ["DIEU_CHINH", -1, "CUOI_KY", "tonCuoi"],
    ],
    -6,
    22,
    false,
  ]);
  // Sau cuối quý đã nhận thêm 2: tồn hiện tại = tồn cuối báo cáo + 2.
  kiemTra("ke hoach: phat sinh sau quy giu nguyen", keHoachBaoCaoTon({ tonDau: 10, nhan: 18, tieuThu: 5, tonCuoi: 23 }, { ...daNhap, hienTai: 30 }).hienTaiMoi, 25);
  // Sau cuối quý đã dùng nhiều hơn số báo cáo còn → tồn hiện tại âm (nơi gọi chặn).
  kiemTra("ke hoach: am", keHoachBaoCaoTon({ tonDau: null, nhan: null, tieuThu: null, tonCuoi: 20 }, { ...daNhap, hienTai: 3 }).hienTaiMoi, -5);
  // App ghi tiêu thụ nhiều hơn báo cáo: điều chỉnh tăng.
  kiemTra(
    "ke hoach: bot tieu thu",
    gonKh(keHoachBaoCaoTon({ tonDau: 10, nhan: 18, tieuThu: 4, tonCuoi: 24 }, ht({ hienTai: 22, dauKy: 10, nhan: 18, tieuThu: 6, cuoiKy: 22 }))),
    [[["DIEU_CHINH", 2, "CUOI_KY", "tieuThu"]], 2, 24, false]
  );
  // App so như TỜ IN: lần Sửa số trong quý đã gộp vào Nhận (nhận 2, sửa −1 → in 1) — tải lại tờ in thì khớp.
  kiemTra("ke hoach: to in co sua so, khop san", gonKh(keHoachBaoCaoTon({ tonDau: 0, nhan: 1, tieuThu: 0, tonCuoi: 1 }, ht({ hienTai: 1, nhan: 2, dieuChinh: -1, cuoiKy: 1 }))), [[], 0, 1, true]);

  // ── Cập nhật rồi IN LẠI quý (sổ ảo, đúng cách máy chủ ghi): ra đúng báo cáo, cập nhật lần nữa không ghi gì ──
  const q3 = mocQuy({ nam: 2026, quy: 3 });
  const gdAo = (type: "IN" | "OUT", quantity: number, luc: string, dieuChinh = false, cotBaoCao: string | null = null): GiaoDichSonKy => ({ productId: 1, type, quantity, dieuChinh, occurredAt: new Date(luc), cotBaoCao });
  const apDungAo = (soCai: GiaoDichSonKy[], bao: { tonDau: number | null; nhan: number | null; tieuThu: number | null; tonCuoi: number }) => {
    const ton = (ds: GiaoDichSonKy[]) => ds.reduce((s, g) => s + (g.type === "IN" ? g.quantity : -g.quantity), 0);
    const kh = keHoachBaoCaoTon(bao, heThongQuy(ton(soCai), soCai, q3));
    const ghi = kh.buToan.map((b) => ({
      productId: 1,
      type: b.loai === "NHAN" ? "IN" : b.loai === "TIEU_THU" ? "OUT" : b.so > 0 ? "IN" : "OUT",
      quantity: Math.abs(b.so),
      dieuChinh: b.loai === "DIEU_CHINH",
      occurredAt: new Date((b.luc === "DAU_KY" ? q3.batDau : q3.ketThuc).getTime() - 1),
      cotBaoCao: cotGhiButToan(b),
    }));
    const sau = [...soCai, ...ghi];
    const inLai = tinhTonQuy(new Map([[1, ton(sau)]]), sau, q3)[0];
    const lan2 = keHoachBaoCaoTon(bao, heThongQuy(ton(sau), sau, q3));
    return [kh.buToan.map((b) => [b.loai, b.so, b.cot]), inLai && [inLai.tonDau, inLai.nhan, inLai.tieuThu, inLai.tonCuoi], lan2.khop];
  };
  // App ghi xuất dùng nhiều hơn báo cáo + một lần Sửa số −1 trong quý: in lại vẫn đúng 10 / 18 / 4 / 24.
  kiemTra(
    "in lai: bot tieu thu, co sua so",
    apDungAo([gdAo("IN", 10, "2026-05-10T03:00:00Z"), gdAo("IN", 18, "2026-08-10T03:00:00Z"), gdAo("OUT", 6, "2026-08-20T03:00:00Z"), gdAo("OUT", 1, "2026-09-01T03:00:00Z", true)], { tonDau: 10, nhan: 18, tieuThu: 4, tonCuoi: 24 }),
    [
      [
        ["NHAN", 1, "nhan"],
        ["DIEU_CHINH", 2, "tieuThu"],
      ],
      [10, 18, 4, 24],
      true,
    ]
  );
  // Quý không nhận gì, Sửa số −1 đã gộp vào Tồn đầu kỳ (in 4); báo cáo ghi nhận 2: chỉ thêm dòng nhận, Tồn đầu kỳ giữ 4.
  kiemTra(
    "in lai: sua so o ton dau, them nhan",
    apDungAo([gdAo("IN", 5, "2026-05-10T03:00:00Z"), gdAo("OUT", 1, "2026-07-05T03:00:00Z", true)], { tonDau: 4, nhan: 2, tieuThu: 0, tonCuoi: 6 }),
    [[["NHAN", 2, "nhan"]], [4, 2, 0, 6], true]
  );
  // Lập lần đầu đủ bốn cột (tồn mang sang ghi ngay trước đầu quý).
  kiemTra("in lai: lan dau", apDungAo([], { tonDau: 10, nhan: 18, tieuThu: 5, tonCuoi: 23 }), [
    [
      ["DIEU_CHINH", 10, "tonDau"],
      ["NHAN", 18, "nhan"],
      ["TIEU_THU", 5, "tieuThu"],
    ],
    [10, 18, 5, 23],
    true,
  ]);
  // Báo cáo chỉ ghi Tồn cuối kỳ: phần thiếu thành tiêu thụ, in ra ở cột Tiêu thụ.
  kiemTra("in lai: chi ton cuoi", apDungAo([gdAo("IN", 10, "2026-05-10T03:00:00Z"), gdAo("IN", 18, "2026-08-10T03:00:00Z")], { tonDau: null, nhan: null, tieuThu: null, tonCuoi: 20 }), [
    [["TIEU_THU", 8, "tonCuoi"]],
    [10, 18, 8, 20],
    true,
  ]);
  // Báo cáo không cân (10 + 18 − 5 ≠ 22): tồn cuối theo báo cáo; cập nhật lần hai không ghi chồng.
  kiemTra("in lai: bao cao khong can", apDungAo([gdAo("IN", 10, "2026-05-10T03:00:00Z"), gdAo("IN", 18, "2026-08-10T03:00:00Z")], { tonDau: 10, nhan: 18, tieuThu: 5, tonCuoi: 22 }), [
    [
      ["TIEU_THU", 5, "tieuThu"],
      ["DIEU_CHINH", -1, "tonCuoi"],
    ],
    [10, 17, 5, 22],
    true,
  ]);

  // ── Ghi chú dòng ──
  const ky = { nam: 2026, quy: 3 as const };
  kiemTra(
    "ghi chu",
    [
      ghiChuButToan({ loai: "DIEU_CHINH", so: 10, luc: "DAU_KY", cot: "tonDau", truoc: 0, sau: 10 }, ky),
      ghiChuButToan({ loai: "TIEU_THU", so: 5, luc: "CUOI_KY", cot: "tieuThu", truoc: 0, sau: 5 }, ky),
      ghiChuButToan({ loai: "DIEU_CHINH", so: -1.5, luc: "CUOI_KY", cot: "tonCuoi", truoc: 23.5, sau: 22 }, ky),
    ],
    [
      "Tồn đầu quý III/2026 theo báo cáo tồn MLS-11-14: 0 → 10",
      "Tiêu thụ quý III/2026 theo báo cáo tồn MLS-11-14 (đã ghi 0, báo cáo 5)",
      "Tồn cuối quý III/2026 theo báo cáo tồn MLS-11-14: 23,5 → 22",
    ]
  );

  // ── Soát / gộp dòng ──
  const dn = dongNhanTuBaoCao(r1.dong);
  const tick = boTickThieuTonCuoi(dn);
  kiemTra("bo tick thieu ton cuoi (0 van giu)", tick.map((d) => d.boQua), [false, false, true]);
  kiemTra("loi bao cao", [dongLoiBaoCaoTon(dn), dongLoiBaoCaoTon(tick)], [{ n: 3, lyDo: "thieuSo" }, null]);
  const gop = gopDongBaoCaoTon([
    { ...dn[0], paintProductId: 7 },
    { ...dn[1], paintProductId: 7, bc: { tonDau: 2, nhan: null, tieuThu: 0 } },
    { ...dn[0], ten: "Son moi", paintProductId: null },
  ]);
  kiemTra("gop dong", gop.map((g) => [g.khoa, g.tonCuoi, g.bc, g.soDong]), [
    ["id:7", 25, { tonDau: 12, nhan: 18, tieuThu: 5 }, 2],
    ["moi:son moi|||", 23, { tonDau: 10, nhan: 18, tieuThu: 5 }, 1],
  ]);

  // ── Bộ đọc AI chế độ "baoCaoTon": bốn cột, tồn cuối 0 là số thật, quý / năm ──
  const ai = chuanHoaKetQuaAi({
    soPhieu: "MLS-11-14",
    tau: "M. KEPLER",
    quy: "III",
    nam: 2026,
    dong: [
      { stt: 1, ten: "JOTUN HARDTOP XP", donVi: "PAIL", tonDau: 10, nhan: "18", tieuThu: "-", tonCuoi: 0 },
      { stt: 2, ten: "THINNER NO.17", donVi: null, tonDau: null, nhan: null, tieuThu: null, tonCuoi: null },
    ],
  });
  kiemTra("ai: dau", [ai.quy, ai.nam, ai.tau], ["III", "2026", "M. KEPLER"]);
  kiemTra("ai: cot so", ai.dong.map((d) => [d.bc, d.soLuong, d.soLuongTrong, d.donVi]), [
    [{ tonDau: 10, nhan: 18, tieuThu: 0, tonCuoi: 0 }, 0, false, "PAIL"],
    [{ tonDau: null, nhan: null, tieuThu: null, tonCuoi: null }, 0, true, ""],
  ]);
  kiemTra("ai -> dong soat", dongTuAiSon(ai.dong).map((d) => [d.soLuong, d.bc, d.dvt]), [
    [0, { tonDau: 10, nhan: 18, tieuThu: 0 }, "PAIL"],
    [null, { tonDau: null, nhan: null, tieuThu: null }, null],
  ]);
}

/** Dòng soát tối thiểu chỉ có mô tả như trên báo cáo. */
const dongTen = (ten: string): DongNhanSon => ({ ten, hang: null, mau: null, maMau: null, ma: null, dvt: "PAIL", soLuong: 1, dungTich: null, loaiSon: null, paintProductId: null, boQua: false, canhBao: null, ghiChu: null });

function phanGhep() {
  // Danh mục như tàu M. ODYSSEY (tên chuẩn của phiếu giao, hãng / màu / mã màu ở ô riêng).
  const ds: [string, string | null, string | null, string | null, number][] = [
    ["JOTAFIX PU TC COMP B (ĐÓNG RẮN)", "Jotun", null, null, 2],
    ["JOTUN THINNER NO.10", "Jotun", null, null, 20],
    ["JOTAFIX PU TC COMP A", "Jotun", null, "BLACK", 18],
    ["JOTAFIX PU TC COMP A", "Jotun", "RAL 3000", null, 18],
    ["JOTAFIX PU TC COMP A", "Jotun", "STD 038", "GREY", 18],
    ["JOTAFIX EPOXY PRIMER COMP A", "Jotun", null, "GREY", 15],
    ["JOTAFIX EPOXY PRIMER COMP A", "Jotun", null, "RED", 15],
    ["JOTAFIX EPOXY PRIMER COMP B", "Jotun", null, null, 3],
    ["JOTAFIX PU TC COMP A", "Jotun", "RAL 5002", null, 17.91],
    ["JOTUN HARTOP PAL 9003A", "Jotun", null, "WHITE", 20],
    ["JOTUN HARTOPX", "Jotun", "STD 2571C", "GREEN", 20],
    ["HEMPADUR 45143", "Hempel", null, "GREY", 20],
    ["Sơn chống rỉ", "Jotun", null, null, 20],
  ];
  const son: SonGhep[] = ds.map(([name, maker, colorCode, colorName, packSize], i) => ({ id: i + 1, code: `SON-${i + 1}`, name, maker, colorCode, colorName, uom: "PAIL", packSize }));
  // Tờ in MLS-11-14 của chính app (tên kèm hãng / màu / dung tích) tải lại: mỗi dòng về đúng loại của nó.
  const tenIn = son.map((s) => moTaSonIn(s));
  kiemTra("ghep: ten tren to in", tenIn.slice(0, 7), [
    "JOTUN JOTAFIX PU TC COMP B (ĐÓNG RẮN) 2L",
    "JOTUN THINNER NO.10 20L",
    "JOTUN JOTAFIX PU TC BLACK COMP A 18L",
    "JOTUN JOTAFIX PU TC RAL 3000 COMP A 18L",
    "JOTUN JOTAFIX PU TC STD 038 GREY COMP A 18L",
    "JOTUN JOTAFIX EPOXY PRIMER GREY COMP A 15L",
    "JOTUN JOTAFIX EPOXY PRIMER RED COMP A 15L",
  ]);
  kiemTra("ghep: to in cua app ve dung loai", ghepDongSon(boSungNhanDang(tenIn.map(dongTen)), son).map((d) => d.paintProductId), son.map((s) => s.id));
  // Tàu gõ lại kiểu khác: chữ thường, "Gray", có / không tên hãng, thành phần viết "A" cuối.
  kiemTra(
    "ghep: tau go kieu khac",
    ghepDongSon(boSungNhanDang(["Jotun Jotafix Epoxy Primer Gray Comp A 15L", "JOTAFIX EPOXY PRIMER RED A 15L", "HEMPEL HEMPADUR 45143 GREY 20L"].map(dongTen)), son).map((d) => d.paintProductId),
    [6, 7, 12]
  );
  // Không chắc thì không chọn: khác hãng, hoặc hai cỡ thùng mà dòng không ghi dung tích.
  const chiMuc = chiMucNhanDangSon([...son, { ...son[1], id: 99, code: "SON-99", packSize: 5 }]);
  const chon = (ten: string) => chonTheoNhanDang(boSungNhanDang([dongTen(ten)])[0], chiMuc)?.id ?? null;
  kiemTra("ghep: chi khi chac", [chon("HEMPEL THINNER NO.10 20L"), chon("JOTUN THINNER NO.10 5L"), chon("JOTUN THINNER NO.10 20L"), chon("JOTUN THINNER NO.10")], [null, 99, 2, null]);
}

/** Một .docx tối thiểu đúng khung MLS-11-14 (header trang có tên biểu mẫu, hai bảng trong thân). */
async function docxMau(hang: string[][], thongTin: string[]): Promise<Buffer> {
  const o = (s: string, span = 1) => `<w:tc><w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}</w:tcPr><w:p><w:r><w:t xml:space="preserve">${s}</w:t></w:r></w:p></w:tc>`;
  const oHaiDoan = (a: string, b: string) => `<w:tc><w:p><w:r><w:t>${a}</w:t></w:r></w:p><w:p><w:r><w:t>${b}</w:t></w:r></w:p></w:tc>`;
  const bangTT = `<w:tbl><w:tr>${thongTin.map((x) => o(x)).join("")}</w:tr></w:tbl>`;
  const tieuDe = [
    ["Stt", "No."],
    ["Tên sơn", "Paint name"],
    ["Đơn vị", "Unit"],
    ["Tồn đầu kỳ", "In stock"],
    ["Nhận", "Recive"],
    ["Tiêu thụ trong kỳ", "Consume"],
    ["Tồn cuối kỳ", "Remain"],
  ];
  const bang = `<w:tbl><w:tr>${tieuDe.map(([a, b]) => oHaiDoan(a, b)).join("")}</w:tr>${hang.map((h) => `<w:tr>${h.map((x) => o(x)).join("")}</w:tr>`).join("")}</w:tbl>`;
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const zip = new JSZip();
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document ${ns}><w:body>${bangTT}<w:p/>${bang}<w:sectPr/></w:body></w:document>`);
  zip.file("word/header2.xml", `<?xml version="1.0"?><w:hdr ${ns}><w:p><w:r><w:t>BÁO CÁO LƯỢNG SƠN TỒN</w:t></w:r></w:p><w:p><w:r><w:t>MLS-11-14</w:t></w:r></w:p></w:hdr>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function phanTep() {
  // .docx: tên tàu / quý / năm ở bảng thông tin, tiêu đề hai đoạn mỗi ô, dòng mẫu trống.
  const docx = await docxMau(
    [
      ["1", "JOTUN HARDTOP XP RAL 9003 WHITE 20L", "PAIL", "10", "18", "5", "23"],
      ["2", "SON JOTAFIX PU TC RAL 3000 A 18L", "PAIL", "0", "4", "1", "3"],
      ["", "", "", "", "", "", ""],
    ],
    ["Tên tàu Vessel:", "", "M. KEPLER", "Quý/Quarter:", "", "III", "Năm/Year:", "2026"]
  );
  const k1 = await docBaoCaoTonKhongAi(docx, "MLS-11-14 M KEPLER Q3.docx");
  kiemTra("docx: doc duoc", k1.ok && [k1.dau, k1.dong.length], [{ tau: "M. KEPLER", quy: 3, nam: 2026 }, 2]);
  if (k1.ok) kiemTra("docx: dong soat", k1.dong.map((d) => [d.ten, d.dvt, d.soLuong, d.bc]), [
    ["JOTUN HARDTOP XP RAL 9003 WHITE 20L", "PAIL", 23, { tonDau: 10, nhan: 18, tieuThu: 5 }],
    ["SON JOTAFIX PU TC RAL 3000 A 18L", "PAIL", 3, { tonDau: 0, nhan: 4, tieuThu: 1 }],
  ]);
  // Ô gộp ngang (gridSpan) không làm lệch cột.
  const docxGop = await docxMau([["1", "HEMPADUR 45143", "PAIL", "5", "0", "1", "4"]], ["Tên tàu Vessel:", "M. ODYSSEY", "Quý/Quarter:", "IV", "Năm/Year:", "2026"]);
  const k2 = await docBaoCaoTonKhongAi(docxGop, "x.docx");
  kiemTra("docx: tau / quy / nam o lien nhau", k2.ok && k2.dau, { tau: "M. ODYSSEY", quy: 4, nam: 2026 });

  // Excel.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("MLS-11-14");
  for (const r of [
    ["BÁO CÁO LƯỢNG SƠN TỒN / PAINT INVENTORY", "", "", "", "", "", "MLS-11-14"],
    ["Tên tàu Vessel:", "M. ATLAS", "Quý/Quarter:", "II", "Năm/Year:", "2026", ""],
    ["Stt No.", "Tên sơn Paint name", "Đơn vị Unit", "Tồn đầu kỳ In stock", "Nhận Recive", "Tiêu thụ trong kỳ Consume", "Tồn cuối kỳ Remain"],
    [1, "HEMPATHANE HS 55610 WHITE", "Ltr", 40, 0, 12.5, 27.5],
  ])
    ws.addRow(r);
  const k3 = await docBaoCaoTonKhongAi(Buffer.from(await wb.xlsx.writeBuffer()), "MLS-11-14.xlsx");
  kiemTra("excel", k3.ok && [k3.dau, k3.dong.map((d) => [d.ten, d.dvt, d.soLuong, d.bc])], [
    { tau: "M. ATLAS", quy: 2, nam: 2026 },
    [["HEMPATHANE HS 55610 WHITE", "Ltr", 27.5, { tonDau: 40, nhan: 0, tieuThu: 12.5 }]],
  ]);
  // Phiếu giao (không phải báo cáo) → không nhận là báo cáo.
  const wb2 = new ExcelJS.Workbook();
  const ws2 = wb2.addWorksheet("DN");
  for (const r of [["Product", "Maker", "Qty"], ["Hardtop XP", "Jotun", 20]]) ws2.addRow(r);
  const k4 = await docBaoCaoTonKhongAi(Buffer.from(await wb2.xlsx.writeBuffer()), "DN.xlsx");
  kiemTra("phieu giao khong phai bao cao", [k4.ok, !k4.ok && k4.laBaoCao], [false, false]);

  // Tờ Word mẫu thật của công ty (.doc, chưa điền) — có thì kiểm.
  const mau = "C:/Users/admin/Desktop/MLS-11-14 BC LUONG SON TON 11.4.2017.doc";
  if (existsSync(mau)) {
    const k5 = await docBaoCaoTonKhongAi(readFileSync(mau), "MLS-11-14.doc");
    kiemTra("to mau that: nhan ra, chua co dong", [k5.ok, !k5.ok && k5.laBaoCao], [false, true]);
  } else console.log("  (bo qua to mau that: khong co file tren Desktop)");
}

async function phanDatabase() {
  const tau = await prisma.vessel.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  const nguoi = await prisma.user.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (!tau || !nguoi) {
    console.log("  (bo qua phan database: chua co tau / nguoi dung)");
    return;
  }
  const ky = { nam: 2026, quy: 3 as const };
  const { batDau, ketThuc } = mocQuy(ky);
  const ma = () => `THU-${randomUUID().slice(0, 8)}`;
  const tonCua = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], productId: number) =>
    tx.paintStock.findUnique({ where: { vesselId_productId: { vesselId: tau.id, productId } } }).then((s) => s?.quantity ?? null);
  try {
    await prisma.$transaction(
      async (tx) => {
        // Loại có sẵn: tồn mang sang 10 (quý II), nhận 18 trong quý III, dùng 2 sau quý (quý IV).
        const p = await tx.paintProduct.create({ data: { code: ma(), name: "Son Thu Bao Cao Ton ZZB", maker: "Hang Thu", uom: "PAIL" } });
        await tx.paintTransaction.createMany({
          data: [
            { vesselId: tau.id, productId: p.id, type: "IN", quantity: 10, occurredAt: new Date("2026-05-10T03:00:00Z") },
            { vesselId: tau.id, productId: p.id, type: "IN", quantity: 18, occurredAt: new Date("2026-08-10T03:00:00Z") },
            { vesselId: tau.id, productId: p.id, type: "OUT", quantity: 2, occurredAt: new Date("2026-10-05T03:00:00Z") },
          ],
        });
        await tx.paintStock.create({ data: { vesselId: tau.id, productId: p.id, quantity: 26 } });
        const tep = await tx.sonPhieuTep.create({
          data: { vesselId: tau.id, loai: "BAO_CAO_TON", fileName: "thu.docx", storedName: `${ma()}.docx`, loaiTep: "WORD", size: 1, sha256: "thu", dong: [], nguoiTaiId: nguoi.id, nguoiTai: "Kiểm thử" },
        });
        const dong: DongNhanSon[] = [
          { ten: "x", hang: null, mau: null, maMau: null, ma: null, dvt: "PAIL", soLuong: 23, dungTich: null, loaiSon: null, paintProductId: p.id, boQua: false, canhBao: null, ghiChu: null, bc: { tonDau: 10, nhan: 18, tieuThu: 5 } },
          { ten: "Son Moi Bao Cao ZZB RAL 3000", hang: "Hang Thu", mau: null, maMau: "RAL 3000", ma: null, dvt: "PAIL", soLuong: 3, dungTich: 18, loaiSon: null, paintProductId: null, boQua: false, canhBao: null, ghiChu: null, bc: { tonDau: 0, nhan: 4, tieuThu: 1 } },
          // Loại mới mà mọi số bằng 0 / trống: không tạo loại rỗng.
          { ten: "Son Rong ZZB", hang: null, mau: null, maMau: null, ma: null, dvt: "PAIL", soLuong: 0, dungTich: null, loaiSon: null, paintProductId: null, boQua: false, canhBao: null, ghiChu: null, bc: { tonDau: null, nhan: null, tieuThu: null } },
        ];
        const soLoaiTruoc = await tx.paintProduct.count();
        const kq = await capNhatTheoBaoCaoTonTx(tx, { vesselId: tau.id, dong, ky, nguoi: "Kiểm thử", phieuSonId: tep.id, bayGio: new Date("2026-10-10T03:00:00Z") });
        kiemTra("cap nhat: ket qua", [kq.soLoai, kq.soKhop, kq.soDoi, kq.taoMoi, kq.soButToan, await tx.paintProduct.count()], [2, 0, 2, 1, 3, soLoaiTruoc + 1]);
        // Tồn hiện tại = tồn cuối báo cáo 23 − 2 đã dùng sau quý.
        kiemTra("cap nhat: giu phat sinh sau quy", await tonCua(tx, p.id), 21);
        const moi = kq.sanPham.find((s) => s.taoMoi)!;
        // Loại mới đặt theo tên chuẩn (lib/tenSon.ts tách mã màu RAL ra ô riêng), như phiếu giao.
        const spMoi = await tx.paintProduct.findUniqueOrThrow({ where: { id: moi.productId } });
        kiemTra("cap nhat: loai moi", [await tonCua(tx, moi.productId), spMoi.name, spMoi.colorCode, spMoi.notes], [3, "Son Moi Bao Cao ZZB", "RAL 3000", "Tên trên báo cáo tồn: Son Moi Bao Cao ZZB RAL 3000"]);
        const gd = await tx.paintTransaction.findMany({ where: { phieuSonId: tep.id }, orderBy: { id: "asc" } });
        kiemTra(
          "cap nhat: dong ghi (ngay cuoi quy, gan phieu, cot bao cao)",
          gd.map((g) => [g.productId === p.id ? "cu" : "moi", g.type, g.quantity, g.dieuChinh, g.occurredAt.toISOString(), g.cotBaoCao]),
          [
            ["cu", "OUT", 5, false, "2026-09-30T16:59:59.999Z", "tieuThu"],
            ["moi", "IN", 4, false, "2026-09-30T16:59:59.999Z", "nhan"],
            ["moi", "OUT", 1, false, "2026-09-30T16:59:59.999Z", "tieuThu"],
          ]
        );
        // In lại báo cáo quý III từ app: đúng bốn cột của báo cáo tàu gửi.
        const tonNay = new Map((await tx.paintStock.findMany({ where: { vesselId: tau.id, productId: { in: [p.id, moi.productId] } } })).map((s) => [s.productId, s.quantity]));
        const gdQuy = await tx.paintTransaction.findMany({ where: { vesselId: tau.id, productId: { in: [p.id, moi.productId] }, occurredAt: { gte: batDau } } });
        const quy = tinhTonQuy(tonNay, gdQuy, { batDau, ketThuc });
        kiemTra(
          "in lai quy III = bao cao",
          [p.id, moi.productId].map((id) => quy.find((s) => s.productId === id)).map((s) => s && [s.tonDau, s.nhan, s.tieuThu, s.tonCuoi]),
          [
            [10, 18, 5, 23],
            [0, 4, 1, 3],
          ]
        );
        // Cập nhật lại đúng báo cáo đó lần nữa: đã khớp, không ghi gì.
        const lai = await capNhatTheoBaoCaoTonTx(tx, { vesselId: tau.id, dong, ky, nguoi: "Kiểm thử", phieuSonId: null });
        kiemTra("cap nhat lan hai: khop san", [lai.soKhop, lai.soButToan], [2, 0]);
        // Báo cáo còn ít hơn số đã dùng sau quý → chặn (tồn hiện tại âm).
        let am: string | null = null;
        try {
          await capNhatTheoBaoCaoTonTx(tx, { vesselId: tau.id, dong: [{ ...dong[0], soLuong: 1, bc: { tonDau: null, nhan: null, tieuThu: null } }], ky, nguoi: "Kiểm thử" });
        } catch (e) {
          am = e instanceof LoiTonSon ? e.ma : String(e);
        }
        kiemTra("chan ton am", am, "baoCaoAm");
        // Gỡ báo cáo: hoàn lại mọi dòng (cộng lại phần xuất dùng), loại do báo cáo tạo mới bị xóa.
        await tx.sonPhieuTep.update({ where: { id: tep.id }, data: { trangThai: "DA_AP_DUNG", ketQua: kq, apDungLuc: new Date() } });
        const go = await goPhieuSonTx(tx, { tepId: tep.id, lyDo: "thử gỡ", nguoi: "Kiểm thử", luc: "-" });
        kiemTra("go bao cao", [go.soLoai, go.soDong, go.xoaLoai, await tonCua(tx, p.id), await tx.paintProduct.findUnique({ where: { id: moi.productId } })], [2, 3, 1, 26, null]);
        // Dòng chưa chọn loại mà mô tả kèm tên hãng (như tờ in của app): dùng lại loại có sẵn, không tạo loại trùng.
        const q = await tx.paintProduct.create({ data: { code: ma(), name: "JOTAFIX ZZB PRIMER COMP A", maker: "Jotun", colorName: "GREY", uom: "PAIL", packSize: 15 } });
        const soLoaiTruocQ = await tx.paintProduct.count();
        const kq2 = await capNhatTheoBaoCaoTonTx(tx, {
          vesselId: tau.id,
          dong: [{ ...dong[1], ten: "JOTUN JOTAFIX ZZB PRIMER GREY COMP A 15L", hang: null, maMau: null, dungTich: null, soLuong: 2, bc: { tonDau: 0, nhan: 2, tieuThu: 0 } }],
          ky,
          nguoi: "Kiểm thử",
        });
        kiemTra("loai co san ghi kem ten hang: dung lai", [kq2.taoMoi, kq2.sanPham.map((s) => s.productId), await tx.paintProduct.count(), await tonCua(tx, q.id)], [0, [q.id], soLoaiTruocQ, 2]);
        // App có Sửa số −1 trong quý và ghi xuất dùng nhiều hơn báo cáo: cập nhật rồi in lại quý III ra đúng báo cáo.
        const r = await tx.paintProduct.create({ data: { code: ma(), name: "Son Thu In Lai ZZB", maker: "Hang Thu", uom: "PAIL" } });
        await tx.paintTransaction.createMany({
          data: [
            { vesselId: tau.id, productId: r.id, type: "IN", quantity: 10, occurredAt: new Date("2026-05-10T03:00:00Z") },
            { vesselId: tau.id, productId: r.id, type: "IN", quantity: 18, occurredAt: new Date("2026-08-10T03:00:00Z") },
            { vesselId: tau.id, productId: r.id, type: "OUT", quantity: 6, occurredAt: new Date("2026-08-20T03:00:00Z") },
            { vesselId: tau.id, productId: r.id, type: "OUT", quantity: 1, dieuChinh: true, occurredAt: new Date("2026-09-01T03:00:00Z") },
          ],
        });
        await tx.paintStock.create({ data: { vesselId: tau.id, productId: r.id, quantity: 21 } });
        const dongR = [{ ...dong[0], paintProductId: r.id, soLuong: 24, bc: { tonDau: 10, nhan: 18, tieuThu: 4 } }];
        const kq3 = await capNhatTheoBaoCaoTonTx(tx, { vesselId: tau.id, dong: dongR, ky, nguoi: "Kiểm thử", bayGio: new Date("2026-10-10T03:00:00Z") });
        const gdR = await tx.paintTransaction.findMany({ where: { vesselId: tau.id, productId: r.id, occurredAt: { gte: batDau } } });
        const inR = tinhTonQuy(new Map([[r.id, (await tonCua(tx, r.id)) ?? 0]]), gdR, { batDau, ketThuc })[0];
        const lanHai = await capNhatTheoBaoCaoTonTx(tx, { vesselId: tau.id, dong: dongR, ky, nguoi: "Kiểm thử" });
        kiemTra("in lai sau sua so + bot tieu thu", [kq3.soButToan, await tonCua(tx, r.id), [inR.tonDau, inR.nhan, inR.tieuThu, inR.tonCuoi], lanHai.soButToan], [2, 24, [10, 18, 4, 24], 0]);
        throw new CuonNguoc();
      },
      { timeout: 60000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
}

async function main() {
  phanThuan();
  phanGhep();
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
