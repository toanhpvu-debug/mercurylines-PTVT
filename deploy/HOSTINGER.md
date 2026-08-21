# Triển khai Mercury Materials lên Hostinger

## Chọn gói nào

Hostinger có 2 đường chạy Node.js. Với app này, **chỉ VPS là chạy được đúng**:

| Gói | Chạy được không | Lý do |
|---|---|---|
| Shared / Business / Cloud (Node.js quản lý sẵn) | ⚠️ Rủi ro | Có hỗ trợ Next.js, nhưng app dùng **SQLite ghi thẳng ra file** và lưu file báo cáo tải lên. Mỗi lần deploy lại, thư mục ứng dụng bị dựng lại — nguy cơ **mất toàn bộ dữ liệu vận hành**. Không có volume bền vững để đảm bảo. |
| **VPS (template Docker)** | ✅ Nên dùng | Có ổ đĩa bền vững, chạy được `docker compose`. Dự án đã có sẵn `Dockerfile` + entrypoint tự chạy migration và seed. |
| Agency Hosting | ❌ | Chỉ dành cho web tĩnh. |

Gói VPS nhỏ nhất (1 vCPU / 4 GB RAM) là đủ. RAM cần chủ yếu cho bước `next build`.

---

## Bước 1 — Tạo VPS và cài Docker

1. Vào **hPanel** → **VPS** → **Manage** ở VPS của bạn
2. Menu trái: **OS & Panel** → **Operating System**
3. Chọn tab **Application** → **Docker** → bấm **Change OS**
4. Chờ khoảng 10 phút. Xong thì Docker và Docker Compose đã có sẵn.

Ghi lại **IP của VPS** và **mật khẩu root** (hPanel có mục đổi mật khẩu root và bật SSH key).

Kiểm tra bằng SSH:

```bash
ssh root@IP_CUA_VPS
docker compose version
```

---

## Bước 2 — Trỏ tên miền về VPS

Ở nơi quản lý DNS của tên miền, tạo bản ghi:

```
Loại: A      Tên: vattu      Trỏ tới: IP_CUA_VPS      TTL: 300
```

**Làm bước này trước và chờ DNS lan truyền** (5–30 phút). Nếu tên miền chưa trỏ đúng,
Let's Encrypt sẽ không cấp được chứng chỉ HTTPS ở bước 5.

Kiểm tra: `ping vattu.tenmiencuaban.com` phải ra đúng IP VPS.

---

## Bước 3 — Lấy mã nguồn về VPS

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/toanhpvu-debug/mercurylines-PTVT.git mercury-materials
cd mercury-materials
```

---

## Bước 4 — Chép 1 file không có trong repo

Biểu mẫu Excel gốc của công ty **cố ý không nằm trên GitHub** (repo public). Phải chép tay.

Chạy lệnh này **từ máy Windows của bạn** (PowerShell, không phải trên VPS):

```bash
scp "E:\software\mercury-materials\templates\MLS-11-06.xlsx" root@IP_CUA_VPS:/opt/mercury-materials/templates/
```

⚠️ **Bắt buộc làm trước bước 5.** Nếu thiếu file này, Docker sẽ tự tạo một *thư mục* rỗng
trùng tên và app báo lỗi rất khó hiểu.

Kiểm tra trên VPS: `ls -la /opt/mercury-materials/templates/` phải thấy file `.xlsx` chứ không phải thư mục.

---

## Bước 5 — Điền cấu hình

Trên VPS:

```bash
cd /opt/mercury-materials/deploy
cp env.hostinger.example .env
nano .env
```

Điền tối thiểu 4 dòng:

| Biến | Giá trị |
|---|---|
| `DOMAIN` | `vattu.tenmiencuaban.com` (đúng tên miền đã trỏ ở bước 2) |
| `ACME_EMAIL` | email của bạn |
| `SEED_PASSWORD` | mật khẩu ban đầu cho 3 tài khoản mẫu — **đổi ngay sau khi đăng nhập** |
| `FORM_MLS_*` / `FORM_NAVIS_*` | thông tin công ty in trên PO/RFQ (chép từ `.env` ở máy bạn) |

Lưu bằng `Ctrl+O` → `Enter` → `Ctrl+X`.

---

## Bước 6 — Chạy

```bash
cd /opt/mercury-materials/deploy
docker compose -f docker-compose.hostinger.yml up -d --build
```

Lần đầu mất khoảng 5–10 phút (cài package + `next build`). Theo dõi:

```bash
docker compose -f docker-compose.hostinger.yml logs -f
```

Chờ tới khi thấy `Ready in ...`. Bấm `Ctrl+C` để thoát xem log (container vẫn chạy).

Mở trình duyệt: **https://vattu.tenmiencuaban.com**

Đăng nhập `admin@example.com` với mật khẩu `SEED_PASSWORD` bạn vừa đặt →
**vào ngay trang Người dùng đổi mật khẩu cả 3 tài khoản.**

---

## Vì sao bắt buộc phải có HTTPS

App đặt cookie phiên với `secure: true` khi `NODE_ENV=production` (xem `lib/session.ts`).
Trình duyệt **không gửi cookie secure qua HTTP thuần**, nên nếu bạn truy cập bằng
`http://IP_VPS:3000` thì đăng nhập sẽ có vẻ thành công rồi lập tức quay lại trang login —
một vòng lặp rất khó đoán nguyên nhân.

