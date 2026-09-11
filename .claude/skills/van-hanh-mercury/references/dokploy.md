# Dokploy — đọc trạng thái và bấm Deploy tay (Browser pane, bấm bằng JS)

Trang app: `http://187.127.120.10:3000/dashboard/project/qDm3kknV4hnz7GAggXuyA/environment/YA6GfGDSmSO-XZnEUJ62b/services/application/vWrs0r9lycrR_0cGp4nqm` (hoặc `/dashboard/projects` → bấm thẻ dự án → mục `mercury-app`).

## Đọc lượt deploy mới nhất
1. `find "Deployments"` → lấy ref của **tab** "Deployments" (không phải link ở sidebar) → `left_click` bằng ref (bấm `[role=tab]` bằng JS `.click()` không đổi tab).
2. Đọc:
```js
const t = document.body.innerText; const i = t.indexOf('1. '); const seg = t.substring(i, i + 400);
const j = seg.indexOf('\n2. '); const d1 = seg.slice(0, j > 0 ? j : 300);
JSON.stringify({ trangThai: (d1.match(/^1\. (\w+)/) || [])[1], commit: (d1.match(/Commit: ([0-9a-f]{7})/) || [])[1], thoiGian: (d1.match(/(\d+m \d+s)/) || [])[1] })
```

## Bấm Deploy tay (chỉ khi cần deploy lại cùng commit)
```js
const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Deploy');
if (!b) throw new Error('khong thay nut Deploy');
if (b.disabled) throw new Error('nut Deploy dang xam - co luot dang chay, doi');
b.click();
const t0 = Date.now(); let c = null;
while (Date.now() - t0 < 8000) { c = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Confirm'); if (c) break; await new Promise(r => setTimeout(r, 250)); }
if (!c) throw new Error('khong thay Confirm sau 8s'); c.click(); 'da bam Confirm'
```
Sau đó chờ ~100–140 giây rồi đọc lượt mới nhất như trên. Không bấm Deploy lần hai khi không thấy Confirm — kiểm `b.disabled` trước.
