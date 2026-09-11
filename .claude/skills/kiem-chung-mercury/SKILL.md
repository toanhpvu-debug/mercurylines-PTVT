---
name: kiem-chung-mercury
description: "Kiểm chứng Mercury Materials trước khi commit/deploy: một lệnh chạy tsc, eslint, sáu bộ kiểm thử (từ điển, mã vật tư, phân quyền, mẫu danh mục, đồng bộ, đọc phiếu); và các phép KIỂM CHÉO mặt tiếp giáp — khóa từ điển dùng trong .tsx có tồn tại, tên trường form khớp server action, colSpan khớp số cột, liên kết trỏ tới route có thật. Dùng sau mọi lần sửa mã, khi được hỏi 'kiểm tra lại', 'chạy test', 'có lỗi không', 'trước khi đẩy lên', hoặc khi nghi 'mỗi phần đúng mà ghép lại sai'."
---

# Kiểm chứng Mercury Materials

Thứ tự: **kiểm chéo mặt tiếp giáp** trước (lỗi thật của dự án đều ở chỗ ghép), rồi bộ kiểm chứng máy, rồi build và smoke. Kết luận chỉ có XANH hoặc ĐỎ.

## 1. Bộ kiểm chứng máy — một lệnh
```powershell
powershell -NoProfile -File .claude/skills/kiem-chung-mercury/scripts/kiem-chung-nhanh.ps1
```
tsc → eslint (app, components, lib, scripts, proxy.ts, next.config.ts) → sáu bộ kiểm thử (mỗi bộ in dòng `TONG: x dat / y truot`). Dừng ở bước đầu tiên trượt và in 12 dòng cuối. Không đụng database (các bộ kiểm thử đều thuần). Build và smoke: dùng `build-lai.ps1` của `van-hanh-mercury` (build cục bộ 8–20 giây).

Số kỳ vọng (09/2026): từ điển 1625, mã vật tư 261, phân quyền 549, mẫu danh mục 40, đồng bộ 154, đọc phiếu 7 — con số tăng khi thêm khóa/phép thử, **giảm** là dấu hiệu có bộ bị bỏ sót.

## 2. Kiểm chéo mặt tiếp giáp
| Mặt tiếp giáp | Cách so |
|---|---|
| Khóa từ điển ↔ `.tsx` | `powershell -NoProfile -File .claude/skills/kiem-chung-mercury/scripts/doi-chieu-khoa-tu-dien.ps1` — trích mọi `t("ns.khoa")`/`tTuDo("ns.khoa")` tĩnh và so với khối VI của `dict/ns.ts` |
| Form ↔ server action | grep `name="…"` trong form (`components/*Form*.tsx`) và `formValues(formData, [...])` + `formData.get("…")` trong `app/*actions.ts` của action tương ứng; tên phải khớp từng chữ, kể cả `returnTo` |
| Bảng | `powershell -NoProfile -File .claude/skills/kiem-chung-mercury/scripts/kiem-colspan.ps1` — mỗi tệp: số `<Th` trong `<thead>` và các `colSpan={n}`; `n` không bằng số cột nào là lệch |
| Liên kết ↔ route | grep `href="/` trong app/components → mỗi đường dẫn (bỏ query) phải có `app/(app)/<đường dẫn>/page.tsx` hoặc là `/login`, `/api/...` |
| Chứng từ in | với mỗi cột trên form (`<th>` chữ song ngữ) đọc ô `<td>` tương ứng: trường dữ liệu có đúng nghĩa cột không (số hiệu = Part No./IMPA, không phải `material.code`) |
| Bộ chặn cửa ↔ tệp tĩnh | `tham-do-chan-cua.ps1` của skill bảo mật: tệp trong `public/` phải 200 khi chưa đăng nhập |
| Theme ↔ in | trong `.print-area` không dùng `Badge`/`--tone-*`/`--text-success` (không bị ghi đè sang màu giấy) |

## 3. Sau khi sửa dữ liệu hoặc truy vấn
Đếm dòng các bảng chính trước/sau (không cần in nội dung): Material, Inventory, InventoryTransaction, MaterialRequest, PurchaseOrder. Thay đổi ngoài ý muốn = ĐỎ.

## 4. Kết luận
Ghi `_workspace/05_qa_ket-qua.md`: bảng đạt/trượt/chưa kiểm; mỗi trượt kèm tệp:dòng + cách sửa. **XANH — được deploy** chỉ khi: kiểm chéo không lệch, bộ máy 0 lỗi, build xong, smoke đúng (200/307/401). Không sửa mẫu trong kiểm thử để "cho xanh" trừ khi mẫu lỗi thời và ghi rõ vì sao.