Cấu hình kèm theo đã dựng sẵn **Caddy** làm reverse proxy, tự xin và tự gia hạn chứng chỉ
Let's Encrypt. Bạn không phải làm gì thêm ngoài việc trỏ đúng DNS.

Nếu bắt buộc phải chạy tạm bằng IP không có tên miền, thêm `COOKIE_SECURE: "false"` vào mục
`environment` của service `web`. **Chỉ dùng để thử**, vì lúc đó cookie phiên truyền không mã hóa.

---

## Dữ liệu nằm ở đâu

Toàn bộ dữ liệu vận hành nằm trong Docker volume `deploy_mercury-data`:

```
/data/mercury.db        database: tồn kho, yêu cầu, đơn mua, tài khoản
/data/uploads/          file báo cáo tàu tải lên
/data/.session-secret   khóa ký cookie (tự sinh nếu không đặt)
/data/.seeded           dấu hiệu đã seed — có file này thì lần khởi động sau không seed lại
```

Volume **không bị xóa** khi `docker compose down` hay rebuild. Chỉ mất nếu bạn chạy
`docker compose down -v` — hãy nhớ chữ `-v` này.

---

## Cập nhật khi sửa code

Trên máy bạn: bấm đúp `dong-bo-github.cmd` để đẩy thay đổi lên GitHub. Sau đó trên VPS:

```bash
cd /opt/mercury-materials
git pull
cd deploy
docker compose -f docker-compose.hostinger.yml up -d --build
```

Dữ liệu giữ nguyên vì nằm trong volume, không nằm trong image.

---

## Sao lưu dữ liệu trên VPS

Đặt lịch chạy hằng ngày lúc 2 giờ sáng:

```bash
mkdir -p /opt/backup
crontab -e
```

Thêm dòng:

```
0 2 * * * docker run --rm -v deploy_mercury-data:/data -v /opt/backup:/backup alpine tar czf /backup/mercury-$(date +\%Y\%m\%d).tar.gz -C /data . && find /opt/backup -name 'mercury-*.tar.gz' -mtime +30 -delete
```

Lệnh này nén cả database lẫn file upload, và tự xóa bản sao lưu quá 30 ngày.
Nên tải định kỳ một bản về máy: `scp root@IP_CUA_VPS:/opt/backup/mercury-*.tar.gz .`

Kiểm tra tên volume thực tế bằng `docker volume ls` (thường là `deploy_mercury-data`).

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Đăng nhập xong quay lại trang login | Đang vào bằng HTTP hoặc IP. Phải dùng HTTPS + tên miền. |
| Caddy báo lỗi xin chứng chỉ | DNS chưa trỏ đúng, hoặc cổng 80/443 bị firewall chặn. Mở firewall trong hPanel. |
| Nút "Xuất kiểm kê MLS-11-06" báo lỗi | Chưa chép `templates/MLS-11-06.xlsx` lên VPS (bước 4). |
| Đầu chứng từ PO/RFQ ra thông tin mẫu | Thiếu biến `FORM_*` lúc seed lần đầu. Sửa trực tiếp tại `/purchasing/forms`. |
| Build bị kill giữa chừng | Hết RAM. Tạm bật swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |
| Xem log | `docker compose -f docker-compose.hostinger.yml logs -f web` |
