"use client";

import { preload } from "react-dom";

/**
 * Hai tệp phông dùng trên MỌI trang (chữ thân bài tiếng Việt + Latin). Báo
 * trình duyệt tải ngay khi đọc <head>, không đợi tải xong CSS rồi mới biết cần
 * phông — tiết kiệm một vòng đi-về (~200 ms trên đường truyền tàu) ở lần mở đầu.
 *
 * Cố ý KHÔNG preload Michroma (chỉ dùng cho mã, số) và hai bản Latin mở rộng:
 * trình duyệt tự tải khi gặp ký tự cần; preload thứ trang không dùng là tốn
 * băng thông vô ích, đúng thứ hiếm nhất trên tàu.
 */
const PHONG_CHINH = [
  "/fonts/manrope-vietnamese.woff2",
  "/fonts/manrope-latin.woff2",
];

/**
 * Là client component vì đó là cách tài liệu Next phiên bản này minh họa cho
 * gợi ý tài nguyên (generate-metadata.md, mục "Resource hints"); gọi từ server
 * component chỉ thấy gợi ý nằm trong luồng RSC (dòng `:HL[...]`), không kiểm
 * chứng được nó tới trình duyệt sớm.
 *
 * KIỂM CHỨNG Ở ĐÂU: KHÔNG phải trong HTML. Next truyền `onHeaders` cho React,
 * nên preload phông được phát ra ở HTTP header của trang:
 *
 *   curl -sS -o NUL -D - http://localhost:3000/login | findstr /i "^Link:"
 *   Link: </fonts/manrope-vietnamese.woff2>; rel=preload; as="font"; crossorigin=""; ...
 *
 * Tìm "manrope" trong HTML sẽ KHÔNG thấy gì và dễ tưởng là hỏng — đã mất một
 * vòng build vì đúng nhầm lẫn đó. Header còn tốt hơn thẻ <link>: trình duyệt
 * biết trước cả khi bắt đầu đọc HTML. (Xem thêm reactMaxHeadersLength trong
 * tài liệu Next.)
 *
 * crossOrigin là BẮT BUỘC dù cùng nguồn: phông luôn được tải ở chế độ CORS,
 * thiếu nó thì preload và @font-face không khớp nhau và trình duyệt tải cùng
 * một tệp HAI LẦN — preload thành ra chậm hơn không preload. Kiểm bằng
 * performance.getEntriesByType("resource"): mỗi tệp phông đúng một dòng.
 */
export function TaiTruocPhong() {
  for (const tep of PHONG_CHINH) {
    preload(tep, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  return null;
}
