import { tuDien } from "./_kieu";

/** Yêu cầu vật tư (/requests, /requests/[id]) và các form của nó. */
export const requests = tuDien(
  {
    // Trang danh sách
    tieuDe: "Yêu cầu vật tư & phụ tùng",
    moTaDoi:
      "Tạo yêu cầu theo mẫu MLS-11-05B (vật tư) / MLS-11-05A (phụ tùng), duyệt và in",
    moTaTau: "Yêu cầu vật tư & phụ tùng của tàu bạn phụ trách",
    chuaGanTau:
      "Bạn chưa được gán tàu phụ trách nên chưa tạo được yêu cầu vật tư. Vui lòng liên hệ quản trị viên.",
    danhSach: "Danh sách yêu cầu ({n})",
    moiTrangThai: "Mọi trạng thái",
    cotSoYeuCau: "Số yêu cầu",
    cotLoai: "Loại",
    nguoiYeuCau: "Người yêu cầu",
    cotLapLuc: "Lập lúc",
    cotBoPhan: "Bộ phận",
    cotUuTien: "Ưu tiên",
    cotNoiDung: "Nội dung",
    moi: "(mới)",
    nutXemIn: "Xem / In",
    nutTrinh: "Trình duyệt",
    nutTrinhLai: "Trình lại",
    nutTauDuyet: "Tàu duyệt",
    nutCongTyDuyet: "Công ty duyệt",
    nutChuyenMuaSam: "Chuyển mua sắm",
    chuaCoYeuCau: "Chưa có yêu cầu nào",

    // Trang chi tiết (phần ngoài biểu mẫu in)
    quayLaiDanhSach: "Quay lại danh sách yêu cầu",
    tienDoDuyet: "Tiến độ phê duyệt",
    buocTrinh: "Người lập trình duyệt",
    buocTauDuyet: "Tàu duyệt (thuyền trưởng / máy trưởng)",
    buocCongTyDuyet: "Công ty duyệt (quản lý kỹ thuật)",
    chuaXong: "chưa",
    dangChoDuyetBoi: "Đang chờ duyệt bởi",
    nguoiDuyetTau: "{ai} (hoặc thuyền trưởng)",
    viSaoSiQuan: "Yêu cầu phải do thuyền trưởng hoặc máy trưởng duyệt.",
    viSaoMayTruong:
      "Máy trưởng chỉ duyệt yêu cầu bộ phận Máy/Điện. Yêu cầu này thuộc bộ phận khác nên thuyền trưởng duyệt.",
    viSaoQuanLyKyThuat:
      "Quản lý kỹ thuật duyệt ở bước công ty, sau khi tàu đã duyệt.",
    trinhLaiMoTa: "Yêu cầu đã bị từ chối. Sửa lại rồi trình lại lên",
    nhapTruoc: "Yêu cầu đang là",
    nhapGiua:
      "— vẫn sửa/xóa được và chưa ai duyệt được. Trình lên để chuyển sang",
    nhapCuoi: ", người duyệt là",
    yeuCauBiTuChoi: "Yêu cầu bị từ chối",
    duyetCapTau: "Duyệt cấp tàu",
    duyetCapCongTy: "Duyệt cấp công ty (quản lý kỹ thuật)",
    duyetCapTauMoTa:
      "Duyệt xong yêu cầu sẽ chuyển tiếp lên quản lý kỹ thuật công ty.",
    duyetCapCongTyMoTa:
      "Đây là bước duyệt cuối. Duyệt xong yêu cầu sẵn sàng chuyển sang mua sắm.",
    nhatKyDuyet: "Nhật ký phê duyệt",
    chuaCoMocNgan: "Chưa có mốc nào",
    chuaCoMoc:
      "Chưa có mốc nào được ghi. Các yêu cầu lập trước khi bật nhật ký sẽ không có lịch sử.",
    tuTrangThai: "từ",
    chuyenMuaSamMoTa:
      "Yêu cầu đã được duyệt đủ hai cấp. Chuyển sang mua sắm để phòng vật tư lập đơn mua.",

    // Form tạo yêu cầu
    taoYeuCauVatTu: "Tạo yêu cầu vật tư (MLS-11-05B)",
    taoYeuCauPhuTung: "Tạo yêu cầu phụ tùng (MLS-11-05A)",
    nutLoaiVatTu: "Yêu cầu vật tư",
    nutLoaiPhuTung: "Yêu cầu phụ tùng",
    phMucDich: "Mục đích / lý do yêu cầu",
    phHangSanXuat: "Hãng sản xuất / Maker",
    phSoMay: "Số máy / Serial (Engine) No.",
    coSan: "Có sẵn",
    moiNgoaiDanhMuc: "Mới (ngoài danh mục)",
    dongThu: "Dòng {n}",
    xoaDong: "Xóa dòng",
    chonVatTu: "Chọn vật tư",
    chonPhuTung: "Chọn phụ tùng",
    slYeuCau: "SL yêu cầu",
    phTenVatTuMoi: "Tên / mô tả vật tư mới",
    phTenPhuTungMoi: "Tên phụ tùng mới",
    maImpa: "Mã IMPA",
    phDvt: "ĐVT (PCS...)",
    chuaCoVatTuCoSan:
      "Danh mục chưa có vật tư có sẵn nào — bạn vẫn có thể chọn “Mới (ngoài danh mục)” để nhập tay.",
    chuaCoPhuTungCoSan:
      "Danh mục chưa có phụ tùng có sẵn nào — bạn vẫn có thể chọn “Mới (ngoài danh mục)” để nhập tay.",
    themDong: "Thêm dòng",
    nutTaoYeuCau: "Tạo yêu cầu",
    canChonTau: "Vui lòng chọn tàu.",
    canMotDong: "Vui lòng chọn ít nhất một dòng.",
    coLoi: "Có lỗi xảy ra.",
    taoVatTuThanhCong: "Tạo yêu cầu vật tư thành công.",
    taoPhuTungThanhCong: "Tạo yêu cầu phụ tùng thành công.",

    // Form duyệt số lượng
    huongDanDuyetTau:
      "Nhập số lượng duyệt (S.L Duyệt) cho từng dòng rồi bấm Duyệt. Mặc định bằng số lượng yêu cầu, có thể giảm bớt.",
    huongDanDuyetCongTy:
      "Nhập số lượng công ty duyệt cho từng dòng. Mặc định bằng số tàu đã duyệt, có thể giảm bớt chứ không tăng.",
    cotRob: "Tồn (ROB)",
    slTauDuyet: "Tàu duyệt",
    slCongTyDuyet: "Công ty duyệt",
    slDuyet: "SL duyệt",
    dangDuyet: "Đang duyệt...",
    nutTauDuyetVaChuyen: "Tàu duyệt & chuyển lên công ty",

    // Form từ chối
    nutTuChoi: "Từ chối",
    lyDoTuChoi: "Lý do từ chối *",
    phLyDoTuChoi:
      "VD: Vật tư còn đủ trên tàu, đề nghị dùng hết trước khi đặt thêm",
    dangGui: "Đang gửi...",
    xacNhanTuChoi: "Xác nhận từ chối",

    // Nút xóa
    xacNhanXoa:
      "Xóa yêu cầu “{ma}”? Toàn bộ dòng vật tư trong yêu cầu sẽ bị xóa theo. Hành động này không hoàn tác được.",
    dangXoa: "Đang xóa...",
  },
  {
    tieuDe: "Stores & spare parts requisitions",
    moTaDoi:
      "Raise requisitions on forms MLS-11-05B (stores) / MLS-11-05A (spare parts), approve and print",
    moTaTau: "Stores & spare parts requisitions for the vessels you cover",
    chuaGanTau:
      "You have not been assigned to a vessel, so you cannot raise requisitions yet. Please contact the administrator.",
    danhSach: "Requisitions ({n})",
    moiTrangThai: "All statuses",
    cotSoYeuCau: "Req. No.",
    cotLoai: "Type",
    nguoiYeuCau: "Requested by",
    cotLapLuc: "Created",
    cotBoPhan: "Dept.",
    cotUuTien: "Priority",
    cotNoiDung: "Items",
    moi: "(new)",
    nutXemIn: "View / Print",
    nutTrinh: "Submit for approval",
    nutTrinhLai: "Resubmit",
    nutTauDuyet: "Vessel approval",
    nutCongTyDuyet: "Office approval",
    nutChuyenMuaSam: "Move to purchasing",
    chuaCoYeuCau: "No requisitions yet",

    quayLaiDanhSach: "Back to requisitions",
    tienDoDuyet: "Approval progress",
    buocTrinh: "Submitted by the originator",
    buocTauDuyet: "Vessel approval (Master / Chief Engineer)",
    buocCongTyDuyet: "Office approval (Technical Manager)",
    chuaXong: "pending",
    dangChoDuyetBoi: "Awaiting approval from",
    nguoiDuyetTau: "{ai} (or the Master)",
    viSaoSiQuan:
      "This requisition must be approved by the Master or the Chief Engineer.",
    viSaoMayTruong:
      "The Chief Engineer only approves Engine/Electrical requisitions. This one belongs to another department, so the Master approves it.",
    viSaoQuanLyKyThuat:
      "The Technical Manager approves at the office step, once the vessel has approved.",
    trinhLaiMoTa:
      "This requisition was rejected. Amend it and submit it again to",
    nhapTruoc: "This requisition is still a",
    nhapGiua:
      "— it can still be edited or deleted and nobody can approve it yet. Submit it to move it to",
    nhapCuoi: "; the approver is",
    yeuCauBiTuChoi: "Requisition rejected",
    duyetCapTau: "Vessel approval",
    duyetCapCongTy: "Office approval (Technical Manager)",
    duyetCapTauMoTa:
      "Once approved, the requisition goes on to the company Technical Manager.",
    duyetCapCongTyMoTa:
      "This is the final approval step. Once approved, the requisition is ready to move to purchasing.",
    nhatKyDuyet: "Approval log",
    chuaCoMocNgan: "No milestones yet",
    chuaCoMoc:
      "No milestones recorded yet. Requisitions raised before the log was switched on have no history.",
    tuTrangThai: "from",
    chuyenMuaSamMoTa:
      "Approved at both levels. Move it to purchasing so the supply department can raise a purchase order.",

    taoYeuCauVatTu: "New stores requisition (MLS-11-05B)",
    taoYeuCauPhuTung: "New spare parts requisition (MLS-11-05A)",
    nutLoaiVatTu: "Stores requisition",
    nutLoaiPhuTung: "Spare parts requisition",
    phMucDich: "Purpose / reason for the requisition",
    phHangSanXuat: "Maker",
    phSoMay: "Serial / Engine No.",
    coSan: "From catalogue",
    moiNgoaiDanhMuc: "New (not in catalogue)",
    dongThu: "Line {n}",
    xoaDong: "Remove line",
    chonVatTu: "Select a stores item",
    chonPhuTung: "Select a spare part",
    slYeuCau: "Qty required",
    phTenVatTuMoi: "Name / description of the new item",
    phTenPhuTungMoi: "Name of the new spare part",
    maImpa: "IMPA code",
    phDvt: "Unit (PCS...)",
    chuaCoVatTuCoSan:
      "The catalogue has no stores items yet — you can still pick “New (not in catalogue)” and type them in.",
    chuaCoPhuTungCoSan:
      "The catalogue has no spare parts yet — you can still pick “New (not in catalogue)” and type them in.",
    themDong: "Add line",
    nutTaoYeuCau: "Create requisition",
    canChonTau: "Please select a vessel.",
    canMotDong: "Please add at least one line.",
    coLoi: "Something went wrong.",
    taoVatTuThanhCong: "Stores requisition created.",
    taoPhuTungThanhCong: "Spare parts requisition created.",

    huongDanDuyetTau:
      "Enter the approved quantity for each line, then press approve. It defaults to the requested quantity and can only be reduced.",
    huongDanDuyetCongTy:
      "Enter the office approved quantity for each line. It defaults to the quantity the vessel approved and can be reduced but not increased.",
    cotRob: "ROB",
    slTauDuyet: "Vessel approved",
    slCongTyDuyet: "Office approved",
    slDuyet: "Approved qty",
    dangDuyet: "Approving...",
    nutTauDuyetVaChuyen: "Vessel approve & send to office",

    nutTuChoi: "Reject",
    lyDoTuChoi: "Reason for rejection *",
    phLyDoTuChoi:
      "e.g. there are still enough on board, please use them up before ordering more",
    dangGui: "Sending...",
    xacNhanTuChoi: "Confirm rejection",

    xacNhanXoa:
      "Delete requisition “{ma}”? Every line item in it will be deleted as well. This action cannot be undone.",
    dangXoa: "Deleting...",
  }
);
