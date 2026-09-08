import "server-only";

import ExcelJS from "exceljs";

/**
 * Dựng file Excel MẪU để thu thập danh mục vật tư ngoài tàu, rồi nhập ngược
 * vào hệ thống qua trang /materials/import.
 *
 * Điểm mấu chốt: mẫu này phải khớp ĐÚNG với bộ đọc ở lib/materialImport.ts —
 * tên sheet quyết định loại hàng và kho ghi tồn, tiêu đề cột quyết định cột nào
 * là gì. Phát cho tàu một file mẫu mà nhập lại không được thì tệ hơn là không
 * phát: người ta đã gõ xong vài trăm dòng rồi mới biết.
 *
 * Vì vậy có bài kiểm tra kiem-tra-mau-danh-muc.cmd: dựng mẫu này rồi ĐƯA THẲNG
 * qua bộ đọc, đối chiếu từng sheet. Sửa tên cột ở đây mà quên sửa bộ đọc là bài
 * kiểm tra trượt ngay.
 */

/** Cột của bảng danh mục — thứ tự này cũng là thứ tự trong file mẫu. */
const COT = [
  { tieuDe: "STT", rong: 6 },
  { tieuDe: "Nhóm (Group)", rong: 26 },
  { tieuDe: "Mô tả / Description", rong: 46 },
  { tieuDe: "Mã IMPA", rong: 14 },
  { tieuDe: "Part No.", rong: 18 },
  { tieuDe: "Đơn vị (Unit)", rong: 12 },
  { tieuDe: "Tồn trên tàu (R.O.B)", rong: 18 },
  { tieuDe: "SL tối thiểu (Min)", rong: 16 },
] as const;

/**
 * Các sheet trong file mẫu.
 *
 * Tên sheet KHÔNG được đổi tùy tiện: bộ đọc suy loại hàng và kho ghi tồn từ
 * chính chuỗi này ("phụ tùng"/"spare" → phụ tùng vào kho máy; "boong"/"deck" →
 * kho boong; còn lại → kho vật tư tiêu hao).
 */
const SHEET = [
  {
    ten: "Phụ tùng (Spare Parts)",
    ghiChu:
      "Phụ tùng thay thế theo máy. Cột Nhóm ghi TÊN THIẾT BỊ: Main Engine, Aux. Engine, Air Compressor, Oil Separator…",
  },
  {
    ten: "Vật tư (Stores)",
    ghiChu: "Vật tư tiêu hao buồng máy: giẻ lau, băng keo, gioăng, dụng cụ…",
  },
  {
    ten: "Vật tư Boong (Deck Stores)",
    ghiChu: "Vật tư boong: dây, sơn, dụng cụ boong, vật tư chằng buộc…",
  },
  {
    ten: "Vật tư Phục vụ (Catering)",
    ghiChu: "Đồ bếp, dụng cụ ăn uống, đồ vải, vật tư vệ sinh…",
  },
  {
    ten: "Vật tư Bảo hộ (Safety)",
    ghiChu: "Bảo hộ lao động, trang bị cứu sinh, cứu hỏa…",
  },
] as const;

/**
 * Hướng dẫn — đặt ở sheet đầu tiên.
 *
 * CỐ Ý viết mỗi dòng vào MỘT ô duy nhất, và cố ý tránh dùng chữ "Mô tả" hay
 * "Description" trong phần này. Bộ đọc dò bảng bằng cách tìm dòng có cột mô tả
 * cộng thêm một cột đặc trưng khác; một dòng hướng dẫn lỡ chứa cả hai từ khóa
 * sẽ bị nhận nhầm là dòng tiêu đề, và mấy dòng hướng dẫn bên dưới biến thành
 * vật tư trong danh mục. Nên ở đây gọi cột theo CHỮ CÁI.
 */
