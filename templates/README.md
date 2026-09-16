# Thư mục biểu mẫu

Chức năng **Xuất kiểm kê MLS-11-06** điền dữ liệu vào chính file Excel biểu mẫu của công ty
để giữ nguyên định dạng, logo và khối chữ ký.

File biểu mẫu là tài liệu nội bộ của từng công ty nên **không được đưa vào repo công khai**
(`templates/*.xlsx` đã nằm trong `.gitignore`).

## Cách nạp biểu mẫu — dùng giao diện, không chép file

Đăng nhập bằng tài khoản **quản trị** → **Mua sắm → Biểu mẫu** → khối *Tệp biểu mẫu Excel
MLS-11-06* → chọn file `.xlsx` của công ty → **Tải lên**.

File được lưu **trong database**, nên:

- còn nguyên sau mỗi lần cập nhật / dựng lại máy chủ;
- nằm trong bản sao lưu hằng ngày cùng với dữ liệu nghiệp vụ;
- không phải đưa tài liệu nội bộ lên repo.

Tải lên lần nữa là thay bản cũ. Hệ thống kiểm tra file mở được bằng Excel trước khi nhận,
và hiện lại tên file, dung lượng, người tải, thời điểm cùng mã băm sha256 để đối chiếu.

## Đường lùi: đặt file vào thư mục này

Nếu database chưa có biểu mẫu, hệ thống tìm tiếp `templates/MLS-11-06.xlsx` trên đĩa. Đường
này chỉ tiện cho **bản chạy trên máy văn phòng** — bản chạy trong Docker dựng từ repo sạch
thì không bao giờ có file ở đây, vì `.gitignore` chặn nó khỏi mã nguồn.

```
templates/MLS-11-06.xlsx
```

Thiếu cả hai đường thì mọi chức năng khác vẫn chạy bình thường, chỉ riêng nút
"⬇ MLS-11-06" ở trang Tồn kho báo lỗi kèm lời nhắc vào Mua sắm → Biểu mẫu để tải lên.

## Cấu trúc ô mà code ghi vào

`app/api/export/inventory/route.ts` ghi theo các ô cố định của form gốc:

| Ô | Nội dung |
|---|---|
| `C7` | Tên tàu |
| `H7` | Ngày xuất báo cáo |
| `C8` | Loại vật tư (Tất cả / Store / Spare) |
| `H8` | Kỳ báo cáo |
| Dòng 11–12 | Tiêu đề bảng (biểu mẫu có sẵn, code không ghi đè) |
| Từ dòng 13 | Các dòng dữ liệu: Stt · Nhóm · Mô tả · Mã IMPA · Đơn vị · Còn tồn đợt trước · Nhận trong kỳ · Tiêu thụ trong kỳ · Tồn trên tàu |
| Dòng 38–39 | Khối chữ ký (Máy trưởng/Đại phó · Sỹ quan · Phòng Kỹ thuật Vật tư · Thuyền trưởng) |

Quá 25 dòng thì code tự chèn thêm dòng và đẩy khối chữ ký xuống.

Biểu mẫu của công ty đổi bố cục thì soi lại bằng:

```
npx tsx scripts/kiem-bieu-mau-kiem-ke.ts [đường-dẫn-file]
```

Script in ra những gì đang nằm ở đúng các ô trên để so bằng mắt, rồi sửa tham chiếu ô trong
file route nói trên nếu lệch.
