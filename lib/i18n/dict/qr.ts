import { tuDien } from "./_kieu";

/** Mã QR gắn mặt hàng: màn quét, trang mặt hàng sau khi quét, in nhãn. */
export const qr = tuDien(
  {
    // Màn quét
    quetTieuDe: "Quét mã QR",
    quetMoTa:
      "Chĩa camera vào nhãn QR dán trên mặt hàng. Đọc được là mở thẳng thẻ kho của mặt hàng đó — nhập, xuất, xem lịch sử ngay tại chỗ.",
    dangMoCamera: "Đang mở camera...",
    camera_khongCo: "Máy này không có camera hoặc trình duyệt không cho dùng.",
    camera_biTuChoi:
      "Trình duyệt chưa được phép dùng camera. Bấm vào biểu tượng ổ khóa cạnh địa chỉ trang, cho phép Camera, rồi tải lại.",
    camera_canHttps:
      "Trình duyệt chỉ mở camera trên địa chỉ https hoặc localhost. Đang mở qua địa chỉ http thường thì dùng ứng dụng Camera của điện thoại quét nhãn — nhãn ghi sẵn địa chỉ trang, quét là vào.",
    camera_loiKhac: "Không mở được camera: {loi}",
    dangQuet: "Đang quét — giữ nhãn trong khung",
    docDuoc: "Đọc được mã {ma}, đang mở...",
    maKhongHopLe:
      "Mã vừa quét không phải nhãn của hệ thống này. Nội dung đọc được: {noiDung}",
    nhapTay: "Hoặc gõ mã mặt hàng",
    nhapTayGoiY: "VD: E-SPR-0001",
    nutMo: "Mở",
    nutQuetLai: "Quét lại",
    nutDungCamera: "Tắt camera",
    meoCameraDienThoai:
      "Mẹo: ứng dụng Camera có sẵn của điện thoại cũng quét được nhãn này — không cần mở app trước.",

    // Trang mặt hàng sau khi quét
    matHangTieuDe: "Mặt hàng theo mã QR",
    khongTimThayMa:
      "Không có mặt hàng nào mang mã {ma} trong danh mục. Nhãn có thể thuộc bản cài khác, hoặc mặt hàng đã bị xóa.",
    timTrongDanhMuc: "Tìm trong danh mục",
    chonKho: "Mặt hàng này có ở {n} kho — chọn kho để mở thẻ kho",
    moTheKho: "Mở thẻ kho",
    chuaCoTon:
      "Tàu của bạn chưa có dòng tồn nào cho mặt hàng này. Ghi phiếu nhập đầu tiên bên dưới để mở thẻ kho.",
    chuaCoKho: "Tàu của bạn chưa khai kho nào — khai kho ở trang Tồn kho trước.",
    ngoaiPhamVi:
      "Mặt hàng này không thuộc tàu bạn phụ trách. Bạn xem được thông tin, không ghi được nhập xuất.",
    tonHienTai: "Tồn hiện tại",
    nhapDauTien: "Ghi phiếu nhập đầu tiên",

    // In nhãn
    nhanTieuDe: "In nhãn QR",
    nhanMoTa:
      "Mỗi nhãn một mã QR mở thẳng thẻ kho của mặt hàng. In ra giấy nhãn hoặc giấy thường rồi dán lên kệ, hộp, hoặc chính mặt hàng.",
    nhanBoLoc: "Lọc nhãn cần in",
    nhanTatCaNhom: "Tất cả nhóm",
    nhanTimGoiY: "Tìm theo mã, tên, IMPA, Part No.",
    nhanSoLuong: "{n} nhãn",
    nhanQuaNhieu:
      "Đang hiện {n} nhãn đầu tiên trong {tong} — lọc theo nhóm hoặc tìm để in theo đợt, tránh một lượt in quá dài.",
    nhanKhongCo: "Không có mặt hàng nào khớp bộ lọc.",
    nhanInNut: "In nhãn",
    nhanDiaChiGhiTrongMa: "Địa chỉ ghi trong mã: {goc}",
    nhanGiaiThichDiaChi:
      "Nhãn in từ bản cài nào thì ghi địa chỉ của bản cài đó; camera điện thoại quét sẽ mở đúng địa chỉ ấy. Màn Quét mã trong app thì đọc mã ở nhãn in từ bất kỳ bản cài nào.",
    nutInNhanMatHang: "In nhãn QR",
    nutQuetMa: "Quét mã QR",
    chupAnh: "Chụp ảnh nhãn để đọc",
    chupAnhThayThe:
      "Bấm \"Chụp ảnh nhãn để đọc\": ứng dụng Camera của điện thoại mở ra, chụp nhãn một tấm, trang tự đọc mã trong ảnh. Cách này chạy ở mọi địa chỉ, không cần cấp quyền.",
    dangDocAnh: "Đang đọc mã trong ảnh...",
    anhKhongCoMa:
      "Không thấy mã QR trong ảnh. Chụp lại gần hơn, để nhãn nằm gọn trong khung và đủ sáng, tránh lóa.",
    thuMoCameraLai: "Thử mở camera lại",
    chonCamera: "Camera",
  },
  {
    quetTieuDe: "Scan QR code",
    quetMoTa:
      "Point the camera at the QR label on the item. Once read, the item's stock card opens straight away — receive, issue, or check history on the spot.",
    dangMoCamera: "Opening camera...",
    camera_khongCo: "This device has no camera, or the browser does not allow it.",
    camera_biTuChoi:
      "The browser has not been allowed to use the camera. Tap the padlock icon next to the address, allow Camera, then reload.",
    camera_canHttps:
      "Browsers only open the camera on https or localhost addresses. On a plain http address, use the phone's built-in Camera app to scan the label — the label carries the page address, so scanning opens it.",
    camera_loiKhac: "Could not open the camera: {loi}",
    dangQuet: "Scanning — keep the label inside the frame",
    docDuoc: "Read code {ma}, opening...",
    maKhongHopLe:
      "The code just scanned is not a label of this system. Content read: {noiDung}",
    nhapTay: "Or type the item code",
    nhapTayGoiY: "e.g. E-SPR-0001",
    nutMo: "Open",
    nutQuetLai: "Scan again",
    nutDungCamera: "Stop camera",
    meoCameraDienThoai:
      "Tip: the phone's built-in Camera app can scan this label too — no need to open the app first.",

    matHangTieuDe: "Item from QR code",
    khongTimThayMa:
      "No item in the catalogue has code {ma}. The label may belong to another installation, or the item was deleted.",
    timTrongDanhMuc: "Search the catalogue",
    chonKho: "This item is held in {n} warehouses — choose one to open its stock card",
    moTheKho: "Open stock card",
    chuaCoTon:
      "Your vessel has no stock line for this item yet. Record the first receipt below to open its stock card.",
    chuaCoKho: "Your vessel has no warehouse defined yet — add one on the Inventory page first.",
    ngoaiPhamVi:
      "This item does not belong to a vessel you are assigned to. You can view it but cannot record movements.",
    tonHienTai: "Current stock",
    nhapDauTien: "Record first receipt",

    nhanTieuDe: "Print QR labels",
    nhanMoTa:
      "One QR code per label, opening the item's stock card. Print on label stock or plain paper and stick it on the shelf, the box, or the item itself.",
    nhanBoLoc: "Filter labels to print",
    nhanTatCaNhom: "All groups",
    nhanTimGoiY: "Search by code, name, IMPA, Part No.",
    nhanSoLuong: "{n} labels",
    nhanQuaNhieu:
      "Showing the first {n} of {tong} labels — filter by group or search to print in batches and avoid one very long print run.",
    nhanKhongCo: "No items match the filter.",
    nhanInNut: "Print labels",
    nhanDiaChiGhiTrongMa: "Address written in the code: {goc}",
    nhanGiaiThichDiaChi:
      "Labels carry the address of the installation that printed them; a phone camera opens that address. The in-app Scan screen reads labels printed from any installation.",
    nutInNhanMatHang: "Print QR label",
    nutQuetMa: "Scan QR code",
    chupAnh: "Take a photo of the label",
    chupAnhThayThe:
      "Tap \"Take a photo of the label\": the phone's Camera app opens, take one shot of the label, and the page reads the code from the photo. This works on any address and needs no permission.",
    dangDocAnh: "Reading the code in the photo...",
    anhKhongCoMa:
      "No QR code found in the photo. Retake it closer, with the label fully inside the frame and well lit, avoiding glare.",
    thuMoCameraLai: "Try opening the camera again",
    chonCamera: "Camera",
  }
);
