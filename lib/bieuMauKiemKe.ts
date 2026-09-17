import ExcelJS from "exceljs";
import { LOGO_MERCURY_LINES_PNG_BASE64 } from "@/lib/logoMercuryLinesPng";

// Cố ý KHÔNG có "server-only" như phần lớn file trong lib/: file này chỉ xếp chữ
// vào một workbook, không chạm session, database hay biến môi trường. Đánh dấu
// server-only thì script kiểm thử (scripts/thu-xuat-kiem-ke.ts) chạy ngoài Next
// sẽ ném lỗi ngay lúc import — mà dựng thử được bản in ở ngoài Next chính là
// cách duy nhất soát bố cục mà không phải đăng nhập và bấm nút.

/**
 * Biểu mẫu kiểm kê MLS-11-06 — dựng lại và điền dữ liệu.
 *
 * Hai việc trong một file, vì chúng phải hiểu bố cục GIỐNG HỆT nhau:
 *
 *   1. dungBieuMauKiemKe(): dựng workbook chép đúng biểu mẫu gốc của công ty —
 *      từng bề rộng cột, chiều cao dòng, ô gộp, phông Times New Roman, kiểu
 *      viền (đôi / mảnh / sợi tóc), thiết lập in dọc A4, và logo ở góc trái.
 *      Dùng khi hệ thống chưa nạp tệp gốc (Mua sắm → Biểu mẫu). Mọi con số ở
 *      đây đọc ra từ tệp gốc bằng scripts/soi-dinh-dang-bieu-mau.ts, không
 *      phải ước lượng bằng mắt.
 *
 *   2. dienDongKiemKe(): điền các dòng tồn kho vào một workbook có bố cục ấy —
 *      dù là bản tự dựng hay tệp gốc vừa nạp. Chỗ khó nằm ở đây: biểu mẫu chừa
 *      sẵn 24 dòng (13–36), một dòng đệm trống (37), rồi khối chữ ký (38–39).
 *      Nhiều hơn 24 dòng thì phải dời cả khối chữ ký xuống. Cách cũ dùng
 *      insertRows của ExcelJS: dòng chèn thêm ra không viền, và ô gộp của khối
 *      chữ ký không dời theo. Nay tự chụp khối chữ ký, gỡ gộp, viết dữ liệu
 *      đè lên, rồi dựng lại khối chữ ký ở vị trí mới — mọi dòng dữ liệu đều
 *      được ép cùng một kiểu lấy từ dòng mẫu, nên 5 dòng hay 150 dòng nhìn
 *      như nhau.
 */

/** Dòng đầu tiên của vùng dữ liệu, đếm từ 1 như Excel. */
export const DONG_DU_LIEU_DAU = 13;
/** Số dòng dữ liệu biểu mẫu gốc chừa sẵn (13..36). Dòng 37 là dòng đệm trống. */
export const SO_DONG_CHUA_SAN = 24;

/** Một dòng tồn kho như route xuất đã tính xong. */
export type DongKiemKe = {
  group: string;
  name: string;
  impa: string;
  uom: string;
  lastRob: number;
  received: number;
  consumed: number;
  rob: number;
};

const PHONG = "Times New Roman";
// Partial vì kiểu Border của ExcelJS đòi cả `color`, mà tệp gốc không đặt màu
// (đen mặc định) — khai màu vào là bản chép khác bản gốc.
type CanhVien = Partial<ExcelJS.Border>;
const MONG: CanhVien = { style: "thin" };
const DOI: CanhVien = { style: "double" };
const TOC: CanhVien = { style: "hair" };

type Vien = Partial<ExcelJS.Borders>;
function vien(t?: CanhVien, r?: CanhVien, b?: CanhVien, l?: CanhVien): Vien {
  const v: Vien = {};
  if (t) v.top = t;
  if (r) v.right = r;
  if (b) v.bottom = b;
  if (l) v.left = l;
  return v;
}
function phong(size: number, them: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: PHONG, size, ...them };
}

