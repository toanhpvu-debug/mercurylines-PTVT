import ExcelJS from "exceljs";

// Cố ý KHÔNG có "server-only" như phần lớn file trong lib/: file này chỉ xếp chữ
// vào một workbook, không chạm session, database hay biến môi trường. Đánh dấu
// server-only thì script kiểm thử (scripts/thu-xuat-kiem-ke.ts) chạy ngoài Next
// sẽ ném lỗi ngay lúc import — mà dựng thử được bản in ở ngoài Next chính là
// cách duy nhất soát bố cục mà không phải đăng nhập và bấm nút.

/**
 * Dựng bảng kiểm kê MLS-11-06 từ con số không, khi trên hệ thống chưa nạp tệp
 * biểu mẫu gốc của công ty.
 *
 * Vì sao cần: tệp biểu mẫu là tài liệu nội bộ nên không nằm trong mã nguồn, mà
 * bản chạy trên máy chủ thì dựng từ mã nguồn — nghĩa là một bản cài mới LUÔN
 * thiếu tệp cho tới khi có người nhớ ra và tải lên. Trước đây nút "Xuất kiểm kê"
 * ở đúng tình huống đó trả về một trang trắng in mỗi dòng chữ lỗi. Một nút không
 * bao giờ được chết chỉ vì một tệp cấu hình chưa ai nạp.
 *
 * Bản dựng ở đây chép lại BỐ CỤC của form gốc: cùng khối tiêu đề, cùng hai hàng
 * đầu cột song ngữ ở dòng 11-12, dữ liệu từ dòng 13, khối chữ ký bốn ô ở cuối.
 * Nó KHÔNG có logo và khung viền đúng như bản in chính thức, nên vẫn ưu tiên tệp
 * gốc khi có: xem MA_BIEU_MAU_KIEM_KE và trang Mua sắm → Biểu mẫu.
 *
 * Tên công ty và địa chỉ lấy từ chuẩn biểu mẫu của tàu (bảng FormStandard) chứ
 * không viết cứng — mỗi công ty dùng app này có khối tiêu đề của riêng mình.
 */

/** Số dòng dữ liệu mà form gốc chừa sẵn, giữ y hệt để khối chữ ký rơi đúng chỗ. */
export const SO_DONG_CHUA_SAN = 25;
/** Dòng đầu tiên của vùng dữ liệu, tính từ 1 như Excel. */
export const DONG_DU_LIEU_DAU = 13;

const VIEN_MONG: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

