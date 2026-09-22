import { tuDien } from "./_kieu";

/** Trang /cai-dat/ai — quản trị nhập khóa API của Google AI Studio hoặc Claude cho bộ đọc phiếu giao. */
export const cauHinhAi = tuDien(
  {
    tieuDe: "Bộ đọc AI cho phiếu giao hàng",
    moTa:
      "Dán khóa API của Google AI Studio (Gemini) hoặc Claude (Anthropic). Có khóa thì bản scan phiếu giao hàng được đọc thành dòng hàng ở mọi máy, kể cả máy chủ. Khóa được mã hóa trước khi lưu và không bao giờ hiện lại đầy đủ.",
    trangThaiTieuDe: "Trạng thái",
    dangBat: "Đang bật",
    dangTat: "Chưa bật",
    nguonDb: "khóa nhập trong app",
    nguonEnv: "khóa từ biến môi trường của máy chủ",
    capNhatBoi: "Cập nhật bởi {nguoi} lúc {luc}",
    loiGiaiMa:
      "Có khóa đã lưu nhưng không giải mã được — SESSION_SECRET của bản cài đã đổi. Dán lại khóa để dùng tiếp.",
    envBiChe: "Biến môi trường cũng có khóa; khóa nhập trong app được ưu tiên.",
    nhaCungCap: "Nhà cung cấp",
    ncc_claude: "Claude (Anthropic)",
    ncc_gemini: "Gemini (Google AI Studio)",
    ncc_deepseek: "DeepSeek",
    deepseekChiChu:
      "DeepSeek chỉ đọc CHỮ, không đọc ảnh: app tách chữ từ PDF trước rồi gửi. PDF số (có lớp chữ) đọc được ở mọi máy; bản scan chỉ đọc được khi tải từ máy văn phòng Windows (có OCR). Bản scan tải lên máy chủ sẽ báo không đọc được — khi đó dùng Gemini hoặc Claude.",
    huongDanDeepseek:
      "DeepSeek Platform → \"API keys\" → tạo khóa (nạp tiền trước, rẻ). Mô hình gợi ý: deepseek-chat. Chỉ đọc chữ — xem ghi chú khi chọn.",
    khoaApi: "Khóa API",
    khoaApiGiuNguyen: "Đã lưu {duoi} — để trống nếu giữ nguyên",
    khoaApiMoi: "Dán khóa API vào đây",
    moHinh: "Mô hình",
    moHinhGoiY: "Để trống dùng mặc định {macDinh}. Bấm \"Kiểm tra kết nối\" để xem danh sách mô hình khóa này dùng được. Đọc bản scan chính xác nhất: gemini-2.5-pro hoặc claude-sonnet-5; dòng flash nhanh và rẻ hơn nhưng dễ sót số.",
    cheDoDoc: "Chế độ đọc",
    cheDo_ky: "Kỹ — 2 lượt: đọc rồi tự kiểm lại (khuyên dùng)",
    cheDo_nhanh: "Nhanh — 1 lượt",
    cheDoMoTa:
      "Chế độ Kỹ gửi tài liệu lần hai kèm bảng lượt 1 để mô hình đối chiếu từng dòng; dòng bị sửa hay thêm được đánh dấu cho người duyệt. Tốn gấp đôi token, chính xác hơn rõ rệt với bản scan. Phiếu dài hơn 4 trang luôn được đọc theo từng cụm 3 trang.",
    nutKiemTra: "Kiểm tra kết nối",
    dangKiemTra: "Đang hỏi nhà cung cấp...",
    kiemTraOk: "Khóa hợp lệ. {n} mô hình dùng được.",
    kiemTraModelKhongCo: "Khóa hợp lệ nhưng mô hình \"{model}\" không có trong danh sách — chọn một mô hình bên dưới.",
    kiemTraLoi: "Không kết nối được: {loi}",
    chonMoHinh: "Chọn nhanh:",
    nutThuDoc: "Thử đọc thật",
    dangThuDoc: "Đang gửi phiếu mẫu cho AI đọc...",
    thuDocMoTa:
      "Gửi một phiếu giao mẫu 1 trang (3 dòng hàng) cho AI đọc bằng đúng đường mà app dùng khi tải phiếu lên — kiểm được khóa, mô hình, hạn mức và đường mạng từ máy chủ. Tốn vài xu.",
    thuDocOk: "Đọc thử thành công sau {giay} giây bằng {model}: {n}/3 dòng hàng, token {vao} vào / {ra} ra. Bộ đọc sẵn sàng.",
    thuDocThieuDong: "Đọc thử xong sau {giay} giây bằng {model} nhưng chỉ ra {n}/3 dòng hàng — mô hình này đọc kém, thử mô hình khác.",
    thuDocLoi: "Đọc thử thất bại: {loi}",
    nutLuu: "Lưu cấu hình",
    daLuu: "Đã lưu. Bộ đọc AI dùng {ncc} với mô hình {model}.",
    nutXoa: "Xóa khóa",
    xacNhanXoa: "Xóa khóa API đã lưu? Bộ đọc AI sẽ tắt (trừ khi máy chủ có biến môi trường).",
    daXoa: "Đã xóa khóa.",
    loiThieuKhoa: "Cần dán khóa API (đổi nhà cung cấp thì phải có khóa mới).",
    loiKhoaSai: "Khóa không hợp lệ: ít nhất 20 ký tự, không có khoảng trắng.",
    loiKhongMaHoaDuoc: "Máy chủ chưa có SESSION_SECRET hợp lệ nên không mã hóa được khóa — kiểm tra cấu hình bản cài.",
    huongDanTieuDe: "Lấy khóa ở đâu",
    huongDanGemini:
      "Google AI Studio → \"Get API key\" → tạo khóa (miễn phí có hạn mức, trả phí theo dùng). Mô hình gợi ý: gemini-2.5-pro (đọc kỹ) hoặc gemini-2.5-flash (nhanh, rẻ).",
    huongDanClaude:
      "Anthropic Console → \"API keys\" → tạo khóa (cần nạp tiền trước). Mô hình gợi ý: claude-sonnet-5.",
    luuYRiengTu:
      "Bản scan phiếu giao sẽ được gửi tới máy chủ của nhà cung cấp AI đã chọn. Chỉ bật khi công ty cho phép đưa chứng từ ra dịch vụ ngoài.",
    luuYChiPhi: "Một phiếu 3 trang tốn cỡ vài nghìn token — tính bằng xu; hóa đơn nằm ở tài khoản của công ty tại nhà cung cấp.",
    lienKetPhieuGiao: "Sang trang phiếu giao hàng",
  },
  {
    tieuDe: "AI reader for delivery notes",
    moTa:
      "Paste an API key from Google AI Studio (Gemini) or Claude (Anthropic). With a key, scanned delivery notes are read into item lines on any machine, including the server. The key is encrypted before it is stored and is never shown again in full.",
    trangThaiTieuDe: "Status",
    dangBat: "Enabled",
    dangTat: "Not enabled",
    nguonDb: "key entered in the app",
    nguonEnv: "key from the server's environment variables",
    capNhatBoi: "Updated by {nguoi} at {luc}",
    loiGiaiMa:
      "A key is stored but cannot be decrypted — this installation's SESSION_SECRET has changed. Paste the key again.",
    envBiChe: "An environment variable also holds a key; the key entered in the app takes precedence.",
    nhaCungCap: "Provider",
    ncc_claude: "Claude (Anthropic)",
    ncc_gemini: "Gemini (Google AI Studio)",
    ncc_deepseek: "DeepSeek",
    deepseekChiChu:
      "DeepSeek reads TEXT only, not images: the app extracts text from the PDF first, then sends it. Digital PDFs (with a text layer) work on any machine; scans only when uploaded from the Windows office PC (OCR). Scans uploaded on the server will be reported as unreadable — use Gemini or Claude for those.",
    huongDanDeepseek:
      "DeepSeek Platform → \"API keys\" → create a key (prepaid, inexpensive). Suggested model: deepseek-chat. Text only — see the note when selected.",
    khoaApi: "API key",
    khoaApiGiuNguyen: "Stored {duoi} — leave empty to keep it",
    khoaApiMoi: "Paste the API key here",
    moHinh: "Model",
    moHinhGoiY: "Leave empty for the default {macDinh}. Click \"Test connection\" to list the models this key can use. Most accurate on scans: gemini-2.5-pro or claude-sonnet-5; flash models are faster and cheaper but miss digits more often.",
    cheDoDoc: "Reading mode",
    cheDo_ky: "Thorough — 2 passes: read, then self-check (recommended)",
    cheDo_nhanh: "Fast — 1 pass",
    cheDoMoTa:
      "Thorough mode sends the document a second time with the first-pass table so the model re-checks every line; changed or added lines are flagged for the reviewer. Twice the tokens, noticeably more accurate on scans. Notes longer than 4 pages are always read in 3-page chunks.",
    nutKiemTra: "Test connection",
    dangKiemTra: "Asking the provider...",
    kiemTraOk: "Key is valid. {n} models available.",
    kiemTraModelKhongCo: "Key is valid but model \"{model}\" is not in the list — pick one below.",
    kiemTraLoi: "Could not connect: {loi}",
    chonMoHinh: "Quick pick:",
    nutThuDoc: "Real read test",
    dangThuDoc: "Sending a sample note to the AI...",
    thuDocMoTa:
      "Sends a 1-page sample delivery note (3 item lines) to the AI through the exact path the app uses on upload — checks the key, model, quota and the server's network route. Costs cents.",
    thuDocOk: "Test read succeeded in {giay} s with {model}: {n}/3 item lines, tokens {vao} in / {ra} out. The reader is ready.",
    thuDocThieuDong: "Test read finished in {giay} s with {model} but returned only {n}/3 item lines — this model reads poorly, try another.",
    thuDocLoi: "Test read failed: {loi}",
    nutLuu: "Save settings",
    daLuu: "Saved. The AI reader uses {ncc} with model {model}.",
    nutXoa: "Delete key",
    xacNhanXoa: "Delete the stored API key? The AI reader turns off (unless the server has an environment variable).",
    daXoa: "Key deleted.",
    loiThieuKhoa: "An API key is required (switching provider needs a new key).",
    loiKhoaSai: "Invalid key: at least 20 characters, no whitespace.",
    loiKhongMaHoaDuoc: "The server has no valid SESSION_SECRET, so the key cannot be encrypted — check the installation.",
    huongDanTieuDe: "Where to get a key",
    huongDanGemini:
      "Google AI Studio → \"Get API key\" → create a key (free tier with limits, then pay per use). Suggested models: gemini-2.5-pro (thorough) or gemini-2.5-flash (fast, cheap).",
    huongDanClaude: "Anthropic Console → \"API keys\" → create a key (prepaid credit required). Suggested model: claude-sonnet-5.",
    luuYRiengTu:
      "Scanned delivery notes are sent to the chosen AI provider's servers. Enable only if the company allows documents to go to an external service.",
    luuYChiPhi: "A 3-page note costs a few thousand tokens — cents; billing sits in the company's account at the provider.",
    lienKetPhieuGiao: "Go to delivery notes",
  }
);
