---
name: tu-dien-song-ngu-mercury
description: "Từ điển song ngữ VI/EN và quy ước gọi tên của Mercury Materials: thêm/sửa khóa trong lib/i18n/dict, chạy bộ kiểm thử 1.600+ khóa (khớp khóa, tham số, rò chữ Việt sang EN), tìm chữ viết cứng trong .tsx, quy ước bốn từ 'vật tư & phụ tùng / vật tư / phụ tùng / mặt hàng', tên mục = chủ ngữ tiêu đề trang. Dùng khi thêm chữ mới lên giao diện, đổi nhãn/tiêu đề/menu, 'đồng bộ tên', 'dịch', 'tiếng Anh sai', 'chữ lệch giữa các trang', hoặc bộ kiểm thử ngôn ngữ trượt."
---

# Từ điển song ngữ Mercury Materials

## Cấu trúc
- Mỗi không gian tên một tệp: `lib/i18n/dict/{chung,menu,login,labels,dashboard,materials,inventory,requests,purchasing,paint,consumables,vessels,actions,...}.ts`, xuất `tuDien(vi, en)` — kiểu TypeScript ép khối EN có **đúng bộ khóa** của khối VI (thiếu/thừa là lỗi biên dịch).
- Server: `const { t, tTuDo, ngay, ngayGio, so, tenChucDanh } = await layT()`. Client (`"use client"`): `useNgonNgu()`.
- `t("ns.khoa", { n: 3 })` — khóa tĩnh, có kiểm kiểu. `tTuDo(chuỗi ghép)` — khóa động (ví dụ `labels.reqStatus_` + trạng thái), **không kiểm kiểu**, thiếu khóa thì hiện nguyên tên khóa.
- Cookie `lang` (vi|en), đổi qua GET `/api/ngon-ngu` (không phải server action — proxy ghi POST lạ như thử đăng nhập); Location trả về **tương đối** (Traefik).
- Chữ lưu trong DB (tên vật tư, ghi chú) không dịch. Tên biểu mẫu công ty (MLS-11-xx) và phòng ban giữ nguyên.

## Thêm chữ mới
1. Thêm khóa vào **cả hai** khối VI và EN cùng tệp không gian tên; đặt gần khóa cùng nhóm, có comment nhóm.
2. Dùng bằng `t("ns.khoa")`. Không viết chữ có dấu thẳng vào `.tsx` (trừ chứng từ in — bản sao form giấy).
3. Chạy bộ kiểm thử:
```powershell
node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-ngon-ngu.ts
```
Nó kiểm: khớp khóa, chuỗi rỗng, tham số `{x}` lệch giữa VI/EN, chữ Việt còn sót trong EN, và vài mẫu tra cứu. Nếu trượt vì **mẫu trong script kiểm thử lỗi thời** (ví dụ mẫu "Vật tư #{id}" sau khi đổi thành "Mặt hàng #{id}") thì sửa mẫu, không sửa từ điển cho khớp mẫu.

## Quy ước gọi tên (README, mục "Quy ước gọi tên")
| Từ | Nghĩa | Dùng ở |
|---|---|---|
| **vật tư & phụ tùng** | nhãn bao trùm gồm cả hai loại | menu, tiêu đề/phụ đề trang, KPI, tab "tất cả", liên kết tới trang |
| **vật tư** | loại Store — MLS-11-05B, mã IMPA | `labels.type_STORE`, tab theo loại, tên biểu mẫu |
| **phụ tùng** | loại Spare — MLS-11-05A, Part No, gắn thiết bị | `labels.type_SPARE`, "phụ tùng thiết yếu" |
| **mặt hàng** | một dòng bất kể loại | nhãn ô chọn, đầu cột, "Thêm/Sửa mặt hàng", câu đếm |
Câu văn dài (mô tả vai trò, thông báo lỗi, nhật ký) dùng "vật tư" nghĩa thường. Tên mục trên menu = chủ ngữ của tiêu đề trang (menu "Vật tư & phụ tùng" → trang "Danh mục vật tư & phụ tùng"). EN theo cặp: *stores & spare parts · stores · spare parts · item*.

## Tìm chữ viết cứng
```powershell
powershell -NoProfile -File .claude/skills/tu-dien-song-ngu-mercury/scripts/tim-chu-cung.ps1
```
Liệt kê chuỗi có dấu tiếng Việt trong `.tsx/.ts` ngoài `lib/i18n/dict`, bỏ qua các chứng từ in (FormDocHeader, requests/[id], purchasing/[id], reports) và comment.

## Đổi nhãn menu/tiêu đề: kiểm gãy dòng
Nhãn thanh bên dài hơn ~26 ký tự thường xuống hai dòng (đã thấy với "Dầu · Dầu nhờn · Hóa chất"). Sau khi đổi, báo `giao-dien` chụp thanh bên ở 1366 px cả VI lẫn EN.

## Tiếng Anh
Thuật ngữ hàng hải: *requisition* (yêu cầu vật tư), *ROB* (tồn), *receipt/issue* (nhập/xuất), *stores/spare parts*, *stock card* (thẻ kho), *vessel* (tàu), *master* (thuyền trưởng), *chief engineer* (máy trưởng). Không dịch kiểu máy: "Materials catalogue" thay vì "Materials list".
