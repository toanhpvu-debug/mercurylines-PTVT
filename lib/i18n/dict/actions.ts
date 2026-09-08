import { tuDien } from "./_kieu";

/** Thông báo trả về từ server action (app/*-actions.ts) và API route. */
export const actions = tuDien(
  {
    // Dùng chung nhiều nơi
    daLuu: "Đã lưu.",
    daLuuThayDoi: "Đã lưu thay đổi.",
    daLuuTen: 'Đã lưu "{ten}".',
    soLuongKhongHopLe: "Số lượng không hợp lệ.",
    vuiLongChonTau: "Vui lòng chọn tàu.",
    vuiLongChonNcc: "Vui lòng chọn nhà cung cấp.",

    // Lỗi hạ tầng của giao dịch (thongBaoLoiGiaoDich)
    giaoDich_heThongBan:
      "Hệ thống đang bận xử lý một thao tác khác trên cùng dữ liệu. Vui lòng thử lại sau ít giây.",
    giaoDich_ghiTrung:
      "Có người vừa ghi một bản ghi trùng. Vui lòng tải lại trang và thử lại.",

    // Đăng nhập
    dangNhap_thieuEmailMatKhau: "Vui lòng nhập email và mật khẩu.",
    dangNhap_tamKhoa:
      "Đã thử sai quá nhiều lần. Vui lòng chờ {phut} phút rồi thử lại.",
    dangNhap_saiThongTin: "Email hoặc mật khẩu không đúng.",
    dangNhap_thieuSessionSecret:
      "Máy chủ chưa cấu hình SESSION_SECRET nên không tạo được phiên đăng nhập. Liên hệ quản trị hệ thống.",

    // Tàu
    tau_maVaTenBatBuoc: "Mã tàu và tên tàu là bắt buộc.",
    tau_maDaTonTai: 'Mã tàu "{ma}" đã tồn tại.',
    tau_daThem: 'Đã thêm tàu "{ten}".',
    tau_khongTimThay: "Không tìm thấy tàu.",
    tau_khongTonTai: "Tàu không tồn tại.",
    tau_khongHopLe: "Tàu không hợp lệ.",
    tau_trangThaiKhongHopLe: "Trạng thái tàu không hợp lệ.",
    tau_daLuuVaDoiTenKho:
      "Đã lưu thay đổi và đổi tên {n} kho theo tên tàu mới.",
    tau_conYeuCauKhongXoaDuoc:
      'Tàu đang có {n} yêu cầu vật tư nên không thể xóa. Hãy chuyển trạng thái sang "Ngừng khai thác" thay vì xóa.',
    tau_conNguoiDungKhongXoaDuoc:
      "Tàu đang có {n} người dùng được gán phụ trách. Hãy gỡ gán hoặc chuyển tàu cho họ trong trang Người dùng trước khi xóa.",
    tau_conDuLieuLienQuan:
      "Tàu đang có dữ liệu liên quan (yêu cầu vật tư) nên không thể xóa.",
    tau_hoMayChinhKhongCoTrongQuyUoc:
      'Họ máy chính "{nhom}" không có trong quy ước.',
    tauPhuTrach_khongHopLe: "Tàu phụ trách không hợp lệ.",
    tauPhuTrach_khongTonTai: "Tàu phụ trách không tồn tại.",

    // Vật tư / danh mục
    vatTu_maVaTenBatBuoc: "Mã vật tư và tên vật tư là bắt buộc.",
    vatTu_maDaTonTai: 'Mã vật tư "{ma}" đã tồn tại.',
    vatTu_daThem: 'Đã thêm vật tư "{ten}".',
    vatTu_khongTimThay: "Không tìm thấy vật tư.",
    vatTu_khongTonTai: "Vật tư không tồn tại.",
    vatTu_daBiXoa: "Vật tư đã bị xóa.",
    vatTu_daXoaHoacKhongTonTai: "Vật tư đã bị xóa hoặc không tồn tại.",
    vatTu_daDungTrongYeuCau:
      "Vật tư đã dùng trong yêu cầu vật tư nên không thể xóa. Hãy chọn Ngừng sử dụng để giữ lịch sử.",
    vatTu_dangCoTonKho:
      "Vật tư đang có bản ghi tồn kho trên tàu nên không thể xóa (tránh mất số liệu tồn). Hãy chọn Ngừng sử dụng.",
    vatTu_dangDuocThamChieu:
      "Vật tư đang được tham chiếu ở nơi khác nên không thể xóa. Hãy chọn Ngừng sử dụng.",
    vatTu_loaiKhongHopLe: "Loại vật tư không hợp lệ.",
    vatTu_tonToiThieuKhongHopLe: "Tồn tối thiểu không hợp lệ.",
    vatTu_tonToiDaKhongHopLe: "Tồn tối đa không hợp lệ.",
    vatTu_maDaCoOVatTuKhac: 'Mã vật tư "{ma}" đã có ở vật tư khác.',
    vatTu_khongCapDuocMa: "Không cấp được mã: {loi}",
    vatTu_daTaoChoTau:
      'Đã tạo {ma} — "{ten}", giữ bởi {chucDanh} ({maChucDanh}), đã thêm vào danh mục {tau}.',
    vatTu_khoiMaDaKin:
      "Khối mã của nhóm đã kín nên mã xếp tạm cuối dãy — khi tiện, chạy doi-ma-vat-tu.cmd --theo-nhom để xếp lại.",
    nhomThietBi_khongTonTai: "Nhóm thiết bị không tồn tại.",

    // Kho / nhập xuất
    kho_loaiGiaoDichKhongHopLe: "Loại giao dịch không hợp lệ.",
    kho_duLieuNhapXuatKhongHopLe: "Dữ liệu nhập/xuất không hợp lệ.",
    kho_thoiDiemKhongHopLe: "Thời điểm thực hiện không hợp lệ.",
    kho_thoiDiemTuongLai: "Thời điểm thực hiện không được ở tương lai.",
    kho_khongHopLeHoacKhongThuocTau: "Kho không hợp lệ hoặc không thuộc tàu.",
    kho_chiTauMinhPhuTrach:
      "Bạn chỉ được nhập/xuất kho của tàu mình phụ trách.",
    kho_khongDuTon: "Không đủ tồn kho để xuất.",
    kho_daGhiNhanGiaoDich: "Đã ghi nhận giao dịch nhập/xuất kho.",
    kho_khongHopLe: "Kho không hợp lệ.",
    kho_khongThuocTauDaChon: "Kho không thuộc tàu đã chọn.",
    kho_khongTuDinhTuyenDuoc:
      "Tàu này chưa có kho nào có mã kết thúc bằng -ENG / -DECK / -STORE nên không tự định tuyến được. Hãy chọn một kho cụ thể.",
    kho_nhanKhongThuocTauCuaDon: "Kho nhận không thuộc tàu của đơn.",
    kho_vuiLongChonKhoNhan:
      "Vui lòng chọn kho nhận cho vật tư có trong danh mục.",

    // Yêu cầu vật tư
    yeuCau_khongHopLe: "Yêu cầu không hợp lệ.",
    yeuCau_khongTimThay: "Không tìm thấy yêu cầu.",
    yeuCau_conLaNhap:
      "Yêu cầu còn ở trạng thái Nháp. Người lập cần bấm “Trình duyệt” trước khi phê duyệt.",
    yeuCau_daDuocXuLy: "Yêu cầu đã được xử lý, vui lòng tải lại trang.",
    yeuCau_buocCuaCongTy: "Tàu đã duyệt, bước này thuộc quản lý kỹ thuật công ty.",
    yeuCau_tuLapTuDuyet:
      "Bạn là người lập yêu cầu này nên không tự duyệt được. Yêu cầu của máy trưởng do thuyền trưởng duyệt ở cấp tàu.",
    yeuCau_phaiQuaFormDuyet:
      "Bước duyệt phải qua form phê duyệt (có số lượng duyệt), không chuyển trạng thái trực tiếp.",
    yeuCau_trangThaiGiaoTuDong:
      "Trạng thái giao hàng do phiếu nhận của đơn mua tự cập nhật, không đặt tay.",
    yeuCau_trangThaiKhongHopLe: "Trạng thái yêu cầu không hợp lệ.",
    yeuCau_thieuLyDoTuChoi: "Vui lòng nhập lý do từ chối.",
    yeuCau_choCongTyDuyetMoiTuChoi:
      "Yêu cầu đang chờ công ty duyệt — chỉ quản lý kỹ thuật mới từ chối được ở bước này.",
    yeuCau_khongChuyenDuocTrangThai:
      'Không chuyển được từ "{tu}" sang "{den}". Có thể người khác vừa xử lý — hãy tải lại trang.',
    yeuCau_daXoaHoacKhongTonTai: "Yêu cầu đã bị xóa hoặc không tồn tại.",
    yeuCau_chiQuanTriXoaDuoc:
      "Yêu cầu đã được duyệt/chuyển mua sắm nên chỉ quản trị viên mới xóa được.",
    yeuCau_daBiXoa: "Yêu cầu đã bị xóa.",

    // Biểu mẫu chứng từ
    bieuMau_khongHopLe: "Biểu mẫu không hợp lệ.",
    bieuMau_maTenDiaChiBatBuoc: "Mã, tên công ty và địa chỉ là bắt buộc.",
    bieuMau_maDaTonTai: 'Mã biểu mẫu "{ma}" đã tồn tại.',
    bieuMau_daThem: 'Đã thêm biểu mẫu "{ma}".',
    bieuMau_khongTimThay: "Không tìm thấy biểu mẫu.",
    bieuMau_daCapNhat: "Đã cập nhật biểu mẫu.",
    bieuMau_conTauDangDung:
      "Còn {n} tàu đang dùng biểu mẫu này. Hãy chuyển các tàu sang biểu mẫu khác trước.",
    bieuMau_conTauDangDungKhongXoaDuoc:
      'Còn {n} tàu đang dùng biểu mẫu "{ma}" nên không thể xóa. Hãy chuyển các tàu sang biểu mẫu khác trước.',

    // Nhà cung cấp
    ncc_maVaTenBatBuoc: "Mã và tên nhà cung cấp là bắt buộc.",
    ncc_maDaTonTai: 'Mã nhà cung cấp "{ma}" đã tồn tại.',
    ncc_daThem: 'Đã thêm nhà cung cấp "{ten}".',
    ncc_khongTimThay: "Không tìm thấy nhà cung cấp.",
    ncc_daCapNhat: "Đã cập nhật nhà cung cấp.",
    ncc_khongHopLe: "Nhà cung cấp không hợp lệ.",
    ncc_daCoDonMua:
      'Nhà cung cấp đã có {n} đơn mua nên không thể xóa (để giữ lịch sử). Hãy dùng "Ngừng dùng".',

    // Nhập danh mục từ file
    danhMuc_chiTauMinhPhuTrach:
      "Bạn chỉ được nhập danh mục cho tàu mình phụ trách.",
    nhap_vuiLongChonFile:
      "Vui lòng chọn file danh mục (.xls/.xlsx/.doc/.docx).",
    nhap_fileSaiDinhDang:
      "File phải là Excel (.xls/.xlsx) hoặc Word (.doc/.docx).",
    nhap_fileQua10MB: "File vượt quá 10MB.",
    nhap_trungMaDoDongThoi:
      "Có phiên nhập liệu khác chạy đồng thời nên mã tự sinh bị trùng. Vui lòng bấm nhập lại.",
    nhap_daNhapDong: "Đã nhập {n} dòng cho tàu {tau}:",
    nhap_vatTuMoi: "{n} vật tư mới",
    nhap_vatTuDaCo: "{n} vật tư đã có (gán vào tàu)",
    nhap_dongGhiTon: "{n} dòng ghi tồn kho",
    nhap_dongBoQua: "{n} dòng bị bỏ qua",
    nhap_khoiMaDaKin:
      "Khuôn {khuon} đã kín khối nên mã mới xếp vào cuối dãy — chạy doi-ma-vat-tu.cmd --theo-nhom --dong-y để xếp lại theo nhóm.",
    nhap_sheetDaDoc: "Sheet đã đọc: {ds}",
    nhap_sheetMoTa: "{ten} ({n} dòng, {loai})",
    nhap_sheetMoTaKhongLoai: "{ten} ({n} dòng)",
    nhap_sheetBoQua: "Sheet không có bảng danh mục nên bỏ qua: {ds}",
    nhap_vuotGioiHan3000:
      "⚠ File vượt quá giới hạn 3000 dòng — phần còn lại chưa được nhập, hãy tách file nhỏ hơn",

    // Mua sắm / đơn mua
    muaSam_chiTauMinhPhuTrach: "Bạn chỉ được mua sắm cho tàu mình phụ trách.",
    donMua_fileExcelSaiDinhDang:
      "File vật tư phải là Excel (.xls hoặc .xlsx).",
    donMua_fileExcelQua10MB: "File Excel vượt quá 10MB.",
    donMua_dongNhapTayThieuMoTa: "Dòng nhập tay thứ {stt} thiếu mô tả vật tư.",
    donMua_dongSoLuongKhongHopLe:
      'Dòng "{moTa}" có số lượng không hợp lệ.',
    donMua_chuaCoDongNao:
      "Chưa có dòng vật tư nào — hãy upload file Excel theo form công ty hoặc nhập tay ít nhất một dòng.",
    donMua_toiDa200Dong: "Tối đa 200 dòng vật tư mỗi đơn.",
    donMua_chonItNhatMotDong: "Vui lòng chọn ít nhất một dòng vật tư để mua.",
    donMua_khongCoDongHopLe:
      "Không có dòng hợp lệ (yêu cầu phải đang ở trạng thái mua sắm hoặc giao một phần).",
    donMua_daDatDu:
      '"{ten}" đã đặt đủ {sl} {dvt} nên không còn gì để đặt',
    donMua_vuotConLai:
      '"{ten}" đặt {dat} {dvt} trong khi chỉ còn được đặt {conLai} {dvt} (duyệt {duyet}, đã đặt {daDat}) — vượt {vuot} {dvt}',
    donMua_vuotSoDuyet: "Số lượng đặt mua vượt số đã duyệt — {chiTiet}.",
    donMua_khongTimThay: "Không tìm thấy đơn mua.",
    donMua_daDoiTrangThai: "Đơn đã đổi trạng thái, vui lòng tải lại trang.",
    donMua_chiNhanKhiDaGui:
      "Chỉ nhận hàng khi đơn đã gửi/xác nhận. Vui lòng tải lại trang.",
    donMua_chuaNhapSoLuongNhan: "Chưa nhập số lượng nhận cho dòng nào.",
    donMua_daNhanDu: "Các dòng đã nhận đủ, không còn gì để nhận.",
    donMua_daGhiNhanNhanHang: "Đã ghi nhận nhận hàng.",
    donMua_chiQuanTriXoaDuoc: "Chỉ quản trị viên mới xóa được đơn mua.",
    donMua_daXoaHoacKhongTonTai: "Đơn mua đã bị xóa hoặc không tồn tại.",
    donMua_chiXoaDonDaHuy:
      "Chỉ xóa được đơn ĐÃ HỦY. Đơn đang xử lý thì hãy bấm Hủy trước, để giữ vết là nó từng tồn tại.",
    donMua_daNhanHangKhongXoaDuoc:
      "Không xóa được: đơn này đã nhận {n} đơn vị hàng, xóa đi sẽ mất căn cứ của số tồn kho đã ghi.",
    donMua_daXoa: "Đã xóa đơn {ma}.",

    // Chằng buộc
    baoCao_chiTauMinhPhuTrach:
      "Bạn chỉ được lập báo cáo cho tàu mình phụ trách.",
    baoCao_ngayKhongHopLe: "Ngày báo cáo không hợp lệ.",
    changBuoc_chuaCoDanhMuc: "Tàu chưa có danh mục dụng cụ chằng buộc.",
    changBuoc_danhMucVuaDoi:
      "Danh mục dụng cụ vừa thay đổi. Vui lòng tải lại trang và nhập lại số liệu.",
    changBuoc_khongTimThayDungCu: "Không tìm thấy dụng cụ.",
    changBuoc_tenDaTonTai: 'Tên dụng cụ "{ten}" đã tồn tại trên tàu này.',
    changBuoc_tenBatBuoc: "Tên dụng cụ là bắt buộc.",
    changBuoc_daThem: 'Đã thêm dụng cụ "{ten}".',
    changBuoc_daCoTrongBaoCao:
      "Dụng cụ đã xuất hiện trong báo cáo cũ nên không thể xóa (bảo toàn lịch sử).",

    // Hồ sơ / báo cáo tải lên
    hoSo_chuaGanTau: "Bạn chưa được gán tàu nên chưa thể tải báo cáo lên.",
    hoSo_chiTauMinhPhuTrach:
      "Bạn chỉ được tải báo cáo cho tàu mình phụ trách.",
    hoSo_loaiBaoCaoKhongHopLe: "Loại báo cáo không hợp lệ.",
    hoSo_vuiLongChonFile: "Vui lòng chọn file báo cáo.",
    hoSo_dinhDangKhongHoTro:
      "Chỉ chấp nhận file PDF hoặc Excel (.pdf, .xls, .xlsx).",
    hoSo_fileQua20MB: "File vượt quá giới hạn 20MB.",
    hoSo_daLuuFile:
      'Đã lưu "{ten}" vào hồ sơ {tau}. Mã toàn vẹn SHA-256: {bam}…',
    hoSo_khongTimThay: "Không tìm thấy hồ sơ.",

    // Tài khoản người dùng
    taiKhoan_tenEmailMatKhauBatBuoc: "Tên, email và mật khẩu là bắt buộc.",
    taiKhoan_emailKhongHopLe: "Email không hợp lệ.",
    taiKhoan_matKhauToiThieu8: "Mật khẩu phải có ít nhất 8 ký tự.",
    taiKhoan_vaiTroKhongHopLe: "Vai trò không hợp lệ.",
    taiKhoan_emailDaDung: 'Email "{email}" đã được sử dụng.',
    taiKhoan_daTao: 'Đã tạo người dùng "{email}".',
    taiKhoan_khongTuDoiQuyen: "Không thể tự thay đổi quyền của chính mình.",
    taiKhoan_khongTimThay: "Không tìm thấy người dùng.",
    taiKhoan_khongTuKhoa: "Không thể tự khóa tài khoản của chính mình.",
    taiKhoan_khongTuXoa:
      "Không thể tự xóa tài khoản của chính mình. Nhờ một quản trị khác xóa hộ.",
    taiKhoan_daTaiFileKhongXoaDuoc:
      "Tài khoản này đã tải lên {n} file báo cáo. File là bản lưu bất biến và phải giữ được vết ai đã nộp, nên không xóa tài khoản được — hãy KHÓA tài khoản thay vì xóa.",
    taiKhoan_conDuLieuLienQuan:
      "Tài khoản đang gắn với dữ liệu khác nên không xóa được. Hãy khóa tài khoản thay vì xóa.",
    taiKhoan_daXoa: 'Đã xóa tài khoản "{email}".',
    taiKhoan_chucDanhKhongCoTrongQuyUoc:
      'Chức danh giữ vật tư "{ma}" không có trong quy ước.',
  },
  {
    daLuu: "Saved.",
    daLuuThayDoi: "Changes saved.",
    daLuuTen: 'Saved "{ten}".',
    soLuongKhongHopLe: "Invalid quantity.",
    vuiLongChonTau: "Please select a vessel.",
    vuiLongChonNcc: "Please select a supplier.",

    giaoDich_heThongBan:
      "The system is busy with another operation on the same data. Please try again in a few seconds.",
    giaoDich_ghiTrung:
      "Someone has just saved a duplicate record. Please reload the page and try again.",

    dangNhap_thieuEmailMatKhau: "Please enter your email and password.",
    dangNhap_tamKhoa:
      "Too many failed attempts. Please wait {phut} minutes and try again.",
    dangNhap_saiThongTin: "Incorrect email or password.",
    dangNhap_thieuSessionSecret:
      "The server has no SESSION_SECRET configured, so a login session cannot be created. Please contact the system administrator.",

    tau_maVaTenBatBuoc: "Vessel code and vessel name are required.",
    tau_maDaTonTai: 'Vessel code "{ma}" already exists.',
    tau_daThem: 'Vessel "{ten}" added.',
    tau_khongTimThay: "Vessel not found.",
    tau_khongTonTai: "The vessel does not exist.",
    tau_khongHopLe: "Invalid vessel.",
    tau_trangThaiKhongHopLe: "Invalid vessel status.",
    tau_daLuuVaDoiTenKho:
      "Changes saved, and {n} warehouses were renamed after the new vessel name.",
    tau_conYeuCauKhongXoaDuoc:
      'This vessel has {n} material requisitions, so it cannot be deleted. Set its status to "Out of service" instead of deleting it.',
    tau_conNguoiDungKhongXoaDuoc:
      "This vessel has {n} users assigned to it. Unassign them or move them to another vessel on the Users page before deleting it.",
    tau_conDuLieuLienQuan:
      "This vessel still has related data (material requisitions), so it cannot be deleted.",
    tau_hoMayChinhKhongCoTrongQuyUoc:
      'Main engine family "{nhom}" is not in the naming convention.',
    tauPhuTrach_khongHopLe: "The assigned vessel is not valid.",
    tauPhuTrach_khongTonTai: "The assigned vessel does not exist.",

    vatTu_maVaTenBatBuoc: "Item code and item name are required.",
    vatTu_maDaTonTai: 'Item code "{ma}" already exists.',
    vatTu_daThem: 'Item "{ten}" added.',
    vatTu_khongTimThay: "Item not found.",
    vatTu_khongTonTai: "The item does not exist.",
    vatTu_daBiXoa: "The item has already been deleted.",
    vatTu_daXoaHoacKhongTonTai: "The item has been deleted or does not exist.",
    vatTu_daDungTrongYeuCau:
      "This item is already used in a material requisition, so it cannot be deleted. Choose Deactivate to keep the history.",
    vatTu_dangCoTonKho:
      "This item still has stock records on board, so it cannot be deleted (that would lose stock figures). Choose Deactivate instead.",
    vatTu_dangDuocThamChieu:
      "This item is referenced elsewhere, so it cannot be deleted. Choose Deactivate instead.",
    vatTu_loaiKhongHopLe: "Invalid item type.",
    vatTu_tonToiThieuKhongHopLe: "Invalid minimum stock.",
    vatTu_tonToiDaKhongHopLe: "Invalid maximum stock.",
    vatTu_maDaCoOVatTuKhac: 'Item code "{ma}" already belongs to another item.',
    vatTu_khongCapDuocMa: "Could not issue a code: {loi}",
    vatTu_daTaoChoTau:
      'Created {ma} — "{ten}", held by {chucDanh} ({maChucDanh}), added to the catalogue of {tau}.',
    vatTu_khoiMaDaKin:
      "The code block for this group is full, so the code was parked at the end of the sequence — when convenient, run doi-ma-vat-tu.cmd --theo-nhom to reorder it.",
    nhomThietBi_khongTonTai: "The equipment group does not exist.",

    kho_loaiGiaoDichKhongHopLe: "Invalid transaction type.",
    kho_duLieuNhapXuatKhongHopLe: "Invalid receipt/issue data.",
    kho_thoiDiemKhongHopLe: "Invalid time of the movement.",
    kho_thoiDiemTuongLai: "The time of the movement cannot be in the future.",
    kho_khongHopLeHoacKhongThuocTau:
      "The warehouse is not valid or does not belong to a vessel.",
    kho_chiTauMinhPhuTrach:
      "You may only receive into or issue from the warehouses of your own vessel.",
    kho_khongDuTon: "There is not enough stock to issue.",
    kho_daGhiNhanGiaoDich: "The stock receipt/issue has been recorded.",
    kho_khongHopLe: "Invalid warehouse.",
    kho_khongThuocTauDaChon:
      "The warehouse does not belong to the selected vessel.",
    kho_khongTuDinhTuyenDuoc:
      "This vessel has no warehouse whose code ends in -ENG / -DECK / -STORE, so automatic routing is not possible. Please pick a specific warehouse.",
    kho_nhanKhongThuocTauCuaDon:
      "The receiving warehouse does not belong to the vessel of this order.",
    kho_vuiLongChonKhoNhan:
      "Please select a receiving warehouse for the items in the catalogue.",

    yeuCau_khongHopLe: "Invalid requisition.",
    yeuCau_khongTimThay: "Requisition not found.",
    yeuCau_conLaNhap:
      "The requisition is still a draft. The originator must click “Submit for approval” before it can be approved.",
    yeuCau_daDuocXuLy:
      "The requisition has already been handled, please reload the page.",
    yeuCau_buocCuaCongTy:
      "The vessel has approved it; this step belongs to the office technical manager.",
    yeuCau_tuLapTuDuyet:
      "You raised this requisition, so you cannot approve it yourself. A chief engineer's requisition is approved by the master at vessel level.",
    yeuCau_phaiQuaFormDuyet:
      "Approval must go through the approval form (with approved quantities), not a direct status change.",
    yeuCau_trangThaiGiaoTuDong:
      "The delivery status is updated automatically by the goods receipt of the purchase order; it cannot be set by hand.",
    yeuCau_trangThaiKhongHopLe: "Invalid requisition status.",
    yeuCau_thieuLyDoTuChoi: "Please enter a reason for the rejection.",
    yeuCau_choCongTyDuyetMoiTuChoi:
      "This requisition is awaiting office approval — only the technical manager can reject it at this step.",
    yeuCau_khongChuyenDuocTrangThai:
      'Could not move from "{tu}" to "{den}". Someone else may have just handled it — please reload the page.',
    yeuCau_daXoaHoacKhongTonTai:
      "The requisition has been deleted or does not exist.",
    yeuCau_chiQuanTriXoaDuoc:
      "This requisition has been approved or moved to purchasing, so only an administrator can delete it.",
    yeuCau_daBiXoa: "The requisition has already been deleted.",

    bieuMau_khongHopLe: "Invalid form standard.",
    bieuMau_maTenDiaChiBatBuoc:
      "Code, company name and address are required.",
    bieuMau_maDaTonTai: 'Form standard code "{ma}" already exists.',
    bieuMau_daThem: 'Form standard "{ma}" added.',
    bieuMau_khongTimThay: "Form standard not found.",
    bieuMau_daCapNhat: "The form standard has been updated.",
    bieuMau_conTauDangDung:
      "{n} vessels still use this form standard. Move them to another form standard first.",
    bieuMau_conTauDangDungKhongXoaDuoc:
      '{n} vessels still use form standard "{ma}", so it cannot be deleted. Move them to another form standard first.',

    ncc_maVaTenBatBuoc: "Supplier code and name are required.",
    ncc_maDaTonTai: 'Supplier code "{ma}" already exists.',
    ncc_daThem: 'Supplier "{ten}" added.',
    ncc_khongTimThay: "Supplier not found.",
    ncc_daCapNhat: "The supplier has been updated.",
    ncc_khongHopLe: "Invalid supplier.",
    ncc_daCoDonMua:
      'This supplier already has {n} purchase orders, so it cannot be deleted (to keep the history). Use "Deactivate" instead.',

    danhMuc_chiTauMinhPhuTrach:
      "You may only import a catalogue for your own vessel.",
    nhap_vuiLongChonFile:
      "Please choose a catalogue file (.xls/.xlsx/.doc/.docx).",
    nhap_fileSaiDinhDang:
      "The file must be Excel (.xls/.xlsx) or Word (.doc/.docx).",
    nhap_fileQua10MB: "The file is larger than 10MB.",
    nhap_trungMaDoDongThoi:
      "Another import was running at the same time, so an auto-generated code collided. Please click import again.",
    nhap_daNhapDong: "Imported {n} lines for vessel {tau}:",
    nhap_vatTuMoi: "{n} new items",
    nhap_vatTuDaCo: "{n} existing items (linked to the vessel)",
    nhap_dongGhiTon: "{n} lines booked into stock",
    nhap_dongBoQua: "{n} lines skipped",
    nhap_khoiMaDaKin:
      "Pattern {khuon} has a full code block, so new codes go to the end of the sequence — run doi-ma-vat-tu.cmd --theo-nhom --dong-y to reorder them by group.",
    nhap_sheetDaDoc: "Sheets read: {ds}",
    nhap_sheetMoTa: "{ten} ({n} lines, {loai})",
    nhap_sheetMoTaKhongLoai: "{ten} ({n} lines)",
    nhap_sheetBoQua: "Sheets skipped because they hold no catalogue table: {ds}",
    nhap_vuotGioiHan3000:
      "⚠ The file exceeds the 3000-line limit — the rest was not imported, please split it into smaller files",

    muaSam_chiTauMinhPhuTrach: "You may only buy for your own vessel.",
    donMua_fileExcelSaiDinhDang:
      "The item file must be Excel (.xls or .xlsx).",
    donMua_fileExcelQua10MB: "The Excel file is larger than 10MB.",
    donMua_dongNhapTayThieuMoTa:
      "Manual line {stt} has no item description.",
    donMua_dongSoLuongKhongHopLe: 'Line "{moTa}" has an invalid quantity.',
    donMua_chuaCoDongNao:
      "There are no item lines yet — upload an Excel file in the company format, or type in at least one line.",
    donMua_toiDa200Dong: "At most 200 item lines per order.",
    donMua_chonItNhatMotDong: "Please select at least one line to order.",
    donMua_khongCoDongHopLe:
      "No valid lines (the requisition must be in procurement or partially delivered).",
    donMua_daDatDu:
      '"{ten}" already has the full {sl} {dvt} on order, so there is nothing left to order',
    donMua_vuotConLai:
      '"{ten}" is ordered at {dat} {dvt} while only {conLai} {dvt} may still be ordered (approved {duyet}, already ordered {daDat}) — {vuot} {dvt} over',
    donMua_vuotSoDuyet:
      "The ordered quantity exceeds the approved quantity — {chiTiet}.",
    donMua_khongTimThay: "Purchase order not found.",
    donMua_daDoiTrangThai:
      "The order status has changed, please reload the page.",
    donMua_chiNhanKhiDaGui:
      "Goods can only be received once the order has been sent or confirmed. Please reload the page.",
    donMua_chuaNhapSoLuongNhan:
      "No received quantity has been entered on any line.",
    donMua_daNhanDu:
      "Every line has been fully received; there is nothing left to receive.",
    donMua_daGhiNhanNhanHang: "The goods receipt has been recorded.",
    donMua_chiQuanTriXoaDuoc:
      "Only an administrator can delete a purchase order.",
    donMua_daXoaHoacKhongTonTai:
      "The purchase order has been deleted or does not exist.",
    donMua_chiXoaDonDaHuy:
      "Only CANCELLED orders can be deleted. For an order still in progress, cancel it first so the record that it existed is kept.",
    donMua_daNhanHangKhongXoaDuoc:
      "Cannot delete: {n} units have already been received on this order, and deleting it would remove the basis of the stock already booked.",
    donMua_daXoa: "Purchase order {ma} deleted.",

    baoCao_chiTauMinhPhuTrach:
      "You may only raise a report for your own vessel.",
    baoCao_ngayKhongHopLe: "Invalid report date.",
    changBuoc_chuaCoDanhMuc:
      "This vessel has no lashing gear catalogue yet.",
    changBuoc_danhMucVuaDoi:
      "The gear catalogue has just changed. Please reload the page and enter the figures again.",
    changBuoc_khongTimThayDungCu: "Lashing gear not found.",
    changBuoc_tenDaTonTai:
      'Gear named "{ten}" already exists on this vessel.',
    changBuoc_tenBatBuoc: "The gear name is required.",
    changBuoc_daThem: 'Gear "{ten}" added.',
    changBuoc_daCoTrongBaoCao:
      "This gear already appears in earlier reports, so it cannot be deleted (to preserve the history).",

    hoSo_chuaGanTau:
      "You have not been assigned to a vessel, so you cannot upload reports yet.",
    hoSo_chiTauMinhPhuTrach:
      "You may only upload reports for your own vessel.",
    hoSo_loaiBaoCaoKhongHopLe: "Invalid report type.",
    hoSo_vuiLongChonFile: "Please choose a report file.",
    hoSo_dinhDangKhongHoTro:
      "Only PDF or Excel files are accepted (.pdf, .xls, .xlsx).",
    hoSo_fileQua20MB: "The file exceeds the 20MB limit.",
    hoSo_daLuuFile:
      'Saved "{ten}" to the records of {tau}. SHA-256 integrity digest: {bam}…',
    hoSo_khongTimThay: "Document not found.",

    taiKhoan_tenEmailMatKhauBatBuoc:
      "Name, email and password are required.",
    taiKhoan_emailKhongHopLe: "Invalid email address.",
    taiKhoan_matKhauToiThieu8:
      "The password must be at least 8 characters long.",
    taiKhoan_vaiTroKhongHopLe: "Invalid role.",
    taiKhoan_emailDaDung: 'Email "{email}" is already in use.',
    taiKhoan_daTao: 'User "{email}" created.',
    taiKhoan_khongTuDoiQuyen: "You cannot change your own role.",
    taiKhoan_khongTimThay: "User not found.",
    taiKhoan_khongTuKhoa: "You cannot lock your own account.",
    taiKhoan_khongTuXoa:
      "You cannot delete your own account. Ask another administrator to do it.",
    taiKhoan_daTaiFileKhongXoaDuoc:
      "This account has uploaded {n} report files. Those files are an immutable record and must keep a trace of who submitted them, so the account cannot be deleted — LOCK the account instead.",
    taiKhoan_conDuLieuLienQuan:
      "This account is still linked to other data, so it cannot be deleted. Lock the account instead.",
    taiKhoan_daXoa: 'Account "{email}" deleted.',
    taiKhoan_chucDanhKhongCoTrongQuyUoc:
      'Material-holding rank "{ma}" is not in the naming convention.',
  }
);