/** Kiểu của một ô dòng dữ liệu, tách riêng để dùng cho cả dòng chèn thêm. */
type KieuO = {
  font: Partial<ExcelJS.Font>;
  alignment: Partial<ExcelJS.Alignment>;
  numFmt?: string;
};

/**
 * Kiểu mặc định của 10 cột dòng dữ liệu — đúng như dòng 14 của tệp gốc. Chỉ là
 * đường lùi: dienDongKiemKe() ưu tiên đọc kiểu thật từ dòng 14 của workbook
 * đang điền, để tệp gốc mà công ty nạp lên có đổi phông thì bản in đổi theo.
 */
const KIEU_DONG_MAC_DINH: KieuO[] = Array.from({ length: 10 }, (_, i) => ({
  font: phong(13),
  alignment:
    i === 2
      ? { horizontal: "center", vertical: "middle", wrapText: true }
      : i === 9
        ? { vertical: "middle" }
        : { vertical: "middle", wrapText: true },
}));

export function dungBieuMauKiemKe(thongTin: {
  companyName: string;
  maBieuMau: string;
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1", {
    // Tệp gốc in DỌC, tỷ lệ 99%, không ép vừa trang; lề đọc nguyên từ tệp.
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      scale: 99,
      fitToPage: false,
      margins: { left: 0.45, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  });

  ws.columns = [
    { width: 6.453125 },
    { width: 6.81640625 },
    { width: 19.54296875 },
    { width: 12.7265625 },
    { width: 12.1796875 },
    { width: 6.7265625 },
    { width: 9.1796875 },
    { width: 8.81640625 },
    { width: 8.54296875 },
    { width: 9.1796875 },
  ];
  const caoDong: Record<number, number> = { 1: 23, 2: 17.5, 5: 17, 6: 10.5, 8: 19.5, 10: 12.75, 11: 33.75, 12: 37.5 };
  for (const [r, h] of Object.entries(caoDong)) ws.getRow(Number(r)).height = h;

  // ── Khối tiêu đề, dòng 1–5 ─────────────────────────────────────────────────
  // Ô A1:C5 là chỗ đặt logo; tên công ty nằm dưới logo vì căn dọc để mặc định
  // (đáy ô).
  //
  // VIỀN của một vùng gộp ghi theo CẠNH NHÌN THẤY của cả vùng, không phải theo ô
  // đầu của tệp gốc. Excel lưu viền cho từng ô con: tệp gốc vẽ cạnh phải của
  // H1:J5 bằng nét đôi ở ô J, đáy của A1:C5 và D3:G5 bằng nét đôi ở dòng 5.
  // ExcelJS thì cho các ô con dùng chung kiểu của ô đầu, nên muốn ra đúng khung
  // ấy phải gom cả bốn cạnh nhìn thấy vào ô đầu. So từng ô đầu với tệp gốc sẽ
  // thấy "lệch" — scripts/thu-xuat-kiem-ke.ts so theo cạnh nhìn thấy.
  const oTieuDe: Array<[string, string, Partial<ExcelJS.Font>, Partial<ExcelJS.Alignment>, Vien]> = [
    ["A1:C5", thongTin.companyName, phong(11, { bold: true, italic: true }), { horizontal: "center", wrapText: true }, vien(DOI, undefined, DOI, DOI)],
    ["D1:G1", "STORES INVENTORY", phong(18, { bold: true }), { horizontal: "left", wrapText: true }, vien(DOI, MONG)],
    ["D2:G2", "         KIỂM KÊ VẬT TƯ", phong(14, { bold: true }), { horizontal: "left" }, vien(undefined, MONG)],
    ["D3:G5", "Phù hợp: Bộ luật ISM 5.2,6.1.3,10.1", phong(13, { italic: true }), { horizontal: "center", wrapText: true }, vien(undefined, MONG, DOI)],
    ["H1:J1", thongTin.maBieuMau, phong(10, { italic: true }), { horizontal: "right", wrapText: true }, vien(DOI, DOI, undefined, MONG)],
    ["H2:J2", "Ngày ban hành: 10/01/2024 ", phong(10, { italic: true }), { horizontal: "right", wrapText: true }, vien(undefined, DOI, undefined, MONG)],
    ["H3:J3", "Soát xét: ", phong(10, { italic: true }), { horizontal: "right", wrapText: true }, vien(undefined, DOI, undefined, MONG)],
    ["H4:J4", "Ngày soát xét:", phong(10, { italic: true }), { horizontal: "right", wrapText: true }, vien(undefined, DOI, undefined, MONG)],
    ["H5:J5", "Trang:  …...of….  ", phong(10, { italic: true }), { horizontal: "right", wrapText: true }, vien(undefined, DOI, undefined, MONG)],
  ];
  for (const [vung, chu, f, a, v] of oTieuDe) {
    ws.mergeCells(vung);
    const o = ws.getCell(vung.split(":")[0]);
    o.value = chu;
    o.font = f;
    o.alignment = a;
    o.border = v;
  }
  // Dòng 6: dòng mỏng 10,5pt có đường kẻ đáy — gạch ngang phân cách khối tiêu đề.
  for (let c = 1; c <= 10; c++) ws.getRow(6).getCell(c).border = vien(undefined, undefined, MONG);

  // ── Khối tàu / bộ phận / kỳ, dòng 7–9 ──────────────────────────────────────
  // C7, H7, C8, H8 do route xuất ghi giá trị; ở đây dựng nhãn, phông và khung.
  const oThongTin: Array<[string, string, Partial<ExcelJS.Font>, Partial<ExcelJS.Alignment>, Vien, string?]> = [
    ["A7:B7", "Vsl./Tàu:", phong(11, { bold: true }), { horizontal: "center", vertical: "middle" }, vien(MONG, MONG, MONG, MONG)],
    ["C7:D7", "", phong(13, { bold: true }), { horizontal: "center", vertical: "middle" }, vien(MONG, undefined, MONG, MONG)],
    ["E7:G7", "Date/Ngày:", phong(11), { horizontal: "right", vertical: "middle" }, vien(MONG, MONG, MONG, MONG)],
    ["H7:J7", "", phong(11, { bold: true }), { horizontal: "right", vertical: "middle" }, vien(MONG, MONG, MONG, MONG), "[$-409]d-mmm-yy;@"],
    ["A8:B9", "Dept./             Bộ phận:", phong(11, { bold: true }), { horizontal: "center", vertical: "middle", wrapText: true }, vien(MONG, MONG, MONG, MONG)],
    ["C8:D9", "Boong/Máy/Điện/Phục vụ", phong(13, { bold: true }), { horizontal: "center", vertical: "middle" }, vien(MONG, MONG, MONG, MONG)],
    ["E8:G8", "From month/", phong(11, { bold: true }), { horizontal: "right", vertical: "middle" }, vien(MONG, MONG, undefined, MONG)],
    ["E9:G9", "Từ tháng:", phong(11, { italic: true }), { horizontal: "right", vertical: "middle" }, vien(undefined, MONG, MONG, MONG)],
    ["H8:J9", "…… đến ……201x", phong(11, { bold: true }), { horizontal: "right", vertical: "middle" }, vien(MONG, MONG, MONG, MONG)],
  ];
  for (const [vung, chu, f, a, v, fmt] of oThongTin) {
    ws.mergeCells(vung);
    const o = ws.getCell(vung.split(":")[0]);
    o.value = chu || null;
    o.font = f;
    o.alignment = a;
    o.border = v;
    if (fmt) o.numFmt = fmt;
  }

  // ── Đầu bảng song ngữ, dòng 11 (Anh, đậm) và 12 (Việt, nghiêng) ───────────
  // Viền: cạnh trên dòng 11 kẻ đôi, cạnh trái cột A và cạnh phải cột J kẻ đôi —
  // đúng khung "hộp" của tệp gốc.
  const dauCotEn = ["S. No.", "Group", "Description", "", "IMPA Code", "Unit", "Last R.O.B", "Receive", "Cons.", "R.O.B"];
  const dauCotVi = ["Stt.", "Nhóm", "Mô tả", "", "Mã IMPA", "Đơn vị", "Còn tồn đợt trước", "Nhận trong kỳ", "Tiêu thụ trong kỳ", "Tồn trên tàu"];
  ws.mergeCells("C11:D11");
  ws.mergeCells("C12:D12");
  for (let c = 1; c <= 10; c++) {
    if (c === 4) continue;
    const o11 = ws.getRow(11).getCell(c);
    const o12 = ws.getRow(12).getCell(c);
    o11.value = dauCotEn[c - 1];
    o12.value = dauCotVi[c - 1];
    o11.font = phong(11, { bold: true });
    o12.font = phong(11, { italic: true });
    const canh: Partial<ExcelJS.Alignment> =
      c === 2 ? { vertical: "middle", wrapText: true } : { horizontal: "center", vertical: "middle", wrapText: true };
    o11.alignment = canh;
    o12.alignment = canh;
    // Cạnh phải từng cột chép đúng tệp gốc: B và I không có (đường kẻ là cạnh
    // trái của cột kế), J kẻ đôi khép khung. Dòng 12 chỉ B và C có đáy — các cột
    // khác dựa vào cạnh trên nét mảnh của dòng 13.
    const phai: Record<number, CanhVien | undefined> = { 1: MONG, 2: undefined, 3: MONG, 5: MONG, 6: MONG, 7: MONG, 8: MONG, 9: undefined, 10: DOI };
    o11.border = vien(DOI, phai[c], undefined, c === 1 ? DOI : MONG);
    o12.border = vien(undefined, phai[c], c === 2 || c === 3 ? MONG : undefined, c === 1 ? DOI : MONG);
  }

  // ── 24 dòng dữ liệu chừa sẵn, dòng đệm, khối chữ ký ────────────────────────
  for (let r = DONG_DU_LIEU_DAU; r < DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN; r++) {
    ws.mergeCells(`C${r}:D${r}`);
    apKieuDongDuLieu(ws, r, KIEU_DONG_MAC_DINH, r === DONG_DU_LIEU_DAU, r === DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN - 1);
  }
  dungKhoiChuKy(ws, DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN + 1, KHOI_CHU_KY_MAC_DINH);

  // ── Logo, neo đúng vị trí của tệp gốc (tính từ EMU của ảnh trong tệp) ─────
  const anh = wb.addImage({ base64: LOGO_MERCURY_LINES_PNG_BASE64, extension: "png" });
  ws.addImage(anh, {
    tl: { col: 1.0, row: 0.856 },
    br: { col: 3.0, row: 3.334 },
    editAs: "oneCell",
  } as unknown as ExcelJS.ImageRange);

  return wb;
}

