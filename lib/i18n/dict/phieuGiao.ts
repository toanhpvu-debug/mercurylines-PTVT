import { tuDien } from "./_kieu";

/** Phiếu giao hàng của nhà cung cấp (PDF scan) — hàng chờ duyệt trước khi vào danh mục / tồn kho. */
export const phieuGiao = tuDien(
  {
    tieuDe: "Nhập từ phiếu giao hàng (PDF scan)",
    moTa:
      "Nhà cung cấp giao hàng lên tàu, thuyền viên kiểm xong thì tải bản scan phiếu giao lên đây. Hệ thống đọc các dòng hàng để điền sẵn; người có quyền đối chiếu, sửa, rồi phê duyệt — lúc đó mặt hàng mới vào danh mục tàu và tồn kho mới được cộng.",
    theTaiLen: "Tải phiếu giao lên",
    theTaiLenMoTa:
      "PDF số (nhà cung cấp xuất từ phần mềm) đọc được ở mọi máy. Bản scan / ảnh chụp chỉ đọc được trên máy văn phòng Windows; ở nơi khác vẫn tải lên được, người duyệt gõ tay các dòng.",
    oNhaCungCap: "Nhà cung cấp",
    oSoPhieu: "Số phiếu giao",
    oNgayGiao: "Ngày giao",
    oGhiChu: "Ghi chú",
    oFile: "File phiếu giao (.pdf)",
    nutTaiLen: "Tải lên & đọc dòng hàng",
    dangDoc: "Đang đọc phiếu...",
    daDocN: "Đã đọc {n} dòng hàng từ phiếu. Mở trang duyệt để đối chiếu.",
    daDocNKiem:
      "Đã đọc {n} dòng hàng, trong đó {k} dòng cần kiểm kỹ (tô vàng, có lý do dưới tên hàng). Đối chiếu với bản scan rồi mới lưu / duyệt.",
    soDongCanKiem: "{k} dòng cần kiểm kỹ (tô vàng).",
    canhBaoGoiY:
      "Lý do ghi dưới tên hàng; bấm \"tr.N\" để mở đúng trang trên bản scan. Sửa một ô là cảnh báo của dòng đó được gỡ.",
    nhayTrang: "Mở trang {n} của bản scan",
    banCuTaiLai:
      "App vừa được cập nhật nên trang này đang chạy bản cũ. Đang tải lại trang — các ô đang sửa được giữ, tải xong bấm lại nút.",
    banCuVanLoi:
      "Trang vẫn chạy bản cũ sau khi tải lại. Đóng tab, mở lại trang phiếu giao rồi thử lại.",
    daKhoiPhucNhap: "Đã khôi phục các ô đang sửa từ trước khi tải lại. Kiểm tra rồi bấm Lưu hoặc Phê duyệt.",
    docKhongRaDong:
      "Không nhận ra dòng hàng nào. Phiếu đã lưu — mở trang duyệt để gõ tay các dòng.",
    nguon_TEXT: "Lớp chữ PDF",
    nguon_OCR: "Nhận dạng chữ (OCR)",
    nguon_TAY: "Gõ tay",
    nguon_AI: "Bộ đọc AI",
    aiBat:
      "Bộ đọc AI đang bật ({ncc} · {model}): bản scan và ảnh chụp cũng được đọc thành dòng hàng ở mọi máy, kể cả máy chủ. Kết quả vẫn phải đối chiếu với bản scan trước khi duyệt.",
    aiLoiGoiY:
      "Bấm \"Đọc lại bằng AI\" để thử lại. Lỗi về khóa, mô hình hay hạn mức thì sửa ở Quản trị → Bộ đọc AI (có nút \"Thử đọc thật\" để kiểm tra ngay).",
    aiChuaCauHinh:
      "Chưa cấu hình bộ đọc AI. Vào menu Quản trị → Bộ đọc AI để dán khóa API của Google AI Studio (Gemini) hoặc Claude; khi đó bản scan được đọc tự động ở mọi máy, kể cả máy chủ.",
    nutDocLaiAi: "Đọc lại bằng AI",
    xacNhanDocLaiAi:
      "Gửi bản scan của phiếu {phieu} cho AI đọc lại? Toàn bộ dòng hiện có (kể cả chỗ sửa chưa lưu) sẽ được thay bằng kết quả mới.",
    aiDangDoc: "Đang gửi bản scan cho AI đọc — nhiều trang có thể mất tới một phút, đừng bấm lại.",
    daDocLaiAi: "AI đã đọc {n} dòng hàng. Đối chiếu với bản scan rồi lưu hoặc phê duyệt.",
    aiLoi: "Bộ đọc AI gặp lỗi: {loi}",
    aiDangDocNen:
      "Bộ đọc AI đang đọc phiếu ở chế độ nền — đã xong {tienDo} lượt. Trang tự cập nhật; có thể rời trang và quay lại sau. Phiếu nhiều trang mất vài phút.",
    tienDoChuaRo: "đang bắt đầu",
    aiBiNgat:
      "Lần đọc AI trước bị gián đoạn (máy chủ khởi động lại giữa chừng). Bấm \"Đọc lại bằng AI\" để đọc lại.",
    aiDangDocRoi: "AI đang đọc phiếu này — chờ đọc xong rồi thao tác (trang tự cập nhật).",
    aiBatDauDoc: "Đã gửi phiếu cho AI đọc lại ở chế độ nền. Trang tự cập nhật khi xong.",
    badgeDangDoc: "AI đang đọc",
    aiLoiLucTai:
      "Bộ đọc AI gặp lỗi lúc tải lên (mạng hoặc hạn mức). Bấm \"Đọc lại bằng AI\" để thử lại, hoặc gõ tay các dòng.",
    tepKhongCon: "Không tìm thấy tệp bản scan của phiếu này trên máy chủ.",

    danhSachTieuDe: "Phiếu giao đã tải lên",
    chuaCoPhieu: "Chưa có phiếu giao nào.",
    cotPhieu: "Phiếu",
    cotTau: "Tàu",
    cotNguoiTai: "Người tải",
    cotSoDong: "Dòng hàng",
    trangThai_CHO_DUYET: "Chờ duyệt",
    trangThai_DA_DUYET: "Đã duyệt",
    trangThai_TU_CHOI: "Từ chối",
    nutMo: "Mở",

    duyetTieuDe: "Đối chiếu & phê duyệt phiếu giao",
    duyetMoTa:
      "Soát từng dòng với bản scan bên cạnh: sửa tên, mã, số lượng, đơn vị, bỏ tick dòng rác, thêm dòng thiếu. Dòng khớp mặt hàng có sẵn thì chỉ cộng tồn; dòng mới sẽ tạo mặt hàng mới trong danh mục tàu.",
    xemPdf: "Xem bản scan",
    chuDocDuoc: "Chữ đọc được từ phiếu",
    cotChon: "Đưa vào",
    cotTen: "Tên hàng",
    cotPartNo: "Part No.",
    cotImpa: "IMPA",
    cotSoLuong: "SL",
    cotDonVi: "ĐVT",
    cotLoai: "Loại",
    cotThietBi: "Thiết bị",
    cotKhop: "Khớp mặt hàng",
    khopMoi: "Tạo mới",
    khopCoSan: "Có sẵn",
    nutThemDong: "Thêm dòng",
    nutXoaDong: "Xóa dòng",
    nutLuuDong: "Lưu các dòng",
    daLuuDong: "Đã lưu {n} dòng.",
    khoNhap: "Kho nhận hàng",
    khoNhapMoTa:
      "Chọn kho để CỘNG số lượng vào tồn khi duyệt. Để trống thì chỉ đưa mặt hàng vào danh mục tàu, không ghi tồn.",
    khongGhiTon: "— Chỉ vào danh mục, không ghi tồn —",
    nutDuyet: "Phê duyệt & nhập vào hệ thống",
    nutTuChoi: "Từ chối phiếu",
    lyDoTuChoi: "Lý do từ chối",
    xacNhanDuyet:
      "Phê duyệt {n} dòng của phiếu {phieu}? Mặt hàng mới sẽ được tạo trong danh mục tàu{kho}. Việc này không hoàn lại được.",
    xacNhanDuyetCoKho: " và {so} dòng có số lượng sẽ cộng vào kho {kho}",
    daDuyet:
      "Đã duyệt: {moi} mặt hàng mới, {coSan} gắn vào mặt hàng có sẵn, {ton} dòng cộng tồn vào kho.",
    daTuChoi: "Đã từ chối phiếu.",
    phieuDaXuLy: "Phiếu này đã được xử lý ({trangThai}) — không sửa được nữa.",
    duyetBoi: "Duyệt bởi {nguoi} lúc {luc}",
    tuChoiBoi: "Từ chối: {lyDo}",
    canChonItNhatMotDong: "Chưa chọn dòng nào để nhập.",
    dongThieuTen: "Dòng {n} thiếu tên hàng.",
    dongSoLuongSai: "Dòng {n} số lượng không hợp lệ.",
    khongCoQuyenDuyet: "Chỉ thuyền trưởng hoặc quản trị mới phê duyệt phiếu giao.",
    nutXoaPhieu: "Xóa phiếu",
    xacNhanXoaPhieu: "Xóa phiếu {phieu} và các dòng đã đọc? Bản scan cũng bị xóa.",
    quayLai: "Quay lại danh sách phiếu giao",
    nutGoPhieu: "Gỡ bỏ phiếu",
    goChiVanPhong: "Gỡ bỏ phiếu chỉ làm được bằng tài khoản quản trị trên bản văn phòng.",
    goChiPhieuDaDuyet: "Phiếu này chưa duyệt — dùng nút Xóa phiếu trên trang duyệt.",
    goDangTinh: "Đang tính những gì sẽ được hoàn tác...",
    xacNhanGoDaDuyet:
      "Gỡ bỏ phiếu {phieu} ĐÃ DUYỆT và hoàn tác: xóa {tx} dòng nhập kho (trừ lại tồn), xóa {moi} mặt hàng mới do phiếu này tạo và chưa dùng ở đâu khác, giữ {giu} mặt hàng có sẵn hoặc đang dùng. Bản scan cũng bị xóa. Việc này không hoàn lại được.",
    daGoDaDuyet: "Đã gỡ phiếu {phieu}: xóa {tx} dòng nhập kho, xóa {moi} mặt hàng mới, giữ {giu} mặt hàng.",
    goTonAm:
      "Không gỡ được: tồn của {ds} đã bị xuất bớt sau khi nhập nên trừ lại sẽ âm. Điều chỉnh tồn thủ công rồi gỡ lại.",
    lienKetTuNhap: "Có phiếu giao hàng bản scan? Tải lên để hệ thống đọc dòng hàng, rồi phê duyệt mới nhập.",
    nutSangTrangPhieuGiao: "Nhập từ phiếu giao (PDF)",
    ocrChiWindows:
      "Bản scan này không có lớp chữ. Máy chủ hiện không có bộ nhận dạng chữ — mở phiếu này trên bản cài máy văn phòng để đọc tự động, hoặc gõ tay các dòng bên dưới.",
  },
  {
    tieuDe: "Import from a delivery note (scanned PDF)",
    moTa:
      "When the supplier delivers on board and the crew has checked the goods, upload the scanned delivery note here. The system reads the item lines to pre-fill; an authorised person checks, edits, then approves — only then do items enter the vessel catalogue and stock is added.",
    theTaiLen: "Upload delivery note",
    theTaiLenMoTa:
      "Digital PDFs (exported by the supplier's software) are read on any machine. Scans / photos are only read on the Windows office installation; elsewhere the upload still works and the approver types the lines.",
    oNhaCungCap: "Supplier",
    oSoPhieu: "Delivery note no.",
    oNgayGiao: "Delivery date",
    oGhiChu: "Notes",
    oFile: "Delivery note file (.pdf)",
    nutTaiLen: "Upload & read lines",
    dangDoc: "Reading the note...",
    daDocN: "Read {n} item lines from the note. Open the review page to check them.",
    daDocNKiem:
      "Read {n} item lines, {k} of which need a close check (highlighted, reason shown under the item name). Compare with the scan before saving / approving.",
    soDongCanKiem: "{k} lines need a close check (highlighted).",
    canhBaoGoiY:
      "The reason is shown under the item name; click \"tr.N\" to open that page of the scan. Editing a cell clears that line's warning.",
    nhayTrang: "Open page {n} of the scan",
    banCuTaiLai:
      "The app was just updated, so this page is running an old version. Reloading — your edits are kept; click the button again once loaded.",
    banCuVanLoi: "The page is still on the old version after reloading. Close the tab, reopen the delivery note page and try again.",
    daKhoiPhucNhap: "Restored the cells you were editing before the reload. Check them, then click Save or Approve.",
    docKhongRaDong: "No item lines recognised. The note is saved — open the review page to type the lines.",
    nguon_TEXT: "PDF text layer",
    nguon_OCR: "Text recognition (OCR)",
    nguon_TAY: "Typed",
    nguon_AI: "AI reader",
    aiBat:
      "The AI reader is on ({ncc} · {model}): scans and photos are also read into item lines on any machine, including the server. Results must still be checked against the scan before approval.",
    aiLoiGoiY:
      "Click \"Re-read with AI\" to retry. Key, model or quota errors are fixed under Administration → AI reader (its \"Real read test\" button checks right away).",
    aiChuaCauHinh:
      "The AI reader is not configured. Open Administration → AI reader and paste an API key from Google AI Studio (Gemini) or Claude; scans are then read automatically on any machine, including the server.",
    nutDocLaiAi: "Re-read with AI",
    xacNhanDocLaiAi:
      "Send the scan of note {phieu} to the AI again? All current lines (including unsaved edits) will be replaced by the new result.",
    aiDangDoc: "Sending the scan to the AI — several pages can take up to a minute, please don't click again.",
    daDocLaiAi: "The AI read {n} item lines. Check them against the scan, then save or approve.",
    aiLoi: "AI reader error: {loi}",
    aiDangDocNen:
      "The AI reader is reading this note in the background — {tienDo} passes done. The page updates itself; you can leave and come back later. Multi-page notes take a few minutes.",
    tienDoChuaRo: "starting",
    aiBiNgat: "The previous AI read was interrupted (the server restarted midway). Click \"Re-read with AI\" to read again.",
    aiDangDocRoi: "The AI is reading this note — wait until it finishes (the page updates itself).",
    aiBatDauDoc: "The note was sent to the AI to re-read in the background. The page updates itself when done.",
    badgeDangDoc: "AI reading",
    aiLoiLucTai:
      "The AI reader failed during upload (network or quota). Click \"Re-read with AI\" to retry, or type the lines.",
    tepKhongCon: "The scan file for this note was not found on the server.",

    danhSachTieuDe: "Uploaded delivery notes",
    chuaCoPhieu: "No delivery notes yet.",
    cotPhieu: "Note",
    cotTau: "Vessel",
    cotNguoiTai: "Uploaded by",
    cotSoDong: "Lines",
    trangThai_CHO_DUYET: "Pending approval",
    trangThai_DA_DUYET: "Approved",
    trangThai_TU_CHOI: "Rejected",
    nutMo: "Open",

    duyetTieuDe: "Review & approve delivery note",
    duyetMoTa:
      "Check each line against the scan alongside: fix name, code, quantity, unit, untick junk lines, add missing ones. Lines matched to an existing item only add stock; new lines create new items in the vessel catalogue.",
    xemPdf: "View scan",
    chuDocDuoc: "Text read from the note",
    cotChon: "Include",
    cotTen: "Item name",
    cotPartNo: "Part No.",
    cotImpa: "IMPA",
    cotSoLuong: "Qty",
    cotDonVi: "Unit",
    cotLoai: "Type",
    cotThietBi: "Equipment",
    cotKhop: "Matched item",
    khopMoi: "New",
    khopCoSan: "Existing",
    nutThemDong: "Add line",
    nutXoaDong: "Delete line",
    nutLuuDong: "Save lines",
    daLuuDong: "Saved {n} lines.",
    khoNhap: "Receiving warehouse",
    khoNhapMoTa:
      "Choose a warehouse to ADD the quantities to stock on approval. Leave empty to only add items to the vessel catalogue without stock.",
    khongGhiTon: "— Catalogue only, no stock —",
    nutDuyet: "Approve & import into the system",
    nutTuChoi: "Reject note",
    lyDoTuChoi: "Rejection reason",
    xacNhanDuyet:
      "Approve {n} lines of note {phieu}? New items will be created in the vessel catalogue{kho}. This cannot be undone.",
    xacNhanDuyetCoKho: " and {so} lines with quantities will be added to warehouse {kho}",
    daDuyet: "Approved: {moi} new items, {coSan} linked to existing items, {ton} lines added to stock.",
    daTuChoi: "Note rejected.",
    phieuDaXuLy: "This note has already been processed ({trangThai}) — it can no longer be edited.",
    duyetBoi: "Approved by {nguoi} at {luc}",
    tuChoiBoi: "Rejected: {lyDo}",
    canChonItNhatMotDong: "No line selected for import.",
    dongThieuTen: "Line {n} has no item name.",
    dongSoLuongSai: "Line {n} has an invalid quantity.",
    khongCoQuyenDuyet: "Only the master or an administrator can approve delivery notes.",
    nutXoaPhieu: "Delete note",
    xacNhanXoaPhieu: "Delete note {phieu} and its lines? The scan is deleted too.",
    quayLai: "Back to delivery notes",
    nutGoPhieu: "Remove note",
    goChiVanPhong: "Removing notes is only possible with an administrator account on the office installation.",
    goChiPhieuDaDuyet: "This note is not approved — use Delete note on the review page.",
    goDangTinh: "Working out what will be rolled back...",
    xacNhanGoDaDuyet:
      "Remove APPROVED note {phieu} and roll back: delete {tx} stock-in lines (stock is reduced again), delete {moi} new items this note created that are not used elsewhere, keep {giu} existing or in-use items. The scan is deleted too. This cannot be undone.",
    daGoDaDuyet: "Removed note {phieu}: deleted {tx} stock-in lines and {moi} new items, kept {giu} items.",
    goTonAm:
      "Cannot remove: stock of {ds} has been issued since it was received, so reducing it would go negative. Adjust stock manually, then try again.",
    lienKetTuNhap: "Have a scanned delivery note? Upload it for the system to read the lines, then approve before importing.",
    nutSangTrangPhieuGiao: "Import from delivery note (PDF)",
    ocrChiWindows:
      "This scan has no text layer. The server has no text recognition — open this note on the office Windows installation to read it automatically, or type the lines below.",
  }
);
