---
name: do-hieu-nang-mercury
description: "Đo và tối ưu hiệu năng của Mercury Materials: kích thước chunk JS và chunk chứa gì, header cache/preload của tệp tĩnh, thời gian server từng trang, số truy vấn Prisma, resource timing trên trình duyệt, RAM của node. Dùng khi có yêu cầu 'tối ưu', 'chạy mượt', 'trang chậm', 'nặng', 'tải lâu', 'cache', 'bundle', 'truy vấn chậm', 'đo hiệu năng', hoặc sau khi thêm trang/thư viện mới. Không dùng cho việc chỉ dọn đĩa/RAM máy (đó là van-hanh-mercury)."
---

# Đo hiệu năng Mercury Materials

Nguyên tắc duy nhất: **không sửa thứ chưa đo**. Trước khi nói "chậm", phải có số; sau khi sửa, đo lại cùng cách. Các số đo nền (09/2026) ghi ở cuối để biết cái gì là bình thường.

## 1. Chunk JS: cái gì nằm trong bundle
```powershell
powershell -NoProfile -File .claude/skills/do-hieu-nang-mercury/scripts/phan-tich-chunk.ps1
```
In 6 chunk lớn nhất trong `.next/static/chunks`, tổng dung lượng, và chunk nào chứa các dấu hiệu đáng ngờ (từ điển, xlsx, pdf). Dấu hiệu tự thêm bằng `-DauHieu "chuoi1","chuoi2"`.

Đọc kết quả thế nào: chunk ~229 KB (70 KB nén) là runtime React + Next — bình thường. Chunk ~174 KB chứa chuỗi tiếng Việt là **từ điển hai ngôn ngữ**; đã cân nhắc và **cố ý để nguyên** (client dùng 563 khóa cố định + 17 khóa động nên tách tĩnh không an toàn; chunk cache một năm). Thư viện Excel/PDF mà lọt vào chunk client mới là lỗi — chúng chỉ được import trong `lib/*` chạy server.

## 2. Header của tệp tĩnh và trang
```powershell
powershell -NoProfile -File .claude/skills/do-hieu-nang-mercury/scripts/kiem-tra-header.ps1
```
(Mặc định đo site thật — địa chỉ đọc từ `..\dia-chi-may-chu.local.md`, tệp cục bộ ngoài repo; `-Goc http://localhost:3000` để đo bản cục bộ.)
Kỳ vọng: `/_next/static/*` và `/fonts/*` → `max-age=31536000, immutable`; hai SVG → `max-age=86400, stale-while-revalidate`; `/login` có header `Link:` mang hai preload phông; **không** có `X-Powered-By`. Lệch là phát hiện P1 (mỗi lần mở trang mất một vòng đi-về cho mỗi tệp).

Vì sao preload phông nằm ở **header HTTP `Link:`** chứ không phải thẻ `<link>` trong HTML: Next truyền `onHeaders` cho React. Tìm trong HTML sẽ không thấy và tưởng hỏng.

## 3. Thời gian server và resource timing (cần đăng nhập)
Dùng Browser pane (đã đăng nhập localhost:3000) với các đoạn JS trong `references/do-tren-trinh-duyet.md`: thời gian server (`responseStart − requestStart`), tổng byte theo loại, mỗi tệp phông đúng một dòng (preload sai CORS thì tải kép), phân bố cỡ chữ.

Lần đầu sau khởi động luôn chậm (nguội: 357 ms) — đo tối thiểu ba lần, lấy hai lần sau.

