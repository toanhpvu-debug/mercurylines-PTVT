---
name: kiem-toan-bao-mat-mercury
description: "Rà soát bảo mật Mercury Materials: npm audit và cách đọc advisory (gói chạy thật vs gói dev, đường khai thác thật), thăm dò chặn cửa mọi route/API khi chưa đăng nhập, matcher của proxy.ts và tệp tĩnh được miễn, header phản hồi, bí mật trong .env/log, file người dùng tải lên. Dùng khi có yêu cầu 'bảo mật', 'lỗ hổng', 'audit', 'phân quyền', 'ai vào được', 'an toàn chưa', trước khi mở app ra Internet, hoặc sau khi thêm route/API mới."
---

# Kiểm toán bảo mật Mercury Materials

## Quy tắc không thương lượng
- **Không in bí mật**: giá trị `DATABASE_URL`, `SESSION_SECRET`, `SEED_PASSWORD`, nội dung `pg-superuser.txt`, mật khẩu người dùng. Chỉ báo "có/không" hoặc độ dài. Tệp `.env` không nằm trong repo và không được commit.
- Không đăng nhập bằng mật khẩu thật của người dùng; Browser pane đã có phiên sẵn — dùng phiên đó.
- Không mở cổng DB ra ngoài, không chạy lệnh trong container, không đổi cài đặt Dokploy/Traefik. Thấy cần thì đề xuất kèm lệnh cho người dùng.

## 1. Thư viện: npm audit đọc cho đúng
```powershell
powershell -NoProfile -File .claude/skills/kiem-toan-bao-mat-mercury/scripts/npm-audit-tom-tat.ps1
```
Chạy `npm audit --omit=dev --json`, in số theo mức và từng advisory (gói, mức, dải phiên bản, tiêu đề, URL, cách sửa có đổi major không).

Cách xếp mức cho dự án này:
| Gói | Đường dữ liệu | Mức khi có advisory |
|---|---|---|
| `next`, `sharp` | mọi request từ Internet | P1 — vá ngay (đã gặp: RCE trên máy chủ Windows, 09/2026) |
| `xlsx`, `exceljs`, đọc PDF/OCR | file người dùng tải lên ở /materials/import, /paint/import, /consumables | P1–P2 (cần tài khoản để tải lên) |
| `prisma` CLI, `eslint`, `tsx` | chỉ lúc build/dev | P3 — ghi nhận, không ép |
`xlsx` trên registry npm kẹt ở 0.18.5 (có lỗi); bản vá lấy từ kho chính thức SheetJS: `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Nâng gói: **dừng app trước** (postinstall `prisma generate` bị EPERM khi app chạy).

## 2. Chặn cửa: thăm dò thật, không đọc mã suông
```powershell
powershell -NoProfile -File .claude/skills/kiem-toan-bao-mat-mercury/scripts/tham-do-chan-cua.ps1
```
(Mặc định thăm dò site thật — địa chỉ đọc từ `..\dia-chi-may-chu.local.md`, ngoài repo; `-Goc http://localhost:3000` cho bản cục bộ.)
Mọi trang trong `app/(app)/` phải 307 về `/login?next=…`; mọi `app/api/*` phải 401/307; tệp tĩnh (`/fonts/*.woff2`, `/motif-ring.svg`, `/favicon.svg`) phải 200. Thêm route mới → thêm vào danh sách trong script.

Bộ chặn cửa là `proxy.ts` với `matcher` loại trừ tệp tĩnh theo đuôi. Thiếu đuôi = tệp bị chuyển hướng về login (đã gặp với `.woff2`: trang đăng nhập rơi về phông hệ thống). Thêm loại tệp tĩnh mới thì thêm đuôi vào matcher.

## 3. Phân quyền theo chức danh
Danh sách vai trò và phép ở `lib/roles.ts`; server action kiểm bằng `requireActiveRole([...])` và phạm vi tàu bằng `trongPhamVi(scope, vesselId)`. Kiểm chéo: form hiện nút cho ai (`canTransact`, `danhTinhHieuLuc`) phải khớp danh sách vai trò trong action tương ứng — UI ẩn nút không phải là bảo vệ. Bộ kiểm thử `kiem-tra-phan-quyen` (549 phép thử) chạy được không cần DB:
```powershell
node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-phan-quyen.ts
```
Trang chi tiết nhận id từ URL phải kiểm phạm vi và trả `notFound()` cho id ngoài phạm vi (không lộ là tồn tại) — mẫu ở `app/(app)/inventory/stock-card/page.tsx`.

## 4. Header và cookie
`poweredByHeader: false` trong `next.config.ts`. Cookie phiên: HttpOnly, SameSite, Secure khi HTTPS (`COOKIE_SECURE`). Chống dò mật khẩu ở `/login`: `lib/chanDangNhap.ts`. Đường dẫn quay lại sau đăng nhập đi qua `safeNextPath` (chỉ nhận `/...` nội bộ).

## 5. File tải lên
Giới hạn 20–25 MB (`bodySizeLimit` và kiểm ở action); lưu bằng tên ngẫu nhiên trong `UPLOAD_DIR`, không dùng tên gốc làm đường dẫn; tải về qua API có kiểm phiên; hồ sơ báo cáo bất biến kèm SHA-256.

## Báo cáo
`_workspace/01_bao-mat_phat-hien.md` theo mẫu chung; mỗi mục có bằng chứng là **lệnh và kết quả**, không phải nhận định.
