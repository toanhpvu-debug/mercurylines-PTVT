import { tuDien } from "./_kieu";

/** Tồn kho (/inventory), báo cáo vật tư (/reports), báo cáo từ tàu (/documents). */
export const inventory = tuDien(
  {
    // --- Trang Tồn kho ---
    tieuDeDoi: "Tồn kho đội tàu",
    tieuDeTau: "Tồn kho tàu của bạn",
    moTa: "Tổng quan → lọc → chi tiết từng tàu · nhập/xuất và nhật ký ở cuối trang",
    chiSoDong: "Dòng",
    chiSoDuoiToiThieu: "Dưới tối thiểu",
    chuaGanTauTonKho:
      "Bạn chưa được gán tàu phụ trách nên chưa xem được tồn kho. Vui lòng liên hệ quản trị viên.",
    tatCaKho: "Tất cả kho",
    loai: "Loại",
    loaiCaHai: "Vật tư & phụ tùng",
    timPlaceholder: "Tìm tên / mã / IMPA...",
    chiThieu: "Chỉ thiếu",
    khongCoDongKhop: "Không có dòng tồn kho nào khớp bộ lọc.",
    nDong: "{n} dòng",
    nThieu: "{n} thiếu",
    du: "đủ",
    cotTenVatTu: "Tên mặt hàng",
    cotTon: "Tồn",
    cotKhaDung: "Khả dụng",
    cotToiThieu: "Tối thiểu",
    dangHienNDongDau: "Đang hiện {n} dòng đầu — còn",
    conLaiDongNua: "dòng nữa.",
    thietBiKhac: "Thiết bị khác",
    phuTungThietBi: "Phụ tùng — {ten}",
    badgePhuTung: "PT",
    badgeThieu: "THIẾU",
    dangGiu: "(giữ {n})",
    nutNhapXuat: "Nhập / xuất kho",
    lichSuGanDay: "Lịch sử nhập xuất gần đây",
    nGiaoDichMoiNhat:
      "{n} giao dịch mới nhất — có thời điểm & người thực hiện",
    chuaCoGiaoDich: "Chưa có giao dịch nào.",
    cotThoiDiem: "Thời điểm thực hiện",
    cotSoLuongNgan: "SL",
    cotGhiSoLuc: "Ghi sổ lúc",
    daNgungDung: "đã ngừng dùng",
    ghiChuGhiSoLuc:
      'Cột "Ghi sổ lúc" chỉ hiện khi giao dịch được nhập bù (thời điểm thực hiện khác thời điểm ghi vào hệ thống).',
    cotNhapGanNhat: "Nhập gần nhất",
    cotXuatGanNhat: "Xuất gần nhất",
    chuaNhapXuat: "chưa có",
    moTheKho: "Mở thẻ kho — toàn bộ lịch sử nhập / xuất của mặt hàng này",

    // --- Thẻ kho (/inventory/stock-card) ---
    theKho: "Thẻ kho",
    theKhoMoTa:
      "Toàn bộ nhập / xuất của một mặt hàng tại một kho — ngày, số lượng, tồn sau mỗi lần, ghi chú, người thực hiện",
    inTheKho: "In thẻ kho",
    quayLaiTonKho: "Quay lại tồn kho",
    cotNhap: "Nhập",
    cotXuat: "Xuất",
    cotTonSau: "Tồn sau",
    tonDauKhongGiaoDich: "Tồn đầu — đưa vào không qua giao dịch (nhập từ file, đồng bộ)",
    nGiaoDich: "{n} giao dịch",
    chuaCoGiaoDichMatHang:
      "Mặt hàng này chưa có lần nhập / xuất nào tại kho này.",
    ghiChoMatHangNay: "Ghi nhập / xuất cho mặt hàng này",
    ghiChoMatHangNayMoTa:
      "Mặt hàng và kho đã chọn sẵn — chỉ cần loại, số lượng, ngày thực hiện và ghi chú.",
    tongNhap: "Tổng nhập",
    tongXuat: "Tổng xuất",
    inLuc: "In lúc",

    // --- Form nhập / xuất kho ---
    chonVatTu: "Chọn mặt hàng",
    chonKho: "Chọn kho",
    optNhapKho: "Nhập kho",
    optXuatKho: "Xuất kho",
    goiYThoiDiem:
      "Thời điểm thực hiện (để trống = bây giờ; cho phép ghi lùi khi nhập bù)",
    ghiChuGoiY: "Số phiếu, lý do, người nhận, thiết bị dùng…",
    nutThucHien: "Thực hiện nhập / xuất",

    // --- Trang Báo cáo nhận và sử dụng vật tư (MLS-11-01) ---
    baoCaoTieuDe: "Báo cáo nhận và sử dụng vật tư",
    baoCaoMoTa: "Tự động tổng hợp từ giao dịch nhập/xuất kho — mẫu MLS-11-01",
    boPhan: "Bộ phận",
    thang: "Tháng",
    xemBaoCao: "Xem báo cáo",
    inBaoCao: "In báo cáo",
    inBaoCaoMLS1101: "In báo cáo MLS-11-01",
    khongCoDuLieuKy: "Không có dữ liệu vật tư trong kỳ này.",
    bpMay: "MÁY",
    bpBoong: "BOONG",
    bpKhoTieuHao: "KHO TIÊU HAO",
    bpTatCa: "TẤT CẢ",

    // --- Trang Báo cáo từ tàu (hồ sơ tải lên) ---
    taiLieuTieuDe: "Báo cáo từ tàu",
    taiLieuMoTa:
      "Tải lên file báo cáo vật tư (PDF / Excel) — bản lưu bất biến, có mã toàn vẹn SHA-256",
    taiLieuChuaGanTau:
      "Bạn chưa được gán tàu phụ trách nên chưa thể tải báo cáo lên. Vui lòng liên hệ quản trị viên.",
    taiBaoCaoLen: "Tải báo cáo lên",
    hoSoDaLuu: "Hồ sơ đã lưu ({n})",
    chuaCoBaoCao: "Chưa có báo cáo nào được tải lên.",
    cotNgayTai: "Ngày tải",
    cotKy: "Kỳ",
    cotTieuDeFile: "Tiêu đề / File",
    cotCo: "Cỡ",
    cotNguoiTai: "Người tải",
    xemTai: "Xem / Tải",
    luuYBatBien:
      "File đã tải lên không thể chỉnh sửa hay thay thế — mọi bản nộp đều được lưu vĩnh viễn kèm mã SHA-256 để đối chiếu toàn vẹn. Chỉ quản trị viên công ty có quyền xóa.",

    // --- Form tải hồ sơ lên ---
    fileQuaNang: 'File "{ten}" nặng {mb}MB, vượt quá giới hạn 20MB.',
    loaiBaoCao: "Loại báo cáo",
    docMLS1101: "MLS-11-01 — Nhận & sử dụng vật tư",
    docMLS1104: "MLS-11-04 — Nhận & sử dụng vật tư (Boong)",
    docMLS1113: "MLS-11-13 — Dụng cụ chằng buộc container",
    docKhac: "Khác",
    kyBaoCao: "Kỳ báo cáo",
    tieuDePlaceholder: "Tiêu đề (bỏ trống sẽ dùng tên file)",
    fileBaoCao: "File báo cáo (PDF hoặc Excel, tối đa 20MB)",
    ghiChuTuyChon: "Ghi chú (tùy chọn)",
    dangTaiLen: "Đang tải lên...",
    luuYTruoc: "Lưu ý: file sau khi tải lên là",
    luuYDam: "bản lưu bất biến",
    luuYSau:
      "— không thể sửa hay thay thế. Nếu nhầm, hãy tải lên bản đúng (bản mới nằm trên cùng); chỉ quản trị viên công ty có quyền xóa.",
    xacNhanXoaHoSo:
      'Xóa vĩnh viễn hồ sơ "{ten}"? Hành động này không hoàn tác được.',

    // --- Dải chọn tàu (dùng chung nhiều trang) ---
    chuyenTau: "Chuyển tàu:",
  },
  {
    tieuDeDoi: "Fleet inventory",
    tieuDeTau: "Your vessel inventory",
    moTa: "Overview → filter → detail by vessel · receipts/issues and log at the bottom",
    chiSoDong: "Rows",
    chiSoDuoiToiThieu: "Below minimum",
    chuaGanTauTonKho:
      "You have not been assigned to a vessel, so inventory is not available. Please contact the administrator.",
    tatCaKho: "All warehouses",
    loai: "Type",
    loaiCaHai: "Stores & spare parts",
    timPlaceholder: "Search name / code / IMPA...",
    chiThieu: "Short only",
    khongCoDongKhop: "No inventory row matches the filter.",
    nDong: "{n} rows",
    nThieu: "{n} short",
    du: "sufficient",
    cotTenVatTu: "Item name",
    cotTon: "ROB",
    cotKhaDung: "Available",
    cotToiThieu: "Minimum stock",
    dangHienNDongDau: "Showing the first {n} rows —",
    conLaiDongNua: "more rows.",
    thietBiKhac: "Other equipment",
    phuTungThietBi: "Spare parts — {ten}",
    badgePhuTung: "SP",
    badgeThieu: "SHORT",
    dangGiu: "(reserved {n})",
    nutNhapXuat: "Receipt / issue",
    lichSuGanDay: "Recent receipts and issues",
    nGiaoDichMoiNhat:
      "{n} latest transactions — with time and person performing them",
    chuaCoGiaoDich: "No transactions yet.",
    cotThoiDiem: "Performed at",
    cotSoLuongNgan: "Qty",
    cotGhiSoLuc: "Recorded at",
    daNgungDung: "discontinued",
    ghiChuGhiSoLuc:
      'The "Recorded at" column only shows for back-dated entries (performed at a different time from when they were recorded).',
    cotNhapGanNhat: "Last receipt",
    cotXuatGanNhat: "Last issue",
    chuaNhapXuat: "none yet",
    moTheKho: "Open the stock card — full receipt / issue history of this item",

    theKho: "Stock card",
    theKhoMoTa:
      "Every receipt / issue of one item at one warehouse — date, quantity, balance after each movement, notes, person",
    inTheKho: "Print stock card",
    quayLaiTonKho: "Back to inventory",
    cotNhap: "In",
    cotXuat: "Out",
    cotTonSau: "Balance",
    tonDauKhongGiaoDich: "Opening balance — entered without a transaction (file import, sync)",
    nGiaoDich: "{n} transactions",
    chuaCoGiaoDichMatHang:
      "This item has no receipt / issue at this warehouse yet.",
    ghiChoMatHangNay: "Post a receipt / issue for this item",
    ghiChoMatHangNayMoTa:
      "Item and warehouse are preselected — only type, quantity, date and notes are needed.",
    tongNhap: "Total in",
    tongXuat: "Total out",
    inLuc: "Printed at",

    chonVatTu: "Select item",
    chonKho: "Select warehouse",
    optNhapKho: "Receipt into store",
    optXuatKho: "Issue from store",
    goiYThoiDiem:
      "Performed at (leave empty for now; back-dating is allowed for late entries)",
    ghiChuGoiY: "Voucher no., reason, recipient, equipment used…",
    nutThucHien: "Post receipt / issue",

    baoCaoTieuDe: "Materials receiving and using report",
    baoCaoMoTa:
      "Compiled automatically from warehouse receipts and issues — form MLS-11-01",
    boPhan: "Department",
    thang: "Month",
    xemBaoCao: "View report",
    inBaoCao: "Print report",
    inBaoCaoMLS1101: "Print MLS-11-01 report",
    khongCoDuLieuKy: "No material data for this period.",
    bpMay: "ENGINE",
    bpBoong: "DECK",
    bpKhoTieuHao: "CONSUMABLE STORE",
    bpTatCa: "ALL",

    taiLieuTieuDe: "Reports from vessels",
    taiLieuMoTa:
      "Upload material report files (PDF / Excel) — immutable records with a SHA-256 integrity hash",
    taiLieuChuaGanTau:
      "You have not been assigned to a vessel, so you cannot upload reports. Please contact the administrator.",
    taiBaoCaoLen: "Upload report",
    hoSoDaLuu: "Saved documents ({n})",
    chuaCoBaoCao: "No report has been uploaded yet.",
    cotNgayTai: "Uploaded on",
    cotKy: "Period",
    cotTieuDeFile: "Title / File",
    cotCo: "Size",
    cotNguoiTai: "Uploaded by",
    xemTai: "View / Download",
    luuYBatBien:
      "An uploaded file cannot be edited or replaced — every submission is kept permanently together with its SHA-256 hash for integrity checking. Only company administrators may delete.",

    fileQuaNang: 'File "{ten}" is {mb}MB, over the 20MB limit.',
    loaiBaoCao: "Report type",
    docMLS1101: "MLS-11-01 — Materials receiving & using",
    docMLS1104: "MLS-11-04 — Materials receiving & using (Deck)",
    docMLS1113: "MLS-11-13 — Container lashing gear",
    docKhac: "Other",
    kyBaoCao: "Reporting period",
    tieuDePlaceholder: "Title (leave empty to use the file name)",
    fileBaoCao: "Report file (PDF or Excel, max 20MB)",
    ghiChuTuyChon: "Notes (optional)",
    dangTaiLen: "Uploading...",
    luuYTruoc: "Note: once uploaded, a file is",
    luuYDam: "an immutable record",
    luuYSau:
      "— it cannot be edited or replaced. If you upload the wrong file, upload the correct one instead (the newest one is listed on top); only company administrators may delete.",
    xacNhanXoaHoSo:
      'Permanently delete the document "{ten}"? This action cannot be undone.',

    chuyenTau: "Switch vessel:",
  }
);