/** Khối chữ ký: hai hàng, bốn ô, như tệp gốc. */
type KhoiChuKy = Array<{ vung: string; chu: string; font: Partial<ExcelJS.Font> }>[];
const KHOI_CHU_KY_MAC_DINH: KhoiChuKy = [
  [
    { vung: "A:C", chu: "Chief Engineer/ Chief Officer", font: phong(13, { bold: true }) },
    { vung: "D:D", chu: "Officer", font: phong(13, { bold: true }) },
    { vung: "E:G", chu: "Tech.&Pur Dept", font: phong(13, { bold: true }) },
    { vung: "H:J", chu: "Captain", font: phong(13, { bold: true }) },
  ],
  [
    { vung: "A:C", chu: "Máy Trưởng/ Đại Phó", font: phong(13, { italic: true }) },
    { vung: "D:D", chu: "Sỹ quan", font: phong(13, { italic: true }) },
    { vung: "E:G", chu: "Phòng Kỹ Thuật Vật Tư", font: phong(13, { italic: true }) },
    { vung: "H:J", chu: "Thuyền Trưởng", font: phong(13, { italic: true }) },
  ],
];

function dungKhoiChuKy(ws: ExcelJS.Worksheet, dongDau: number, khoi: KhoiChuKy) {
  khoi.forEach((hang, i) => {
    const r = dongDau + i;
    for (const o of hang) {
      const [dau, cuoi] = o.vung.split(":");
      if (dau !== cuoi) ws.mergeCells(`${dau}${r}:${cuoi}${r}`);
      const cell = ws.getCell(`${dau}${r}`);
      cell.value = o.chu;
      cell.font = o.font;
      cell.alignment = { horizontal: "center" };
    }
  });
}