export function dungBieuMauKiemKe(thongTin: {
  companyName: string;
  address: string;
  maBieuMau: string;
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // Bề rộng cột theo đúng thứ tự form gốc: Stt · Nhóm · Mô tả (gộp C:D) · IMPA ·
  // Đơn vị · 4 cột số.
  ws.columns = [
    { width: 5 }, // A  Stt
    { width: 16 }, // B  Nhóm
    { width: 30 }, // C  Mô tả
    { width: 14 }, // D  (gộp với C)
    { width: 12 }, // E  IMPA
    { width: 8 }, // F  Đơn vị
    { width: 12 }, // G  Còn tồn đợt trước
    { width: 12 }, // H  Nhận trong kỳ
    { width: 12 }, // I  Tiêu thụ trong kỳ
    { width: 12 }, // J  Tồn trên tàu
  ];

  // ── Khối tiêu đề (dòng 1..5) ───────────────────────────────────────────────
  ws.mergeCells("A1:C5");
  const oCongTy = ws.getCell("A1");
  oCongTy.value = `${thongTin.companyName}\n${thongTin.address}`;
  oCongTy.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  oCongTy.font = { bold: true, size: 11 };
  oCongTy.border = VIEN_MONG;

  ws.mergeCells("D1:G1");
  ws.getCell("D1").value = "STORES INVENTORY";
  ws.mergeCells("D2:G2");
  ws.getCell("D2").value = "KIỂM KÊ VẬT TƯ";
  ws.mergeCells("D3:G5");
  ws.getCell("D3").value = "Phù hợp: Bộ luật ISM 5.2, 6";
  for (const o of ["D1", "D2", "D3"]) {
    const c = ws.getCell(o);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.font = { bold: o !== "D3", size: o === "D1" ? 13 : 11 };
    c.border = VIEN_MONG;
  }

  const oPhai: [string, string][] = [
    ["H1", thongTin.maBieuMau],
    ["H2", "Ngày ban hành:"],
    ["H3", "Soát xét:"],
    ["H4", "Ngày soát xét:"],
    ["H5", "Trang:  …... of …..."],
  ];
  for (const [o, chu] of oPhai) {
    const dong = o.slice(1);
    ws.mergeCells(`H${dong}:J${dong}`);
    const c = ws.getCell(o);
    c.value = chu;
    c.alignment = { vertical: "middle", horizontal: "left" };
    c.font = { bold: o === "H1", size: 10 };
    c.border = VIEN_MONG;
  }

  // ── Khối thông tin tàu / kỳ (dòng 7..9) ────────────────────────────────────
  // Các ô C7, H7, C8, H8 do route xuất ghi đè bằng dữ liệu thật — ở đây chỉ dựng
  // nhãn và vùng gộp cho đúng chỗ.
  ws.mergeCells("A7:B7");
  ws.getCell("A7").value = "Vsl./Tàu:";
  ws.mergeCells("C7:D7");
  ws.mergeCells("E7:G7");
  ws.getCell("E7").value = "Date/Ngày:";
  ws.mergeCells("H7:J7");

  ws.mergeCells("A8:B9");
  ws.getCell("A8").value = "Dept./\nBộ phận";
  ws.getCell("A8").alignment = { wrapText: true, vertical: "middle" };
  ws.mergeCells("C8:D9");
  ws.mergeCells("E8:G8");
  ws.getCell("E8").value = "From month/";
  ws.mergeCells("E9:G9");
  ws.getCell("E9").value = "Từ tháng:";
  ws.mergeCells("H8:J9");
  for (const o of ["A7", "C7", "E7", "H7", "A8", "C8", "E8", "E9", "H8"]) {
    ws.getCell(o).font = { size: 10 };
  }

  // ── Hai hàng đầu cột song ngữ (dòng 11 tiếng Anh, dòng 12 tiếng Việt) ───────
  const dauCotEn = [
    "S. No.",
    "Group",
    "Description",
    "",
    "IMPA Code",
    "Unit",
    "Last R.O.B",
    "Receive",
    "Cons.",
    "R.O.B",
  ];
  const dauCotVi = [
    "Stt.",
    "Nhóm",
    "Mô tả",
    "",
    "Mã IMPA",
    "Đơn vị",
    "Còn tồn đợt trước",
    "Nhận trong kỳ",
    "Tiêu thụ trong kỳ",
    "Tồn trên tàu",
  ];
  ws.mergeCells("C11:D11");
  ws.mergeCells("C12:D12");
  dauCotEn.forEach((chu, i) => {
    if (i === 3) return; // cột D gộp vào C
    const c = ws.getRow(11).getCell(i + 1);
    c.value = chu;
    c.font = { bold: true, size: 10 };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = VIEN_MONG;
  });
  dauCotVi.forEach((chu, i) => {
    if (i === 3) return;
    const c = ws.getRow(12).getCell(i + 1);
    c.value = chu;
    c.font = { bold: true, size: 10 };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = VIEN_MONG;
  });
  ws.getRow(11).height = 18;
  ws.getRow(12).height = 30;

  // ── Vùng dữ liệu để TRỐNG nhưng kẻ sẵn khung ───────────────────────────────
  // Route xuất ghi dữ liệu vào đây, và chèn thêm dòng nếu vượt SO_DONG_CHUA_SAN
  // — đúng cách nó làm với form gốc, nên hai đường đi không cần biết nhau.
  for (let r = DONG_DU_LIEU_DAU; r < DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN; r++) {
    ws.mergeCells(`C${r}:D${r}`);
    for (let c = 1; c <= 10; c++) {
      const o = ws.getRow(r).getCell(c);
      o.border = VIEN_MONG;
      o.font = { size: 10 };
      o.alignment = {
        vertical: "middle",
        horizontal: c === 3 ? "left" : "center",
        wrapText: c === 3,
      };
    }
  }

  // ── Khối chữ ký, đúng bốn ô như form gốc ───────────────────────────────────
  const dongKy = DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN; // 38
  const kyEn = ["Chief Engineer/ Chief Officer", "Officer", "Tech.&Pur Dept", "Captain"];
  const kyVi = ["Máy Trưởng/ Đại Phó", "Sỹ quan", "Phòng Kỹ Thuật Vật Tư", "Thuyền Trưởng"];
  const vung: [string, string][] = [
    [`A${dongKy}`, `C${dongKy}`],
    [`D${dongKy}`, `D${dongKy}`],
    [`E${dongKy}`, `G${dongKy}`],
    [`H${dongKy}`, `J${dongKy}`],
  ];
  vung.forEach(([dau, cuoi], i) => {
    if (dau !== cuoi) ws.mergeCells(`${dau}:${cuoi}`);
    const c = ws.getCell(dau);
    c.value = kyEn[i];
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center" };
  });
  const dongKyVi = dongKy + 1;
  const vungVi: [string, string][] = [
    [`A${dongKyVi}`, `C${dongKyVi}`],
    [`D${dongKyVi}`, `D${dongKyVi}`],
    [`E${dongKyVi}`, `G${dongKyVi}`],
    [`H${dongKyVi}`, `J${dongKyVi}`],
  ];
  vungVi.forEach(([dau, cuoi], i) => {
    if (dau !== cuoi) ws.mergeCells(`${dau}:${cuoi}`);
    const c = ws.getCell(dau);
    c.value = kyVi[i];
    c.font = { size: 10 };
    c.alignment = { horizontal: "center" };
  });
  // Chừa chỗ ký tay bên dưới hai hàng nhãn.
  ws.getRow(dongKy).height = 16;
  ws.getRow(dongKyVi).height = 46;

  // Một dòng nói rõ đây không phải bản in từ biểu mẫu gốc.
  //
  // Tệp này được gửi qua email và đưa cho người kiểm tra ISM xem, mà bản tự dựng
  // thì thiếu logo và khung viền của tài liệu được kiểm soát. Không ghi gì thì
  // người nhận không có cách nào biết, và một bản tạm có thể bị nộp như bản chính
  // thức. Đặt dưới khối chữ ký nên không chen vào vùng biểu mẫu, mà vẫn đi theo
  // tệp tới bất cứ đâu — khác với một dòng cảnh báo trên màn hình, thứ ở lại trên
  // màn hình.
  const dongGhiChu = dongKyVi + 2;
  ws.mergeCells(`A${dongGhiChu}:J${dongGhiChu}`);
  const oGhiChu = ws.getCell(`A${dongGhiChu}`);
  oGhiChu.value =
    "Bản dựng tự động — hệ thống chưa nạp tệp biểu mẫu gốc nên bản in này không có logo và khung của biểu mẫu được kiểm soát. " +
    "Quản trị vào Mua sắm → Biểu mẫu tải tệp Excel gốc lên để các lần xuất sau ra đúng biểu mẫu công ty.";
  oGhiChu.font = { size: 8, italic: true, color: { argb: "FF808080" } };
  oGhiChu.alignment = { horizontal: "left", wrapText: true };

  return wb;
}
