---
name: van-hanh-mercury
description: "Vận hành Mercury Materials: khởi động/dừng/build lại app ngầm trên máy văn phòng Windows (Task Scheduler MercuryMaterials, cờ dừng dung.flag, vòng tự chạy lại), PostgreSQL xách tay, log, sao lưu/khôi phục (ổ G:), dọn rác (don-dep), cài đặt nguồn; triển khai Dokploy (autodeploy qua webhook khi push main, bấm Deploy tay, đọc tab Deployments), xác minh site thật. Dùng khi 'khởi động lại', 'build lại', 'app không lên', 'đẩy lên mạng', 'deploy', 'kiểm tra server', 'sao lưu', 'dọn rác', 'giải phóng bộ nhớ', 'cổng 3000 bị chiếm'."
---

# Vận hành Mercury Materials

## Máy văn phòng (Windows, chạy ngầm)
- Việc Task Scheduler `MercuryMaterials` (đăng nhập là chạy, không giới hạn thời gian, `IgnoreNew`, `RestartCount 3`) → `scripts/chay-nen.ps1` (log `..\app-logs\app.log`, xoay ở 5 MB) → `scripts/chay-app.ps1` (tìm Node, kiểm `.env`, bật hộ PostgreSQL xách tay `..\pgsql`/`..\pgdata`, build lại nếu nguồn mới hơn `.next/BUILD_ID`, rồi `next start` trong **vòng tự-chạy-lại**).
- **Dừng đúng cách**: `scripts/dung-app.ps1` — đặt `..\app-logs\dung.flag` rồi tắt node. Giết node trần thì vòng lặp bật lại sau 5 giây và **không build lại**.
- **Build lại / khởi động lại** (một lệnh, tự chờ tới khi phục vụ):
```powershell
powershell -NoProfile -File .claude/skills/van-hanh-mercury/scripts/build-lai.ps1
```
Nó dừng bằng cờ → chờ việc về `Ready` → `schtasks /Run` → chờ "Ready in" trong log → thăm dò `/login` 200, `/dashboard` 307. Build chỉ chạy khi nguồn đổi (app/, components/, lib/, prisma/, public/, next.config.ts, proxy.ts…). Build hỏng thì script đã xóa `BUILD_ID`; đọc 30 dòng cuối `app.log`.
- `npm install` khi app chạy → `EPERM` ở `prisma generate` (Windows khóa `query_engine-windows.dll.node`). Dừng app → cài → `npx prisma generate` → chạy lại.
- Log: mở ở chế độ chia sẻ, đọc bằng `[IO.File]::Open(..., 'ReadWrite')` (Get-Content thường bị khóa).
- RAM bình thường: node ~120–130 MB, PostgreSQL ~60 MB. Máy tự ngủ là app "chập chờn": `powercfg /change standby-timeout-ac 0` — cài đặt hệ thống, **người dùng tự chạy**.

## Sao lưu / khôi phục / dọn rác
- `sao-luu-du-lieu.cmd`: pg_dump + uploads + .env + biểu mẫu → zip kèm vân tay; chỗ để do `scripts/lib-sao-luu.ps1` tìm (BACKUP_DIR → thư mục có sẵn → đĩa vật lý khác, ghi thử). Trên máy này C: và D: là một ổ NVMe; **G:** là đĩa riêng. `khoi-phuc-du-lieu.cmd` chụp đường lùi trước khi ghi đè.
- `don-dep.cmd`: cache npm (`_cacache`, không đụng `_npx`), log đời trước, tệp tạm; `-CaCacheBuild` xóa `.next\cache`. Không tự xóa pgAdmin (673 MB) hay tệp .rar cũ — chỉ liệt kê.
- Khôi phục dữ liệu lên server: `D:\mercurylines code\khoi-phuc-len-server.cmd` (người dùng chạy, gõ mật khẩu SSH).

## Triển khai Dokploy (VPS 187.127.120.10, site https://srv1964387.hstgr.cloud)
- **Push lên `main` là tự deploy** (webhook GitHub → Dokploy, ~1 phút 40). Không bấm Deploy sau push: nút xám nghĩa là đang build; bấm thêm chỉ xếp hàng lượt hai.
- Xác minh site thật:
```powershell
powershell -NoProfile -File .claude/skills/van-hanh-mercury/scripts/kiem-tra-site-that.ps1
```
(`/login` 200 + `class="dark"` + logo SVG; `/dashboard` 307; API 401; phông 200 immutable; header `Link` preload; không `X-Powered-By`; tệp đã xóa 404.) Để biết **bản mới đã lên chưa**: kiểm một dấu hiệu chỉ commit mới mới có (giá trị CSS mới, header mới, route mới), rồi đọc tab Deployments: `1. Done` + 7 ký tự commit — quy trình bấm/đọc trong `references/dokploy.md`.
- Bấm Deploy tay chỉ để deploy lại cùng commit; quy trình JS trong `references/dokploy.md` (chờ hộp Confirm tới 8 giây; nếu nút Deploy đã xám thì có lượt đang chạy — đợi).
- Server có "Daily Docker Cleanup" bật sẵn. Ổ đĩa/RAM xem ở Web Server → Space / Monitoring.
- **Không bao giờ**: mở External Port của DB, chạy lệnh trong Docker Terminal, in `DATABASE_URL`/mật khẩu. Việc trên VPS → soạn `.cmd` cho người dùng chạy.

## Báo cáo
Kiểm toán → `_workspace/01_van-hanh_phat-hien.md`; thực thi → `_workspace/06_van-hanh_ket-qua.md` (lệnh, kết quả, mã commit đã lên, các kiểm tra site thật).