const HUONG_DAN: string[] = [
  "FILE MẪU THU THẬP DANH MỤC VẬT TƯ & PHỤ TÙNG — Mercury Lines",
  "",
  "CÁCH DÙNG",
  "1. Gửi file này cho tàu. Mỗi sheet là một nhóm hàng — điền vào đúng sheet của nhóm đó.",
  "2. Điền từ dòng ngay dưới dòng tiêu đề. Không xóa, không đổi tên dòng tiêu đề và tên sheet.",
  "3. Gửi file về, vào trang Vật tư → Nhập danh mục từ file → chọn tàu → tải file lên.",
  "",
  "Ý NGHĨA TỪNG CỘT (theo chữ cái trên đầu sheet)",
  "Cột A — STT: số thứ tự, chỉ để dễ đọc. Hệ thống không dùng tới.",
  "Cột B — Nhóm: với phụ tùng thì ghi TÊN THIẾT BỊ (Main Engine, Aux. Engine…);",
  "        với vật tư thì ghi nhóm hàng (Vật tư boong, Phục vụ…). Nhóm chưa có sẽ được tạo mới.",
  "Cột C — tên hàng: BẮT BUỘC. Dòng nào bỏ trống cột này sẽ bị bỏ qua.",
  "Cột D — mã IMPA: 6 chữ số, viết liền (190115) hoặc có dấu chấm (19.01.15).",
  "        KHÔNG ghi mã của hãng vào đây — mã hãng thuộc cột E.",
  "Cột E — Part No.: mã phụ tùng của hãng (E14200, 1016815253, VLH-53.06.01…).",
  "Cột F — đơn vị tính: PCS, SET, KG, L, ROLL, PAIR…",
  "Cột G — số lượng hiện có trên tàu. Để trống nếu chưa kiểm đếm.",
  "Cột H — số lượng tối thiểu phải luôn có trên tàu. Dùng để cảnh báo sắp hết.",
  "",
  "NHỮNG ĐIỀU HỆ THỐNG TỰ LÀM, ĐỪNG LÀM TAY",
  "· Sinh mã vật tư theo bộ phận và loại hàng: [bộ phận]-IMPA-#### cho vật tư,",
  "  [bộ phận]-SPR-#### cho phụ tùng — D Boong · E Máy · L Điện · C Phục vụ.",
  "  Ví dụ: D-IMPA-0075 (cờ lê boong) · E-SPR-0034 (vòi phun máy chính).",
  "  Bốn số cuối là số thứ tự trong khuôn đó, KHÔNG phải mã IMPA — mã IMPA",
  "  thật ghi ở cột D.",
  "· Gộp hàng trùng: trùng mã IMPA, trùng Part No., hoặc trùng tên + thiết bị thì",
  "  hàng được gán vào tàu chứ không tạo thêm dòng mới trong danh mục chung.",
  "· Xếp bộ phận (Boong · Máy · Điện · Phục vụ) theo nhóm ở cột B.",
  "",
  "LƯU Ý KHI ĐIỀN",
  "· Mỗi mặt hàng một dòng. Đừng gộp nhiều thứ vào một dòng bằng dấu phẩy.",
  "· Số lượng chỉ ghi SỐ, đơn vị để riêng ở cột F. Ghi '2 set' vào cột G là sai.",
  "· Cần thêm sheet cho nhóm khác thì đặt tên có chữ 'Vật tư' hoặc 'Phụ tùng' ở đầu,",
  "  nếu không hệ thống sẽ không biết sheet đó là vật tư hay phụ tùng.",
  "· Sheet này (Hướng dẫn) được bỏ qua khi nhập — cứ để nguyên trong file.",
];

export const TEN_FILE_MAU = "Mercury-Lines_Mau-danh-muc-vat-tu.xlsx";

export async function taoFileMauDanhMuc(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mercury Lines — Fleet Inventory System";
  wb.created = new Date();

  // ─── Sheet hướng dẫn ───
  const hd = wb.addWorksheet("Hướng dẫn");
  hd.getColumn(1).width = 110;
  HUONG_DAN.forEach((dong, i) => {
    const r = hd.getRow(i + 1);
    r.getCell(1).value = dong;
    r.getCell(1).alignment = { vertical: "top", wrapText: true };
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: "FF0A1F44" } };
      r.height = 22;
    } else if (/^[A-ZĐ\s&—]+$/.test(dong) && dong.trim().length > 3) {
      r.getCell(1).font = { bold: true, color: { argb: "FF0A1F44" } };
    }
  });

  // ─── Các sheet dữ liệu ───
  for (const s of SHEET) {
    const ws = wb.addWorksheet(s.ten);
    // Dòng 1: ghi chú của sheet — một ô duy nhất, không phải dòng tiêu đề bảng.
    const note = ws.getRow(1);
    note.getCell(1).value = s.ghiChu;
    note.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
    ws.mergeCells(1, 1, 1, COT.length);

    // Dòng 2: tiêu đề bảng — đây là dòng bộ đọc dò tìm.
    const head = ws.getRow(2);
    COT.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.tieuDe;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0A1F44" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      ws.getColumn(i + 1).width = c.rong;
    });
    head.height = 30;

    // Khung sẵn 200 dòng trống có viền, để người điền thấy rõ vùng phải điền.
    for (let r = 3; r <= 202; r++) {
      const row = ws.getRow(r);
      row.getCell(1).value = r - 2; // STT điền sẵn
      for (let c = 1; c <= COT.length; c++) {
        row.getCell(c).border = {
          top: { style: "hair", color: { argb: "FFCBD5E1" } },
          left: { style: "hair", color: { argb: "FFCBD5E1" } },
          bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
          right: { style: "hair", color: { argb: "FFCBD5E1" } },
        };
      }
    }
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