/** Chụp lại khối chữ ký đang có trong workbook (để dời xuống khi bảng dài). */
function chupKhoiChuKy(ws: ExcelJS.Worksheet, dongDau: number): KhoiChuKy {
  const mau: Array<[string, string]> = [["A", "C"], ["D", "D"], ["E", "G"], ["H", "J"]];
  return [0, 1].map((i) =>
    mau.map(([dau, cuoi]) => {
      const cell = ws.getCell(`${dau}${dongDau + i}`);
      const v = cell.value;
      const chu =
        v && typeof v === "object" && "richText" in v
          ? (v as ExcelJS.CellRichTextValue).richText.map((x) => x.text).join("")
          : v == null
            ? ""
            : String(v);
      return { vung: `${dau}:${cuoi}`, chu, font: { ...(cell.font ?? phong(13)) } };
    })
  );
}

function chuOfCell(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((x) => x.text).join("");
  return String(v);
}

/** Ép một dòng dữ liệu về kiểu chuẩn: phông, căn, và viền mảnh/sợi tóc. */
function apKieuDongDuLieu(ws: ExcelJS.Worksheet, r: number, kieu: KieuO[], dongDau: boolean, dongCuoi: boolean) {
  const row = ws.getRow(r);
  for (let c = 1; c <= 10; c++) {
    if (c === 4) continue; // gộp vào C
    const cell = row.getCell(c);
    const k = kieu[c - 1];
    cell.font = { ...k.font };
    cell.alignment = { ...k.alignment };
    if (k.numFmt) cell.numFmt = k.numFmt;
    // Trên/dưới kẻ sợi tóc giữa các dòng; dòng đầu kẻ mảnh phía trên, dòng cuối
    // kẻ mảnh phía dưới để khép bảng — đúng như dòng 13 và 36 của tệp gốc.
    cell.border = vien(dongDau ? MONG : TOC, MONG, dongCuoi ? MONG : TOC, MONG);
  }
}

