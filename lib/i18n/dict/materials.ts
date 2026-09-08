import { tuDien } from "./_kieu";

/** Danh mục vật tư (/materials, /materials/import) và các form của nó. */
export const materials = tuDien(
  {
    // Trang danh mục
    tieuDe: "Danh mục vật tư & phụ tùng",
    danhMucRiengCua: "Danh mục riêng của {tau}",
    danhMucGocMoTa: "Danh mục gốc toàn đội (định nghĩa chung)",
    nutTonKhoKiemKe: "Tồn kho & xuất kiểm kê",
    nhapDanhMucTuFile: "Nhập danh mục từ file",
    xemTheo: "Xem theo",
    danhMucGocToanDoi: "Danh mục gốc (toàn đội)",
    optDanhMucGoc: "— Danh mục gốc —",
    tauLa: "Tàu: {tau}",
    chuaDuocGanTau: "Chưa được gán tàu",
    banLa: "Bạn là",
    phanBanQuanLy: "— phần vật tư & phụ tùng bạn quản lý:",
    dangXemPhanCuaBan: "Đang xem phần của bạn ({n} mặt hàng)",
    xemVatTuToiQuanLy: "Xem vật tư tôi quản lý",
    moiChucDanh: "Mọi chức danh",
    timGoiY: "Tìm tên, mã, IMPA, Part No, hãng...",
    chuaGanTauKhongXem:
      "Bạn chưa được gán tàu phụ trách nên chưa xem được danh mục. Vui lòng liên hệ quản trị viên.",
    themVaoDanhMucTau: "Thêm vật tư vào danh mục {tau}",
    vatTuLayTuGoc: "Vật tư lấy từ danh mục gốc toàn đội.",
    themVaoDanhMucGoc: "Thêm vật tư / phụ tùng (danh mục gốc)",
    vatTuCuaTau: "Vật tư của {tau} ({n})",
    danhMucGocN: "Danh mục gốc ({n})",
    tauChuaCoVatTu: "Tàu chưa có vật tư nào trong danh mục.",
    chuaCoVatTu: "Chưa có vật tư nào.",
    cotTenPhuTung: "Tên phụ tùng",
    cotGiuBoi: "Giữ bởi",
    loai: "Loại",
    suyRaTuThietBi:
      "Suy theo nhóm thiết bị — chạy gan-ma-vat-tu.cmd để gán cố định",
    suyRaTuBoPhan: "Suy theo bộ phận — chạy gan-ma-vat-tu.cmd để gán cố định",
    daGanTrucTiep: "Đã gán trực tiếp",
    dangHienDauMoiBoPhan: "Đang hiện {n} dòng đầu mỗi bộ phận — còn",
    nDong: "{n} dòng",
    chuaHienGoiY: "chưa hiện. Dùng ô tìm kiếm để lọc cho nhanh, hoặc",
    xemTatCaNDong: "xem tất cả {n} dòng",
    trangSeNangHon: "(trang sẽ nặng hơn).",

    // Trang nhập danh mục từ file
    quayLaiDanhMuc: "Quay lại danh mục vật tư",
    nhapMoTa:
      "Upload file kiểm kê / danh mục theo form công ty — vật tư & phụ tùng được tự động thêm vào danh mục của tàu đã chọn (kèm tồn kho nếu file có cột R.O.B), giúp kiểm soát nhanh toàn bộ vật tư đội tàu.",
    mauTieuDe: "Chưa có file danh mục? Tải file mẫu về cho tàu điền",
    mauCoSheet: "File mẫu có sẵn 5 sheet theo nhóm hàng —",
    mauSheetKhac: ", Vật tư máy, Vật tư boong, Phục vụ, Bảo hộ — kèm sheet",
    mauSheetHuongDan: "Hướng dẫn",
    mauGiaiThichCot:
      "giải thích từng cột. Tàu điền xong gửi về, tải thẳng file đó lên ở khung dưới là vào danh mục.",
    mauKhopSan: "Tên sheet và dòng tiêu đề đã khớp sẵn với bộ đọc, nên",
    mauDungDoiTen: "đừng đổi tên sheet hay sửa dòng tiêu đề",
    mauChiDienBenDuoi: "— chỉ điền từ dòng bên dưới xuống.",
    taiFileMau: "Tải file Excel mẫu",

    // Form thêm vào danh mục gốc (MaterialForm)
    loaiStoreMLS: "Vật tư (Store) — MLS-11-05B",
    loaiSpareMLS: "Phụ tùng (Spare part) — MLS-11-05A",
    phMaVatTu: "Mã vật tư",
    phTenVi: "Tên vật tư / phụ tùng (tiếng Việt)",
    phTenEn: "Tên tiếng Anh / Name of part",
    phThietBi: "Thiết bị / máy (Equipment)",
    phImpa: "Mã IMPA",
    phPartNo: "Số phụ tùng / Part No.",
    phMaker: "Nhà sản xuất / Maker",
    optChonNhom: "Chọn nhóm (Boong/Máy/Điện/...)",
    phDonVi: "Đơn vị tính: PCS, LIT, M...",
    tonToiThieu: "Tồn tối thiểu",
    tonToiDa: "Tồn tối đa",
    vatTuQuanTrong: "Vật tư quan trọng / critical",
    nutThemVatTu: "Thêm vật tư",

    // Sửa / ngừng dùng / xóa một dòng (MaterialRowActions)
    nutNgungDung: "Ngừng sử dụng",
    nutDungLai: "Dùng lại",
    xacNhanXoa:
      "Xóa vĩnh viễn vật tư {ma}? Chỉ xóa được khi chưa có tồn kho và chưa dùng trong yêu cầu nào.",
    suaVatTu: "Sửa vật tư",
    tenTiengViet: "Tên tiếng Việt",
    tenTiengAnh: "Tên tiếng Anh",
    chiDungChoPhuTung: "— chỉ dùng cho phụ tùng",
    impaSauChuSo: "IMPA — 6 chữ số",
    partNoMaNhaSanXuat: "Part No. — mã nhà sản xuất",
    optKhongThuocNhom: "— Không thuộc nhóm nào —",
    phuTungThietYeu:
      "Phụ tùng thiết yếu (Critical) — theo dõi riêng trên Dashboard",
    luuThayDoi: "Lưu thay đổi",

    // Danh mục riêng của tàu (VesselCatalogActions)
    optChonTuGoc: "Chọn vật tư từ danh mục gốc để thêm vào tàu",
    nutThemVaoTau: "Thêm vào tàu",
    tauDaCoDu: "Tàu đã có tất cả vật tư trong danh mục gốc.",
    xacNhanGo:
      "Gỡ \"{ma}\" khỏi danh mục tàu này? (Định nghĩa gốc và tồn kho không bị xóa.)",
    nutGoKhoiTau: "Gỡ khỏi tàu",

    // Khai mặt hàng mới ngay tại tàu (VatTuMoiChoTauForm)
    khaiMoiTieuDe: "Chưa có trong danh mục gốc? Khai mặt hàng mới cho {tau}",
    chucDanhGiuKiemKe: "Chức danh giữ & kiểm kê",
    optChonChucDanh: "— Chọn chức danh —",
    boPhanTheoChucDanh: "Bộ phận (theo chức danh)",
    kiemNhiem: "kiêm nhiệm",
    loaiStoreImpa: "Vật tư (Store) — IMPA",
    loaiSpareSpr: "Phụ tùng (Spare) — SPR",
    maTuDongTheoKhuon: "Mã sẽ được cấp tự động theo khuôn",
    maTuDongSoThuTu: ", số thứ tự xếp vào khối của nhóm thiết bị đã chọn.",
    tenMatHangVi: "Tên mặt hàng (tiếng Việt)",
    vdVoiPhun: "VD: Vòi phun nhiên liệu",
    vdGangTay: "VD: Găng tay da hàn",
    thietBiMay: "Thiết bị / máy",
    vdMayDen: "VD: Máy đèn số 2 — Yanmar 6N18",
    maImpaNeuCo: "Mã IMPA (nếu có)",
    phSauChuSo: "6 chữ số, VD 190411",
    makerHang: "Maker / hãng",
    nhomThietBi: "Nhóm thiết bị",
    optChuaXepNhom: "— Chưa xếp nhóm —",
    nhomThuongDo: "Nhóm này thường do",
    nhomThuongDoDuoi:
      "giữ — bạn đang chọn {ten}. Vẫn lưu được nếu đúng phân công trên tàu.",
    thietYeuCritical: "Phụ tùng / vật tư thiết yếu (critical)",
    nutKhaiMoi: "Khai mới & thêm vào tàu",

    // Nhập từ file (MaterialImportForm)
    loaiDuPhong: "Loại dự phòng (khi không đoán được từ tên sheet)",
    ghiTonVaoKho: "Ghi tồn (R.O.B) vào kho",
    chonTauTruoc: "Chọn tàu trước để hiện danh sách kho",
    tuDongTheoSheet:
      "Tự động theo sheet (Phụ tùng→kho máy, Boong→kho boong, còn lại→kho tiêu hao)",
    khongGhiTon: "— Không ghi tồn, chỉ nạp danh mục —",
    tauChuaCoKho:
      "Tàu này chưa có kho nào nên không ghi được tồn. Vào trang",
    duongDanTaoKho: "Đội tàu → chi tiết tàu",
    taoKhoTruoc:
      "để tạo kho trước, hoặc cứ nhập danh mục rồi ghi tồn sau.",
    robTruoc: "Cột",
    robTenCot: "Tồn trên tàu",
    robSau:
      "trong file sẽ được ghi vào kho tương ứng với từng sheet. Đây là cách dùng đúng cho file kiểm kê MLS-11-06.",
    fileDanhMuc: "File danh mục (.xls / .xlsx / .doc / .docx)",
    nhanFormCongTy: "Nhận trực tiếp form công ty:",
    moTaMLS1106:
      "Store & Spare Part Inventory (Excel — cột Nhóm/Mô tả/Mã IMPA/Đơn vị/Tồn trên tàu) và",
    moTaMLS1104:
      "Danh mục phụ tùng thiết yếu (Word — tự nhận nhóm thiết bị, số lượng tối thiểu). Vật tư trùng (theo IMPA/Part No/tên) sẽ được gán vào tàu thay vì tạo mới.",
    docToanBoSheet: "Đọc toàn bộ sheet trong file.",
    docSheetTheoTen:
      "Loại vật tư nhận theo tên sheet — sheet phụ tùng vào nhóm phụ tùng; các sheet vật tư, vật tư boong, phục vụ, bảo hộ vào nhóm vật tư. Sheet Dashboard hoặc trang ghi chú được bỏ qua. Sau khi nhập, hệ thống liệt kê từng sheet đã đọc kèm số dòng để bạn đối chiếu.",
    dangNhapDuLieu: "Đang nhập dữ liệu...",
    nutNhapVaoDanhMuc: "Nhập vào danh mục tàu",

    // Ô chọn chức danh giữ vật tư (ChonChucDanhGiuVatTu)
    chucDanhGiuVatTu: "Chức danh giữ vật tư",
    theoVaiTro: "Theo vai trò: {ten}",
    chuaKhai: "Chưa khai",
  },
  {
    tieuDe: "Stores & spare parts catalogue",
    danhMucRiengCua: "Catalogue of {tau}",
    danhMucGocMoTa: "Fleet master catalogue (shared definitions)",
    nutTonKhoKiemKe: "Inventory & stocktake export",
    nhapDanhMucTuFile: "Import catalogue from file",
    xemTheo: "View by",
    danhMucGocToanDoi: "Master catalogue (fleet)",
    optDanhMucGoc: "— Master catalogue —",
    tauLa: "Vessel: {tau}",
    chuaDuocGanTau: "No vessel assigned",
    banLa: "You are",
    phanBanQuanLy: "— the stores & spare parts you manage:",
    dangXemPhanCuaBan: "Viewing your part ({n} items)",
    xemVatTuToiQuanLy: "View the items I manage",
    moiChucDanh: "All ranks",
    timGoiY: "Search name, code, IMPA, Part No., maker...",
    chuaGanTauKhongXem:
      "You have not been assigned to a vessel, so no catalogue can be shown. Please contact the administrator.",
    themVaoDanhMucTau: "Add an item to the catalogue of {tau}",
    vatTuLayTuGoc: "Items come from the fleet master catalogue.",
    themVaoDanhMucGoc: "Add stores / spare part (master catalogue)",
    vatTuCuaTau: "Items of {tau} ({n})",
    danhMucGocN: "Master catalogue ({n})",
    tauChuaCoVatTu: "This vessel has no item in its catalogue yet.",
    chuaCoVatTu: "No item yet.",
    cotTenPhuTung: "Part name",
    cotGiuBoi: "Held by",
    loai: "Type",
    suyRaTuThietBi:
      "Inferred from the equipment group — run gan-ma-vat-tu.cmd to assign it permanently",
    suyRaTuBoPhan:
      "Inferred from the department — run gan-ma-vat-tu.cmd to assign it permanently",
    daGanTrucTiep: "Assigned directly",
    dangHienDauMoiBoPhan: "Showing the first {n} rows of each department —",
    nDong: "{n} rows",
    chuaHienGoiY: "are hidden. Use the search box to narrow the list, or",
    xemTatCaNDong: "show all {n} rows",
    trangSeNangHon: "(the page will be heavier).",

    quayLaiDanhMuc: "Back to the materials catalogue",
    nhapMoTa:
      "Upload a stocktake / catalogue file in the company format — stores & spare parts are added automatically to the catalogue of the selected vessel (with stock on hand when the file has an R.O.B column), for quick control of the whole fleet inventory.",
    mauTieuDe:
      "No catalogue file yet? Download the template for the vessel to fill in",
    mauCoSheet: "The template has 5 sheets by category —",
    mauSheetKhac: ", Engine stores, Deck stores, Catering, Safety — plus a",
    mauSheetHuongDan: "Guide",
    mauGiaiThichCot:
      "sheet explaining every column. Once the vessel fills it in and sends it back, upload that file in the box below and it goes straight into the catalogue.",
    mauKhopSan: "Sheet names and header rows already match the reader, so",
    mauDungDoiTen: "do not rename the sheets or change the header row",
    mauChiDienBenDuoi: "— fill in from the row below downwards only.",
    taiFileMau: "Download the Excel template",

    loaiStoreMLS: "Stores — MLS-11-05B",
    loaiSpareMLS: "Spare part — MLS-11-05A",
    phMaVatTu: "Item code",
    phTenVi: "Item name (Vietnamese)",
    phTenEn: "English name / Name of part",
    phThietBi: "Equipment / machinery",
    phImpa: "IMPA code",
    phPartNo: "Part No.",
    phMaker: "Maker",
    optChonNhom: "Select a group (Deck/Engine/Electrical/...)",
    phDonVi: "Unit: PCS, LIT, M...",
    tonToiThieu: "Minimum stock",
    tonToiDa: "Maximum stock",
    vatTuQuanTrong: "Critical item",
    nutThemVatTu: "Add item",

    nutNgungDung: "Deactivate",
    nutDungLai: "Reactivate",
    xacNhanXoa:
      "Permanently delete item {ma}? It can only be deleted while it has no stock and is not used in any request.",
    suaVatTu: "Edit item",
    tenTiengViet: "Vietnamese name",
    tenTiengAnh: "English name",
    chiDungChoPhuTung: "— spare parts only",
    impaSauChuSo: "IMPA — 6 digits",
    partNoMaNhaSanXuat: "Part No. — maker reference",
    optKhongThuocNhom: "— No group —",
    phuTungThietYeu:
      "Critical spare part — tracked separately on the Dashboard",
    luuThayDoi: "Save changes",

    optChonTuGoc:
      "Pick an item from the master catalogue to add to this vessel",
    nutThemVaoTau: "Add to vessel",
    tauDaCoDu: "This vessel already has every item of the master catalogue.",
    xacNhanGo:
      "Remove \"{ma}\" from this vessel catalogue? (The master definition and the stock are not deleted.)",
    nutGoKhoiTau: "Remove from vessel",

    khaiMoiTieuDe:
      "Not in the master catalogue? Declare a new item for {tau}",
    chucDanhGiuKiemKe: "Rank holding & counting it",
    optChonChucDanh: "— Select a rank —",
    boPhanTheoChucDanh: "Department (from the rank)",
    kiemNhiem: "additional duty",
    loaiStoreImpa: "Stores — IMPA",
    loaiSpareSpr: "Spare part — SPR",
    maTuDongTheoKhuon: "The code is issued automatically in the pattern",
    maTuDongSoThuTu:
      ", numbered inside the block of the selected equipment group.",
    tenMatHangVi: "Item name (Vietnamese)",
    vdVoiPhun: "e.g. Fuel injector nozzle",
    vdGangTay: "e.g. Welding leather gloves",
    thietBiMay: "Equipment / machinery",
    vdMayDen: "e.g. No.2 generator engine — Yanmar 6N18",
    maImpaNeuCo: "IMPA code (if any)",
    phSauChuSo: "6 digits, e.g. 190411",
    makerHang: "Maker / brand",
    nhomThietBi: "Equipment group",
    optChuaXepNhom: "— Not grouped yet —",
    nhomThuongDo: "This group is usually held by",
    nhomThuongDoDuoi:
      "— you are selecting {ten}. You can still save it if that matches the assignment on board.",
    thietYeuCritical: "Critical spare part / store item",
    nutKhaiMoi: "Declare & add to vessel",

    loaiDuPhong: "Fallback type (when the sheet name gives no clue)",
    ghiTonVaoKho: "Record ROB into warehouse",
    chonTauTruoc: "Select a vessel first to list its warehouses",
    tuDongTheoSheet:
      "Automatic by sheet (Spare parts→engine store, Deck→deck store, the rest→consumables store)",
    khongGhiTon: "— Do not record ROB, import the catalogue only —",
    tauChuaCoKho:
      "This vessel has no warehouse yet, so ROB cannot be recorded. Go to",
    duongDanTaoKho: "Fleet → vessel detail",
    taoKhoTruoc:
      "to create a warehouse first, or just import the catalogue and record ROB later.",
    robTruoc: "The",
    robTenCot: "ROB on board",
    robSau:
      "column in the file is written into the warehouse matching each sheet. This is the correct way to use the MLS-11-06 stocktake file.",
    fileDanhMuc: "Catalogue file (.xls / .xlsx / .doc / .docx)",
    nhanFormCongTy: "Reads the company forms directly:",
    moTaMLS1106:
      "Store & Spare Part Inventory (Excel — Group / Description / IMPA / Unit / ROB columns) and",
    moTaMLS1104:
      "Critical spare parts list (Word — equipment group and minimum quantity detected automatically). Duplicate items (by IMPA / Part No. / name) are assigned to the vessel instead of being created again.",
    docToanBoSheet: "Every sheet in the file is read.",
    docSheetTheoTen:
      "The item type comes from the sheet name — a spare parts sheet goes to the spare group; stores, deck stores, catering and safety sheets go to the stores group. Dashboard sheets and note pages are skipped. After the import, the system lists every sheet it read with its row count so you can check.",
    dangNhapDuLieu: "Importing data...",
    nutNhapVaoDanhMuc: "Import into the vessel catalogue",

    chucDanhGiuVatTu: "Rank holding the items",
    theoVaiTro: "By role: {ten}",
    chuaKhai: "Not declared",
  }
);
