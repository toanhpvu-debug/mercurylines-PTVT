---
name: giao-dien-mercury
description: "Giao diện Mercury Materials: bộ biến màu nền tối/sáng của Mercury Lines, tính tương phản WCAG cho từng biến chữ, cỡ chữ tối thiểu 13px, bộ thành phần ui.tsx, bẫy cn() không gộp lớp Tailwind và ô nhập w-full, chứng từ in .print-area luôn là tờ giấy trắng, quy trình chụp/đo DOM ở 800·1024·1366 px và mobile. Dùng khi 'sửa giao diện', 'chữ mờ/nhỏ/khó đọc', 'màu', 'nền tối', 'bảng gãy', 'bản in sai', 'thêm trang/thành phần mới', hoặc sau khi đổi globals.css/ui.tsx."
---

# Giao diện Mercury Materials

## Bộ biến (app/globals.css)
Mặt nền `--surface`, `--surface-raised`, `--surface-sunken`, `--surface-overlay`; viền `--border-subtle`; chữ `--text-primary/secondary/muted`; trạng thái `--tone-{neutral,brand,success,warning,danger,info,muted}-{bg,text}` (nền **đặc**, không bán trong suốt) và `--text-{success,warning,danger,info}` cho chữ trong bảng. Nền tối là mặc định (`:root.dark`, cookie `theme`); `@custom-variant dark` theo class — **không** theo `prefers-color-scheme`. `color-scheme` đặt theo `.dark` để `<select>`, thanh cuộn, ô ngày vẽ đúng.

Không viết màu thẳng (`bg-white`, `text-blue-950`, `ring-blue-100`). Thành phần chung: `PageHeader, Card, CardHeader, Stat, Badge, Button/buttonClass, Input/Select/Textarea/Field, TableWrap/Table/Th/Td/Tr/TrNhom, Notice, EmptyState, Meter, Avatar, DataRow` (`components/ui.tsx`, không hook); `Modal`, `PasswordInput` ở `ui-client.tsx`. Đầu `ui.tsx` có bảng đối chiếu lớp cũ → thành phần mới.

## Ngưỡng đọc được (đo bằng script, không ước lượng)
```powershell
powershell -NoProfile -File .claude/skills/giao-dien-mercury/scripts/tuong-phan.ps1
```
In tỷ lệ tương phản WCAG 2 của mọi biến chữ trên cả ba mặt nền và của chữ nhãn trên nền nhãn, hai chế độ. Ngưỡng dự án: chữ phụ ≥ 7,5; chữ mờ ≥ 7 (tối) / 6,2 (sáng); chữ trạng thái ≥ 6,5; chữ trên nhãn ≥ 6. Khi cần màu mới: giữ sắc, chỉ kéo độ sáng từng bước tới khi đạt ngưỡng (script có hàm `Fit`).

Cỡ chữ: `--text-xs` = 13px (đổi một biến là đổi 208 chỗ `text-xs`); trên màn hình **không** viết `text-[10px]`/`text-[11px]`; chứng từ in giữ 12px qua override trong `.print-area` và `@media print`.

## Hai bẫy đã trả giá
1. `cn()` (`lib/cn.ts`) chỉ nối chuỗi. Hai lớp Tailwind cùng nhóm thì **thứ tự trong tệp CSS** quyết định, không phải thứ tự trong `class=""` — `cn(FIELD, "w-64")` vẫn ra `w-full`. `Input/Select/Textarea` đã tự gỡ `w-full` khi có `w-*` riêng; thành phần mới phải xử lý tương tự hoặc đặt bề rộng ở wrapper.
2. Chứng từ in đặt lên nền tối thì viền đen chữ đen biến mất → bọc bằng `.print-area` (ghi đè biến sang màu giấy ở cả hai chế độ; `@media print` ẩn `aside`, `header.app-header`, `.app-motif`, `.no-print`). Biến `--tone-*`/`--text-success` **không** bị ghi đè trong `.print-area` — trong tờ in dùng cột riêng/chữ thường, không dùng Badge màu.

## Quy trình soát một trang
1. `resize_window` 1366×768 → `navigate` → `wait 4` → **đo DOM** bằng JS trong `references/do-dom.md` (phân bố cỡ chữ, màu, tràn ngang, chiều cao header, `colorScheme`).
2. Ảnh chụp 1:1 chỉ có ở viewport 800×500 — dùng khi cần nhìn nét chữ. Ảnh ở 1366 bị thu nhỏ, chỉ để xem bố cục.
3. Đổi chế độ bằng JS bấm nút `button[aria-label="Chuyển sang nền sáng"]` (tọa độ bấm không tin được khi giả lập viewport); cookie `theme` đổi theo; đo lại.
4. Mobile 375×812: ngăn kéo menu — **đo `getBoundingClientRect` của aside và lớp phủ**, ảnh chụp từng "trông" như chỉ phủ nửa màn hình trong khi DOM đủ 812px.
5. Trả viewport về `preset: "desktop"` khi xong.

## Chứng từ in
Nội dung MLS-11-05A/B, 11-01, 11-06, 11-13, PO/RFQ là bản sao form giấy: không đổi chữ, viền, bố cục. Cột số hiệu in **Part No. của hãng / mã IMPA**, không in mã nội bộ `E-SPR-0001` (hãng và cảng không biết mã đó); thiếu thì để trống.

## Báo cáo
`_workspace/01_giao-dien_phat-hien.md` theo mẫu chung; ảnh (nếu có) trong `_workspace/anh/`.