/** Đọc kiểu 10 cột từ dòng mẫu (dòng 14) của workbook đang điền; thiếu thì dùng mặc định. */
function kieuDongThamChieu(ws: ExcelJS.Worksheet): KieuO[] {
  const row = ws.getRow(DONG_DU_LIEU_DAU + 1);
  const coPhong = Boolean(row.getCell(1).font?.name);
  if (!coPhong) return KIEU_DONG_MAC_DINH;
  return Array.from({ length: 10 }, (_, i) => {
    const cell = row.getCell(i + 1);
    return {
      font: { ...(cell.font ?? KIEU_DONG_MAC_DINH[i].font) },
      alignment: { ...(cell.alignment ?? KIEU_DONG_MAC_DINH[i].alignment) },
      numFmt: cell.numFmt || undefined,
    };
  });
}

/**
 * Điền các dòng tồn kho vào workbook có bố cục MLS-11-06 và trả về hai dòng của
 * khối chữ ký sau khi điền (khối có thể đã bị dời xuống).
 */
export function dienDongKiemKe(
  ws: ExcelJS.Worksheet,
  rows: DongKiemKe[]
): { dongChuKyDau: number; dongChuKyCuoi: number } {
  const n = rows.length;
  const kieu = kieuDongThamChieu(ws);
  let dongKy = DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN + 1; // 38

  if (n > SO_DONG_CHUA_SAN) {
    // Dời khối chữ ký: chụp lại, gỡ gộp, xóa sạch ba dòng cũ (đệm + 2 chữ ký),
    // rồi dựng lại dưới dòng dữ liệu cuối. Không dùng insertRows — xem đầu file.
    const khoi = chupKhoiChuKy(ws, dongKy);
    for (const r of [dongKy, dongKy + 1]) {
      for (const [dau, cuoi] of [["A", "C"], ["E", "G"], ["H", "J"]]) {
        const vung = `${dau}${r}:${cuoi}${r}`;
        try { ws.unMergeCells(vung); } catch { /* chưa gộp thì thôi */ }
      }
    }
    for (const r of [dongKy - 1, dongKy, dongKy + 1]) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.value = null;
        cell.style = {};
      }
    }
    dongKy = DONG_DU_LIEU_DAU + n + 1;
    dungKhoiChuKy(ws, dongKy, khoi);
  }

  rows.forEach((row, i) => {
    const r = DONG_DU_LIEU_DAU + i;
    // Dòng ngoài 24 chỗ chừa sẵn chưa có ô gộp C:D.
    if (i >= SO_DONG_CHUA_SAN) ws.mergeCells(`C${r}:D${r}`);
    const cuoiBang = n >= SO_DONG_CHUA_SAN ? i === n - 1 : i === SO_DONG_CHUA_SAN - 1;
    apKieuDongDuLieu(ws, r, kieu, i === 0, cuoiBang);
    const o = ws.getRow(r);
    o.getCell(1).value = i + 1;
    o.getCell(2).value = row.group;
    o.getCell(3).value = row.name;
    o.getCell(5).value = row.impa;
    o.getCell(6).value = row.uom;
    o.getCell(7).value = row.lastRob;
    o.getCell(8).value = row.received;
    o.getCell(9).value = row.consumed;
    o.getCell(10).value = row.rob;
  });
  // Bảng ngắn hơn 24 dòng: các chỗ trống còn lại giữ nguyên khung của biểu mẫu.

  return { dongChuKyDau: dongKy, dongChuKyCuoi: dongKy + 1 };
}

