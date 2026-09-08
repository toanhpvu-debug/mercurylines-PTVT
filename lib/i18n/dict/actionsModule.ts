import { tuDien } from "./_kieu";

/**
 * Thông báo trả về từ các server action NGOÀI app/actions.ts (paint-actions,
 * consumable-actions, quyen-actions) và từ API route. Tách khỏi `actions` để
 * hai người dịch song song không cùng sửa một file.
 *
 * Không có ở đây: chữ do bộ đọc file sinh ra (lib/paintImport.ts,
 * lib/bunkerParse.ts, lib/pdfOcr.ts) — những chuỗi đó đi thẳng ra màn hình; và
 * chữ ghi vào DATABASE (itemName, purpose, note của nhật ký phê duyệt, nhật ký
 * người dùng) — hồ sơ giữ nguyên một thứ tiếng, không đổi theo người đang xem.
 */
export const actionsModule = tuDien(
  {
    // ── Dùng chung giữa các file trong nhóm này ──────────────────────────────
    chuaDangNhap: "Chưa đăng nhập.",
    fileKhongConTrenMayChu: "File không còn trên máy chủ.",
    banGhiDaXoaTruoc: "Bản ghi đã bị xóa trước đó.",
    tauKhongTonTai: "Tàu không tồn tại.",
    loaiGiaoDichKhongHopLe: "Loại giao dịch không hợp lệ.",
    soLuongPhaiLonHonKhong: "Số lượng phải lớn hơn 0.",
    thoiDiemKhongHopLe: "Thời điểm không hợp lệ.",
    khongGhiThoiDiemTuongLai: "Không ghi được thời điểm ở tương lai.",
    filePhaiLaExcel: "File phải là Excel (.xls hoặc .xlsx).",
    fileVuotQua10Mb: "File vượt quá 10MB.",
    daNgungDungTen: 'Đã ngừng dùng "{ten}".',
    daDungLaiTen: 'Đã dùng lại "{ten}".',
    daXoaTen: 'Đã xóa "{ten}".',
    /** Nơi yêu cầu vừa lập được chuyển tới — ghép vào câu "…lên {noi}." */
    noiDuyetCongTy: "quản lý kỹ thuật công ty",
    noiDuyetCapTau: "duyệt cấp tàu",

    // ── Quản lý sơn (app/paint-actions.ts) ───────────────────────────────────
    son_suaLoaiSonDungChung:
      "Sửa loại sơn đang dùng chung là việc của thuyền trưởng hoặc văn phòng. Bạn thêm loại mới được.",
    son_tenSonBatBuoc: "Tên sơn là bắt buộc.",
    son_loaiSonKhongHopLe: "Loại sơn không hợp lệ.",
    son_maSonDaTonTai: 'Mã sơn "{ma}" đã tồn tại.',
    son_loaiSonNayDaXoa: "Loại sơn này đã bị xóa trước đó.",
    son_daLuuSon: 'Đã lưu sơn "{ten}".',
    son_khongTimThayLoaiSon: "Không tìm thấy loại sơn.",
    son_loaiSonDaXoa: "Loại sơn đã bị xóa trước đó.",
    son_khongXoaDuocDaDung:
      'Không xóa được: "{ten}" đã có {gd} giao dịch nhập/xuất, {lop} lớp sơ đồ, {nk} dòng nhật ký. Hãy dùng "Ngừng dùng".',
    son_khongXoaDuocConTon:
      'Không xóa được: còn tồn trên {n} tàu. Hãy xuất hết hoặc dùng "Ngừng dùng".',
    son_khongXoaDuocConThamChieu:
      'Không xóa được: "{ten}" còn được tham chiếu ở nơi khác. Hãy dùng "Ngừng dùng".',
    son_tenKhuVucBatBuoc: "Tên khu vực là bắt buộc.",
    son_khuVucTrungTen: 'Tàu này đã có khu vực tên "{ten}".',
    son_khuVucDaXoa: "Khu vực này đã bị xóa trước đó.",
    son_daLuuKhuVuc: 'Đã lưu khu vực "{ten}".',
    son_khongTimThayKhuVuc: "Không tìm thấy khu vực.",
    son_khongXoaDuocKhuVuc:
      "Không xóa được: đã có {n} lần thi công ghi vào khu vực này. Xóa các bản ghi nhật ký trước nếu thật sự cần.",
    son_daXoaKhuVuc: 'Đã xóa khu vực "{ten}".',
    son_chonKhuVucVaLoaiSon: "Chọn khu vực và loại sơn.",
    son_khuVucKhongThuocTau: "Khu vực không thuộc tàu này.",
    son_khongTimThayLopSon: "Không tìm thấy lớp sơn.",
    son_lopSonDaXoa: "Lớp sơn này đã bị xóa trước đó.",
    son_daLuuLopSon: "Đã lưu lớp sơn.",
    son_daXoaLopSon: "Đã xóa lớp sơn.",
    son_loaiMoiChuaCoTon:
      "Loại sơn mới thì chưa có tồn để xuất. Chọn “Nhận sơn lên tàu” cho lần ghi đầu tiên.",
    son_chonHoacKhaiLoaiSon: "Chọn loại sơn hoặc khai loại sơn mới.",
    son_khongDuTonXuat: "Không đủ tồn: còn {con}, muốn xuất {muon}.",
    son_daNhapSon: "Đã nhập sơn.",
    son_daXuatSon: "Đã xuất sơn.",
    son_thieuLoaiSon: "Thiếu loại sơn.",
    son_daLuuDinhMucToiThieu: "Đã lưu định mức tối thiểu.",
    son_chonNgayThiCong: "Chọn ngày thi công.",
    son_ngayThiCongKhongHopLe: "Ngày thi công không hợp lệ.",
    son_khongGhiNgayTuongLai: "Không ghi được ngày ở tương lai.",
    son_nhapItNhatMotDong:
      "Nhập ít nhất một dòng sơn đã dùng (loại sơn + số lượng).",
    son_khongDuTonSon: 'Không đủ tồn "{ten}": còn {con}, cần {can}.',
    son_loaiSonVuaBiXoa:
      "Một loại sơn trong bản ghi vừa bị người khác xóa. Chưa ghi gì cả, hãy mở lại trang rồi nhập lại.",
    son_khuVucHoacLoaiSonVuaBiXoa:
      "Khu vực hoặc loại sơn trong bản ghi vừa bị xóa. Chưa ghi gì cả, hãy mở lại trang rồi nhập lại.",
    son_daGhiNhatKy: "Đã ghi nhật ký thi công và trừ tồn sơn.",
    son_khongTimThayThiCong: "Không tìm thấy bản ghi thi công.",
    son_banGhiThiCongDaXoa: "Bản ghi thi công đã bị xóa trước đó.",
    son_daXoaNhatKy: "Đã xóa bản ghi thi công và hoàn lại tồn sơn.",
    son_chonTauKhac: "Chọn một tàu khác để sao chép sơ đồ.",
    son_khongXemDuocTauNguon: "Bạn không được xem sơ đồ của tàu nguồn.",
    son_tauNguonChuaCoKhuVuc: "Tàu nguồn chưa có khu vực sơn nào.",
    son_khongSaoChepDuoc:
      "Không sao chép được khu vực nào — cả {n} khu vực đều đã tồn tại trên tàu này.",
    son_daSaoChep: "Đã sao chép {kv} khu vực và {lop} lớp sơn.",
    son_boQuaKhuVucDaCo: "Bỏ qua {n} khu vực đã có sẵn.",

    // Nhập sơn từ file: chỗ hỏng trong file và các lỗi hạ tầng khi ghi.
    son_khoanCongDon: "“{ten}” (cộng dồn từ các sheet: {ds})",
    son_dongDauTien: "dòng đầu tiên",
    son_loiTrungMa:
      "Có phiên nhập sơn khác chạy cùng lúc nên mã sơn tự sinh bị trùng khi ghi {viTri}. Chưa ghi dòng nào, hãy bấm nhập lại.",
    son_loiTranhTon:
      "Có phiên nhập/xuất sơn khác chạy cùng lúc nên hai bên tranh nhau cùng một dòng tồn (dừng ở {viTri}). Chưa ghi dòng nào, hãy bấm nhập lại — không cần sửa file.",
    son_loiLoaiSonVuaXoa:
      "Loại sơn ở {viTri} vừa bị người khác xóa khỏi danh mục. Chưa ghi dòng nào, hãy mở lại trang rồi nhập lại.",
    son_loiKhoaNgoai:
      "Không ghi được {viTri}: tàu hoặc loại sơn liên quan không còn tồn tại. Chưa ghi dòng nào.",
    son_loiQuaThoiGian:
      "Quá thời gian ghi khi tới {viTri} — hoặc file quá dài, hoặc hệ thống đang bận. Chưa ghi dòng nào; hãy thử lại, nếu vẫn vậy thì tách file thành nhiều phần nhỏ hơn.",
    son_tauKhongHopLe: "Tàu không hợp lệ.",
    son_chiGhiTonTauPhuTrach:
      "Bạn chỉ ghi tồn được cho tàu mình phụ trách.",
    son_chuaDocPdfDanhMuc:
      "Chưa đọc trực tiếp được file PDF. Hãy mở PDF, bôi đen bảng (Ctrl+A), copy (Ctrl+C) rồi dán vào ô “Dán từ PDF” bên dưới — cách này chính xác hơn vì trình đọc PDF lo phần trích chữ.",
    son_chonFileHoacDanPdf: "Hãy chọn file Excel hoặc dán nội dung từ PDF.",
    son_khongNhapDuocDanhMuc:
      "Không nhập được danh mục sơn, hỏng ở {viTri}. Chưa ghi dòng nào — hãy kiểm tra lại dòng đó trong file rồi thử lại.",
    son_daDocNDong: "Đã đọc {n} dòng:",
    son_nLoaiSonMoi: "{n} loại sơn mới",
    son_nLoaiBoSung: "{n} loại đã có được bổ sung thông tin",
    son_nDongGhiTon: "{n} dòng ghi tồn",
    son_nDongBoQua: "{n} dòng bỏ qua",
    son_sheetDaDoc: "Sheet đã đọc: {ds}",
    son_fileBiCatDanhMuc:
      "⚠ File vượt quá giới hạn đọc nên phần cuối chưa được nhập — hãy tách file nhỏ hơn rồi nhập nốt phần còn lại",

    son_nhapSoLuongItNhatMot: "Nhập số lượng cho ít nhất một loại sơn.",
    son_loaiSonKhongConTrongDanhMuc: "Có loại sơn không còn trong danh mục.",
    son_daGuiYeuCau: "Đã gửi yêu cầu {so} ({n} loại sơn) lên {noi}.",

    son_chonNhapHoacXuat: "Chọn Nhập hoặc Xuất.",
    son_chuaDocPdfHangLoat:
      "Chưa đọc trực tiếp được file PDF. Mở PDF, bôi đen bảng (Ctrl+A), copy rồi dán vào ô bên dưới.",
    son_chonFileHoacDanBang: "Hãy chọn file Excel hoặc dán nội dung bảng.",
    son_fileKhongCoSoLuong:
      "File không có dòng nào kèm số lượng. Bảng cần một cột số lượng (Tồn / Số lượng / Qty).",
    son_dongThieuTon: "{mo}: cần {can}, còn {con}",
    son_khongXuatDuocThieuTon:
      "Không xuất được, {n} dòng thiếu tồn (chưa ghi gì cả):",
    son_conNDongNua: "… và {n} dòng nữa",
    son_khongDuTonCho: "Không đủ tồn cho {mo}: cần {can}, còn {con}.",
    son_chuaGhiSuaFile: "Chưa ghi dòng nào, hãy sửa file rồi nhập lại.",
    son_khongGhiDuocLo:
      "Không ghi được lô nhập/xuất sơn, hỏng ở {viTri}. Chưa ghi dòng nào — hãy kiểm tra lại dòng đó trong file rồi thử lại.",
    son_daNhapNLoai: "Đã nhập {n} loại sơn, tổng {tong}",
    son_daXuatNLoai: "Đã xuất {n} loại sơn, tổng {tong}",
    son_nLoaiMoiThemVaoDanhMuc: "{n} loại sơn mới được thêm vào danh mục",
    son_boQuaNDongKhongDoc: "bỏ qua {n} dòng không đọc được",
    son_fileBiCatHangLoat:
      "⚠ File vượt quá giới hạn đọc nên phần cuối chưa được nhập — hãy tách phần còn lại ra file riêng rồi nhập nốt, đừng nhập lại cả file",

    // ── Dầu · dầu nhờn · hóa chất (app/consumable-actions.ts) ────────────────
    nhienLieu_nhomKhongHopLe: "Nhóm không hợp lệ.",
    nhienLieu_suaMatHangDungChung:
      "Sửa mặt hàng dùng chung là việc của thuyền trưởng hoặc văn phòng. Bạn thêm mặt hàng mới được.",
    nhienLieu_tenMatHangBatBuoc: "Tên mặt hàng là bắt buộc.",
    nhienLieu_chungLoaiKhongHopLe: "Chủng loại không hợp lệ với nhóm đã chọn.",
    nhienLieu_maDaTonTai: 'Mã "{ma}" đã tồn tại.',
    nhienLieu_daLuuMatHang: 'Đã lưu "{ten}".',
    nhienLieu_khongTimThayMatHang: "Không tìm thấy mặt hàng.",
    nhienLieu_khongXoaDuoc:
      'Không xóa được: đã có {phieu} phiếu nhận, {gd} giao dịch và {ton} dòng tồn gắn với mặt hàng này. Dùng "Ngừng dùng" để ẩn khỏi ô chọn mà vẫn giữ lịch sử.',
    nhienLieu_thieuTauHoacMatHang: "Thiếu tàu hoặc mặt hàng.",
    nhienLieu_matHangKhongTonTai: "Mặt hàng không tồn tại.",
    nhienLieu_soBdnBatBuoc:
      "Số BDN là bắt buộc — không có số BDN thì lô dầu không đối chiếu được khi kiểm tra.",
    nhienLieu_soPhieuGiaoBatBuoc: "Số phiếu giao hàng là bắt buộc.",
    nhienLieu_ngayNhanTuongLai: "Không ghi được ngày nhận ở tương lai.",
    nhienLieu_dinhKemVuot20Mb: "File đính kèm vượt quá 20MB.",
    nhienLieu_dinhKemPhaiPdf: "File đính kèm phải là PDF.",
    nhienLieu_daGhiNhan: "Đã ghi nhận {sl} {dv} theo {so}.",
    nhienLieu_mauDauGiuToi: "Mẫu dầu giữ tới {ngay} (MARPOL VI 18.8.1).",
    nhienLieu_hanDungLo: "Hạn dùng lô: {ngay}.",
    nhienLieu_khongTimThayPhieu: "Không tìm thấy phiếu.",
    nhienLieu_daXoaPhieu: "Đã xóa phiếu {so} và hoàn lại tồn.",
    nhienLieu_noiTieuThuKhongHopLe: "Nơi tiêu thụ không hợp lệ.",
    nhienLieu_khongDuTon: "Không đủ tồn: còn {con} {dv}, muốn ghi {muon}.",
    nhienLieu_daGhiNhanVaoTon: "Đã ghi nhận vào tồn.",
    nhienLieu_daGhiTieuThu: "Đã ghi tiêu thụ.",
    nhienLieu_daGhiXuat: "Đã ghi xuất.",
    nhienLieu_daLuuDinhMuc: "Đã lưu định mức.",
    nhienLieu_hayChonPdf: "Hãy chọn file PDF.",
    nhienLieu_filePhaiLaPdf: "File phải là PDF (.pdf).",
    nhienLieu_fileVuot20Mb: "File vượt quá 20MB.",
    nhienLieu_docKhongNhanRaO:
      "Đọc được chữ nhưng không nhận ra ô nào quen thuộc. Hãy nhập tay và đối chiếu với bản gốc.",
    nhienLieu_daDocNO:
      "Đã đọc {n} ô từ bản scan. Đối chiếu lại với bản gốc trước khi lưu — chữ nhận dạng từ ảnh không bao giờ đúng tuyệt đối.",
    nhienLieu_nhapSoLuongItNhatMot: "Nhập số lượng cho ít nhất một mặt hàng.",
    nhienLieu_matHangKhongConTrongDanhMuc:
      "Có mặt hàng không còn trong danh mục.",
    nhienLieu_khongPhuTrachNhom:
      'Bạn không phụ trách nhóm của mặt hàng "{ten}" nên không xin cấp được.',
    nhienLieu_daGuiYeuCau: "Đã gửi yêu cầu {so} ({n} mặt hàng) lên {noi}.",

    // ── Phân quyền · ủy quyền (app/quyen-actions.ts) ─────────────────────────
    quyen_khongTimThayNguoiDung: "Không tìm thấy người dùng.",
    quyen_chiApDungCho: "Phân công đội tàu chỉ áp dụng cho {vaiTro}.",
    quyen_daPhanCong: "Đã phân công {n} tàu cho {ten}.",
    quyen_daBoPhanCong:
      "Đã bỏ phân công tàu của {ten} — tài khoản này trở lại thấy toàn đội.",
    quyen_chiUyQuyenCuaMinh: "Chỉ ủy quyền được phần quyền của chính mình.",
    quyen_chonNguoiNhan: "Chọn người nhận ủy quyền.",
    quyen_khongUyQuyenChoMinh: "Không thể ủy quyền cho chính mình.",
    quyen_khongUyQuyenAdmin:
      "Không ủy quyền được quyền quản trị hệ thống. Hãy chọn người giao quyền là thuyền trưởng / máy trưởng / quản lý kỹ thuật.",
    quyen_taiKhoanBiKhoa: "Tài khoản {email} đang bị khóa.",
    quyen_nhapDuNgay: "Nhập đủ ngày bắt đầu và ngày hết hạn.",
    quyen_ngayHetHanSauBatDau: "Ngày hết hạn phải sau ngày bắt đầu.",
    quyen_toiDaMotNam: "Ủy quyền tối đa một năm. Hết hạn thì lập lại.",
    quyen_daUyQuyen: "Đã ủy quyền cho {ten} tới {ngay}.",
    quyen_khongTimThayUyQuyen: "Không tìm thấy ủy quyền.",
    quyen_chiNguoiUyQuyenThuHoi:
      "Chỉ người đã ủy quyền hoặc quản trị mới thu hồi được.",
    quyen_daThuHoiRoi: "Ủy quyền này đã được thu hồi.",
    quyen_daThuHoi: "Đã thu hồi ủy quyền cho {ten}.",

    // ── Yêu cầu vật tư (app/api/material-requests) ───────────────────────────
    yeuCau_tauBatBuoc: "Tàu là bắt buộc.",
    yeuCau_chuaGanTau: "Bạn chưa được gán tàu nên không thể tạo yêu cầu.",
    yeuCau_chiTauPhuTrach:
      "Bạn chỉ có thể tạo yêu cầu cho tàu mình phụ trách.",
    yeuCau_itNhatMotDong: "Yêu cầu phải có ít nhất một dòng.",
    yeuCau_danhSachKhongHopLe: "Danh sách vật tư không hợp lệ.",
    yeuCau_vatTuKhongTonTai: "Có vật tư không tồn tại trong danh mục.",
    yeuCau_khongTaoDuoc: "Không thể tạo yêu cầu.",

    // ── Tải tài liệu · xuất biểu mẫu (các route trả file) ────────────────────
    taiLieu_khongXemDuocBanGoc: "Bạn không có quyền xem bản gốc phiếu này.",
    taiLieu_thieuTau: "Thiếu tàu.",
    taiLieu_thieuBieuMau:
      "Chưa có file biểu mẫu templates/MLS-11-06.xlsx. Hãy chép biểu mẫu Excel của công ty vào thư mục templates/ (xem templates/README.md).",
  },
  {
    chuaDangNhap: "You are not signed in.",
    fileKhongConTrenMayChu: "The file is no longer on the server.",
    banGhiDaXoaTruoc: "This record has already been deleted.",
    tauKhongTonTai: "The vessel does not exist.",
    loaiGiaoDichKhongHopLe: "Invalid transaction type.",
    soLuongPhaiLonHonKhong: "The quantity must be greater than 0.",
    thoiDiemKhongHopLe: "Invalid date and time.",
    khongGhiThoiDiemTuongLai: "A time in the future cannot be recorded.",
    filePhaiLaExcel: "The file must be an Excel file (.xls or .xlsx).",
    fileVuotQua10Mb: "The file is larger than 10MB.",
    daNgungDungTen: 'Discontinued "{ten}".',
    daDungLaiTen: 'Reactivated "{ten}".',
    daXoaTen: 'Deleted "{ten}".',
    noiDuyetCongTy: "the company technical manager",
    noiDuyetCapTau: "vessel-level approval",

    son_suaLoaiSonDungChung:
      "Editing a shared paint type is for the Master or the office. You may add new types.",
    son_tenSonBatBuoc: "The paint name is required.",
    son_loaiSonKhongHopLe: "Invalid paint type.",
    son_maSonDaTonTai: 'Paint code "{ma}" already exists.',
    son_loaiSonNayDaXoa: "This paint type has already been deleted.",
    son_daLuuSon: 'Paint "{ten}" saved.',
    son_khongTimThayLoaiSon: "Paint type not found.",
    son_loaiSonDaXoa: "The paint type has already been deleted.",
    son_khongXoaDuocDaDung:
      'Cannot delete: "{ten}" already has {gd} receipt/issue transactions, {lop} scheme layers and {nk} work log lines. Use "Discontinue" instead.',
    son_khongXoaDuocConTon:
      'Cannot delete: there is still stock on {n} vessels. Issue it all out or use "Discontinue".',
    son_khongXoaDuocConThamChieu:
      'Cannot delete: "{ten}" is still referenced elsewhere. Use "Discontinue" instead.',
    son_tenKhuVucBatBuoc: "The area name is required.",
    son_khuVucTrungTen: 'This vessel already has an area named "{ten}".',
    son_khuVucDaXoa: "This area has already been deleted.",
    son_daLuuKhuVuc: 'Area "{ten}" saved.',
    son_khongTimThayKhuVuc: "Area not found.",
    son_khongXoaDuocKhuVuc:
      "Cannot delete: {n} painting jobs have been recorded against this area. Delete those work log records first if it is really needed.",
    son_daXoaKhuVuc: 'Area "{ten}" deleted.',
    son_chonKhuVucVaLoaiSon: "Select an area and a paint type.",
    son_khuVucKhongThuocTau: "The area does not belong to this vessel.",
    son_khongTimThayLopSon: "Paint layer not found.",
    son_lopSonDaXoa: "This paint layer has already been deleted.",
    son_daLuuLopSon: "Paint layer saved.",
    son_daXoaLopSon: "Paint layer deleted.",
    son_loaiMoiChuaCoTon:
      "A new paint type has no stock to issue yet. Choose “Receive paint on board” for the first entry.",
    son_chonHoacKhaiLoaiSon: "Select a paint type or declare a new one.",
    son_khongDuTonXuat:
      "Not enough stock: {con} left, {muon} requested for issue.",
    son_daNhapSon: "Paint receipt recorded.",
    son_daXuatSon: "Paint issue recorded.",
    son_thieuLoaiSon: "The paint type is missing.",
    son_daLuuDinhMucToiThieu: "Minimum stock saved.",
    son_chonNgayThiCong: "Select the work date.",
    son_ngayThiCongKhongHopLe: "Invalid work date.",
    son_khongGhiNgayTuongLai: "A date in the future cannot be recorded.",
    son_nhapItNhatMotDong:
      "Enter at least one line of paint used (paint type + quantity).",
    son_khongDuTonSon:
      'Not enough stock of "{ten}": {con} left, {can} needed.',
    son_loaiSonVuaBiXoa:
      "One of the paint types in this record has just been deleted by someone else. Nothing was saved; reload the page and enter it again.",
    son_khuVucHoacLoaiSonVuaBiXoa:
      "The area or a paint type in this record has just been deleted. Nothing was saved; reload the page and enter it again.",
    son_daGhiNhatKy:
      "The painting job has been logged and the paint stock deducted.",
    son_khongTimThayThiCong: "Painting job record not found.",
    son_banGhiThiCongDaXoa:
      "The painting job record has already been deleted.",
    son_daXoaNhatKy:
      "The painting job record has been deleted and the paint stock restored.",
    son_chonTauKhac: "Select another vessel to copy the scheme from.",
    son_khongXemDuocTauNguon:
      "You are not allowed to view the scheme of the source vessel.",
    son_tauNguonChuaCoKhuVuc: "The source vessel has no paint area yet.",
    son_khongSaoChepDuoc:
      "No area could be copied — all {n} areas already exist on this vessel.",
    son_daSaoChep: "Copied {kv} areas and {lop} paint layers.",
    son_boQuaKhuVucDaCo: "Skipped {n} areas that already existed.",

    son_khoanCongDon: "“{ten}” (totalled from sheets: {ds})",
    son_dongDauTien: "the first line",
    son_loiTrungMa:
      "Another paint import was running at the same time, so the auto-generated paint code clashed while writing {viTri}. No line was saved; press import again.",
    son_loiTranhTon:
      "Another paint receipt/issue import was running at the same time and both fought over the same stock row (stopped at {viTri}). No line was saved; press import again — the file does not need fixing.",
    son_loiLoaiSonVuaXoa:
      "The paint type at {viTri} has just been deleted from the catalogue by someone else. No line was saved; reload the page and import again.",
    son_loiKhoaNgoai:
      "{viTri} could not be saved: the vessel or the paint type involved no longer exists. No line was saved.",
    son_loiQuaThoiGian:
      "The write timed out at {viTri} — either the file is too long or the system is busy. No line was saved; try again, and if it keeps happening split the file into smaller parts.",
    son_tauKhongHopLe: "Invalid vessel.",
    son_chiGhiTonTauPhuTrach:
      "You may only record stock for the vessels you are responsible for.",
    son_chuaDocPdfDanhMuc:
      "PDF files cannot be read directly yet. Open the PDF, select the table (Ctrl+A), copy it (Ctrl+C) and paste it into the “Paste from PDF” box below — that is more accurate, because the PDF reader does the text extraction.",
    son_chonFileHoacDanPdf:
      "Please choose an Excel file or paste the content from the PDF.",
    son_khongNhapDuocDanhMuc:
      "The paint catalogue could not be imported; it failed at {viTri}. No line was saved — check that line in the file and try again.",
    son_daDocNDong: "Read {n} lines:",
    son_nLoaiSonMoi: "{n} new paint types",
    son_nLoaiBoSung: "{n} existing types had details filled in",
    son_nDongGhiTon: "{n} stock lines recorded",
    son_nDongBoQua: "{n} lines skipped",
    son_sheetDaDoc: "Sheets read: {ds}",
    son_fileBiCatDanhMuc:
      "⚠ The file is over the reading limit, so its last part was not imported — split it into a smaller file and import the rest",

    son_nhapSoLuongItNhatMot: "Enter a quantity for at least one paint type.",
    son_loaiSonKhongConTrongDanhMuc:
      "Some paint types are no longer in the catalogue.",
    son_daGuiYeuCau: "Request {so} ({n} paint types) has been sent to {noi}.",

    son_chonNhapHoacXuat: "Choose Receipt or Issue.",
    son_chuaDocPdfHangLoat:
      "PDF files cannot be read directly yet. Open the PDF, select the table (Ctrl+A), copy it and paste it into the box below.",
    son_chonFileHoacDanBang:
      "Please choose an Excel file or paste the table content.",
    son_fileKhongCoSoLuong:
      "The file has no line with a quantity. The table needs a quantity column (ROB / Quantity / Qty).",
    son_dongThieuTon: "{mo}: {can} needed, {con} left",
    son_khongXuatDuocThieuTon:
      "Cannot issue, {n} lines are short of stock (nothing was saved):",
    son_conNDongNua: "… and {n} more lines",
    son_khongDuTonCho: "Not enough stock for {mo}: {can} needed, {con} left.",
    son_chuaGhiSuaFile: "No line was saved; fix the file and import again.",
    son_khongGhiDuocLo:
      "The paint receipt/issue batch could not be saved; it failed at {viTri}. No line was saved — check that line in the file and try again.",
    son_daNhapNLoai: "Received {n} paint types, {tong} in total",
    son_daXuatNLoai: "Issued {n} paint types, {tong} in total",
    son_nLoaiMoiThemVaoDanhMuc: "{n} new paint types added to the catalogue",
    son_boQuaNDongKhongDoc: "{n} unreadable lines skipped",
    son_fileBiCatHangLoat:
      "⚠ The file is over the reading limit, so its last part was not imported — put the rest in a separate file and import that, do not import the whole file again",

    nhienLieu_nhomKhongHopLe: "Invalid group.",
    nhienLieu_suaMatHangDungChung:
      "Editing a shared item is for the Master or the office. You may add new items.",
    nhienLieu_tenMatHangBatBuoc: "The item name is required.",
    nhienLieu_chungLoaiKhongHopLe:
      "The grade does not match the selected group.",
    nhienLieu_maDaTonTai: 'Code "{ma}" already exists.',
    nhienLieu_daLuuMatHang: 'Saved "{ten}".',
    nhienLieu_khongTimThayMatHang: "Item not found.",
    nhienLieu_khongXoaDuoc:
      'Cannot delete: {phieu} receipts, {gd} transactions and {ton} stock lines are attached to this item. Use "Discontinue" to hide it from the selection box while keeping the history.',
    nhienLieu_thieuTauHoacMatHang: "The vessel or the item is missing.",
    nhienLieu_matHangKhongTonTai: "The item does not exist.",
    nhienLieu_soBdnBatBuoc:
      "The BDN number is required — without it the bunker batch cannot be traced back to its paperwork during an inspection.",
    nhienLieu_soPhieuGiaoBatBuoc: "The delivery note number is required.",
    nhienLieu_ngayNhanTuongLai:
      "A receiving date in the future cannot be recorded.",
    nhienLieu_dinhKemVuot20Mb: "The attachment is larger than 20MB.",
    nhienLieu_dinhKemPhaiPdf: "The attachment must be a PDF.",
    nhienLieu_daGhiNhan: "Recorded {sl} {dv} against {so}.",
    nhienLieu_mauDauGiuToi:
      "The fuel sample must be kept until {ngay} (MARPOL VI 18.8.1).",
    nhienLieu_hanDungLo: "Batch expiry date: {ngay}.",
    nhienLieu_khongTimThayPhieu: "Receipt not found.",
    nhienLieu_daXoaPhieu:
      "Receipt {so} has been deleted and the stock restored.",
    nhienLieu_noiTieuThuKhongHopLe: "Invalid consumer.",
    nhienLieu_khongDuTon:
      "Not enough stock: {con} {dv} left, {muon} requested.",
    nhienLieu_daGhiNhanVaoTon: "Receipt into stock recorded.",
    nhienLieu_daGhiTieuThu: "Consumption recorded.",
    nhienLieu_daGhiXuat: "Issue recorded.",
    nhienLieu_daLuuDinhMuc: "Minimum stock saved.",
    nhienLieu_hayChonPdf: "Please choose a PDF file.",
    nhienLieu_filePhaiLaPdf: "The file must be a PDF (.pdf).",
    nhienLieu_fileVuot20Mb: "The file is larger than 20MB.",
    nhienLieu_docKhongNhanRaO:
      "Text was read but no familiar field was recognised. Enter the data by hand and check it against the original.",
    nhienLieu_daDocNO:
      "{n} fields were read from the scan. Check them against the original before saving — text recognised from an image is never perfectly accurate.",
    nhienLieu_nhapSoLuongItNhatMot: "Enter a quantity for at least one item.",
    nhienLieu_matHangKhongConTrongDanhMuc:
      "Some items are no longer in the catalogue.",
    nhienLieu_khongPhuTrachNhom:
      'You are not responsible for the group of item "{ten}", so you cannot request it.',
    nhienLieu_daGuiYeuCau: "Request {so} ({n} items) has been sent to {noi}.",

    quyen_khongTimThayNguoiDung: "User not found.",
    quyen_chiApDungCho: "Fleet assignment only applies to the {vaiTro}.",
    quyen_daPhanCong: "Assigned {n} vessels to {ten}.",
    quyen_daBoPhanCong:
      "The vessel assignment of {ten} has been removed — this account sees the whole fleet again.",
    quyen_chiUyQuyenCuaMinh: "You may only delegate your own authority.",
    quyen_chonNguoiNhan: "Select the person to delegate to.",
    quyen_khongUyQuyenChoMinh: "You cannot delegate to yourself.",
    quyen_khongUyQuyenAdmin:
      "System administrator rights cannot be delegated. Choose a Master, Chief Engineer or Technical Manager as the delegator.",
    quyen_taiKhoanBiKhoa: "Account {email} is locked.",
    quyen_nhapDuNgay: "Enter both the start date and the end date.",
    quyen_ngayHetHanSauBatDau: "The end date must be after the start date.",
    quyen_toiDaMotNam:
      "A delegation may last one year at most. Set up a new one when it expires.",
    quyen_daUyQuyen: "Delegated to {ten} until {ngay}.",
    quyen_khongTimThayUyQuyen: "Delegation not found.",
    quyen_chiNguoiUyQuyenThuHoi:
      "Only the person who granted the delegation, or an administrator, may revoke it.",
    quyen_daThuHoiRoi: "This delegation has already been revoked.",
    quyen_daThuHoi: "The delegation to {ten} has been revoked.",

    yeuCau_tauBatBuoc: "The vessel is required.",
    yeuCau_chuaGanTau:
      "You have not been assigned to a vessel, so you cannot create a request.",
    yeuCau_chiTauPhuTrach:
      "You may only create requests for the vessels you are responsible for.",
    yeuCau_itNhatMotDong: "A request must have at least one line.",
    yeuCau_danhSachKhongHopLe: "The item list is invalid.",
    yeuCau_vatTuKhongTonTai: "Some items do not exist in the catalogue.",
    yeuCau_khongTaoDuoc: "The request could not be created.",

    taiLieu_khongXemDuocBanGoc:
      "You do not have permission to view the original of this receipt.",
    taiLieu_thieuTau: "The vessel is missing.",
    taiLieu_thieuBieuMau:
      "The form file templates/MLS-11-06.xlsx is missing. Copy the company Excel form into the templates/ folder (see templates/README.md).",
  }
);
