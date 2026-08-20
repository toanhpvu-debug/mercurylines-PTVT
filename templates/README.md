# Thư mục biểu mẫu

Chức năng **Xuất kiểm kê MLS-11-06** điền dữ liệu vào chính file Excel biểu mẫu của công ty
để giữ nguyên định dạng, logo và khối chữ ký.

File biểu mẫu là tài liệu nội bộ của từng công ty nên **không được đưa vào repo công khai**
(`templates/*.xlsx` đã nằm trong `.gitignore`).

## Cách cài đặt

Chép file biểu mẫu Excel của công ty bạn vào đây với đúng tên:

```
templates/MLS-11-06.xlsx
```

Thiếu file này thì mọi chức năng khác vẫn chạy bình thường, chỉ riêng nút
"⬇ Xuất kiểm kê MLS-11-06" báo lỗi nhắc chép file vào.

## Cấu trúc ô mà code ghi vào

`app/api/export/inventory/route.ts` ghi theo các ô cố định của form gốc:

| Ô | Nội dung |
|---|---|
| `C7` | Tên tàu |
| `H7` | Ngày xuất báo cáo |
| `C8` | Loại vật tư (Tất cả / Store / Spare) |
| Từ dòng 11 | Các dòng dữ liệu: Nhóm · Mô tả · IMPA · Đơn vị · Còn tồn đợt trước · Nhận trong kỳ · Tiêu thụ trong kỳ · Tồn trên tàu |

Quá 25 dòng thì code tự chèn thêm dòng và đẩy khối chữ ký xuống.
Nếu biểu mẫu của bạn bố trí ô khác, sửa lại các tham chiếu ô trong file route nói trên.

## Triển khai bằng Docker

`Dockerfile` copy cả thư mục dự án nên chỉ cần đặt file vào `templates/` trước khi build.
Nếu build từ repo sạch (không có file), hãy mount vào container:

```yaml
volumes:
  - ./templates/MLS-11-06.xlsx:/app/templates/MLS-11-06.xlsx:ro
```
