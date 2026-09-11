# Đo DOM trên Browser pane

## Phân bố cỡ chữ, màu, ô nhập (một trang)
```js
const els = [...document.querySelectorAll('body *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
const sizes = {}, colors = {};
for (const e of els) { const s = getComputedStyle(e); sizes[s.fontSize] = (sizes[s.fontSize] || 0) + 1; colors[s.color] = (colors[s.color] || 0) + 1; }
JSON.stringify({ theme: document.documentElement.className, textElements: els.length,
  bySize: Object.entries(sizes).sort((a,b)=>b[1]-a[1]).slice(0,7), byColor: Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,6),
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
  scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth })
```
Kỳ vọng: 12px không xuất hiện (13px thay); không tràn ngang (`scrollX: false`); `colorScheme` khớp class.

## Đổi chế độ sáng/tối (không dùng tọa độ)
```js
const b = document.querySelector('button[aria-label="Chuyển sang nền sáng"], button[aria-label="Switch to light mode"]'); b.click();
await new Promise(r => setTimeout(r, 300)); document.documentElement.className || '(light)'
```

## Ngăn kéo mobile (375×812) — đo, đừng tin ảnh
```js
const wrap = document.querySelector('.fixed.inset-0.z-40'); const drawer = wrap?.querySelector('aside');
const r = el => el ? (b => ({ t: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }))(el.getBoundingClientRect()) : null;
JSON.stringify({ viewport: { w: innerWidth, h: innerHeight }, wrap: r(wrap), drawer: r(drawer) })
```

## Bảng: số cột đầu bảng và colSpan
```js
JSON.stringify([...document.querySelectorAll('table')].map(t => ({ th: t.querySelectorAll('thead th').length,
  colSpans: [...new Set([...t.querySelectorAll('[colspan]')].map(c => +c.getAttribute('colspan')))] })))
```

## Header thanh trên có xuống dòng không (1024 px)
```js
const hdr = document.querySelector('header.app-header'); const p = hdr && [...hdr.querySelectorAll('p')].find(p => /Phạm vi|Scope/.test(p.textContent));
JSON.stringify({ headerH: hdr && Math.round(hdr.getBoundingClientRect().height), roleLines: p && Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)) })
```