/**
 * Dòng ghi chú cho bản TỰ DỰNG, đặt dưới khối chữ ký và NẰM NGOÀI vùng in.
 *
 * Tệp được gửi qua email cho người khác, nên phải có chỗ nói rõ đây không phải
 * bản in từ tệp biểu mẫu được kiểm soát. Nhưng đặt lên giấy thì tờ kiểm kê có
 * thêm một dòng lạ so với bản gốc — vậy thu vùng in về đúng hết khối chữ ký: mở
 * trong Excel vẫn thấy ghi chú, in ra thì không.
 */
export function ghiChuBanTuDung(ws: ExcelJS.Worksheet, dongChuKyCuoi: number) {
  const r = dongChuKyCuoi + 2;
  ws.mergeCells(`A${r}:J${r}`);
  const o = ws.getCell(`A${r}`);
  o.value =
    "Bản dựng tự động theo đúng bố cục MLS-11-06 vì hệ thống chưa nạp tệp biểu mẫu gốc. " +
    "Quản trị vào Mua sắm → Biểu mẫu tải tệp Excel gốc lên để các lần xuất sau lấy từ chính tệp của công ty. (Dòng này không in.)";
  o.font = phong(8, { italic: true, color: { argb: "FF808080" } });
  o.alignment = { horizontal: "left", wrapText: true };
  ws.getRow(r).height = 24;
  ws.pageSetup.printArea = `A1:J${dongChuKyCuoi}`;
}

export const _chiDeKiemThu = { chuOfCell };
