# Đoạn JS đo trên Browser pane (đã đăng nhập)

Chạy bằng `javascript_tool` sau khi `navigate` + `wait 3-4s`. Đo tối thiểu ba lần; lần đầu sau khởi động là nguội.

## Thời gian server + byte theo loại + số tệp
```js
const nav = performance.getEntriesByType('navigation')[0];
const res = performance.getEntriesByType('resource');
const sum = {};
for (const r of res) {
  const k = r.initiatorType === 'script' ? 'js' : r.name.endsWith('.css') ? 'css'
        : r.name.includes('/fonts/') ? 'font' : r.name.endsWith('.svg') ? 'svg' : 'other';
  sum[k] = sum[k] || { n: 0, bytes: 0 }; sum[k].n++; sum[k].bytes += r.transferSize || r.encodedBodySize || 0;
}
JSON.stringify({ page: location.pathname, serverMs: Math.round(nav.responseStart - nav.requestStart),
  domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), htmlBytes: nav.transferSize, resources: sum })
```

## Mỗi tệp phông đúng một dòng (preload sai CORS thì hai dòng)
```js
await document.fonts.ready;
const by = {};
for (const r of performance.getEntriesByType('resource').filter(r => r.name.includes('/fonts/'))) {
  const f = r.name.split('/').pop(); by[f] = by[f] || []; by[f].push({ initiator: r.initiatorType, transfer: r.transferSize, startMs: Math.round(r.startTime) });
}
JSON.stringify({ fonts: by, manropeReady: document.fonts.check('16px Manrope') })
```
`initiator: "link"` = nhờ preload; `"css"` = trình duyệt tự phát hiện sau khi đọc CSS (chậm hơn một vòng đi-về).

## Chunk JS trang này đang tải
```js
JSON.stringify(performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script')
  .map(r => ({ f: r.name.split('/').pop(), kb: Math.round((r.transferSize || r.encodedBodySize) / 1024) })).sort((a, b) => b.kb - a.kb))
```