### Bảng dài: đếm nút DOM và ghi vết trước khi đoán (bài học 2026-10-17)
- Chi phí mở trang có bảng dài nằm ở **tính kiểu + bố cục + vẽ + dựng chữ, tỷ lệ với số nút DOM** — ghi vết /materials (CPU 4×): ~2,9 s vẽ giao diện so với ~1 s JS. Nên trước hết đếm nút theo cột (`[...tr.cells].map(c => c.getElementsByTagName("*").length)`): lượt này cột Thao tác chiếm 33/57 nút mỗi dòng.
- Đo trên máy chậm bằng `Emulation.setCPUThrottlingRate {rate: 4}` (máy tàu cũ) và chia việc luồng chính bằng DevTools Tracing (`Tracing.start` → `IO.read` → cộng self-time theo tên sự kiện: `Document::recalcStyle`, `LocalFrameView::performLayout`, `Paint`, `FunctionCall` theo tệp chunk…). Event Timing đo trong Edge chạy ngầm có thể báo trễ phím vài trăm ms giả — tin ghi vết.
- **lucide-react 1.x là thành phần client** (`"use client"`, đọc context mỗi lần vẽ): biểu tượng trong mỗi dòng bảng là hàng trăm thành phần phải hydrate → bảng dài dùng nét vẽ một lần + `<use>` (`components/BieuTuongThaoTac.tsx`).
- Nút / ô nhập từng dòng: HTML do server vẽ + MỘT thành phần client nghe sự kiện cho cả bảng (`ThaoTacDongDanhMuc`, `ChonHangLoat`) thay vì một thành phần client mỗi dòng. Bảng client có state cả bảng: dòng `memo` so theo giá trị (`BangKiemKe` → `DongBang`).
- React chia luồng RSC thành mẩu ~3 KB: bảng càng to càng nhiều "đoạn" `$RS()` + `<table hidden>` rỗng để lại (thống kê 500 dòng: 512 đoạn) — giảm số ô là giảm luôn khoản này.
- Leader đo trang cần đăng nhập trên bản sao dữ liệu thật (orchestrator Phase 2). Chạy node từ Git Bash với tham số `"/materials"` → MSYS đổi thành đường dẫn Windows: luôn `MSYS_NO_PATHCONV=1`. KhungBang lưu cỡ chữ trong localStorage — xóa (`Storage.clearDataForOrigin`) trước mỗi lần đo.

## 4. Truy vấn Prisma
Tìm N+1: `await` trong vòng `map`/`for` gọi `prisma.*` → gom bằng `findMany({ where: { id: { in } } })` hoặc **một câu SQL `DISTINCT ON`** như `lib/theKho.ts`. Tìm truy vấn tuần tự có thể song song: nhiều `await prisma` liên tiếp không phụ thuộc nhau → `Promise.all`. Kiểm bằng:
```powershell
Select-String -Path app,lib -Pattern "await prisma\." -Recurse | Group-Object Path | Sort-Object Count -Descending | Select-Object -First 8
```
`getCurrentUser` đã bọc `cache()` — layout và trang không hỏi user hai lần. Chỉ mục: schema đã có index cho mọi khóa ngoại và cột lọc; thêm cột lọc mới thì thêm `@@index`.

## 5. Không đề xuất lại
Đã cân nhắc và loại (lý do trong commit `git log --grep="KHÔNG làm"` và README): tách từ điển client; `output: "standalone"` (entrypoint cần prisma CLI + tsx); nâng `staleTimes` (app không có `revalidatePath` nhất quán); xóa `.next/cache` (làm build chậm hơn).

## Số đo nền (09/2026, cập nhật 10/2026 — để so sánh)
| Chỉ số | Giá trị |
|---|---|
| RTT PC → VPS | ~58 ms; TTFB curl gồm TLS ~220 ms |
| Server /materials, /inventory (ấm) | 20–25 ms (09/2026); 10/2026 với 780 mặt hàng: tải trọn HTML 130–220 ms |
| JS mỗi trang | ~212 KB nén (09/2026) → 266–281 KB nén, 11–13 tệp (10/2026; chunk từ điển 355 KB thô / 106 KB nén) |
| Bảng dài (10/2026, sau tối ưu) | /materials quản trị 7.729 nút DOM, bấm được ~2,8 s ở CPU 4×; /inventory/thong-ke 3.030 nút |
| Vệ tinh giả lập (700 ms, 1 Mbps), thuyền viên | mở lại trang 0,9–1,5 s; lần đầu / sau triển khai (cache trống) ~4,8 s, 380–440 KB |
| RAM node app | ~120–130 MB; PostgreSQL ~60 MB |
| Build cục bộ | 8–40 giây; deploy Dokploy ~1 phút 15–1 phút 40 |

## Báo cáo
Ghi vào `_workspace/01_hieu-nang_phat-hien.md` theo `.claude/skills/toi-uu-mercury/references/mau-phat-hien.md`. Mỗi mục có số trước/sau kỳ vọng và lệnh đo lại.
