/**
 * Khung chờ (skeleton) cho MỌI trang sau đăng nhập.
 *
 * Không có file này, mỗi lần bấm sang trang khác màn hình đứng im cho tới khi
 * server dựng xong cả trang — vài trăm mili-giây không có phản hồi nào, nên
 * cảm giác "app bị đơ". Có file này, Next hiện ngay khung xám nhấp nháy trong
 * phần nội dung (thanh bên giữ nguyên), rồi thay bằng trang thật khi dữ liệu
 * về. Bố cục khung mô phỏng trang điển hình (tiêu đề → thanh công cụ → bảng)
 * để lúc thay bằng trang thật không bị "nhảy".
 */
export default function Loading() {
  const o = "rounded bg-[var(--surface-sunken)]";
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className={`h-7 w-72 ${o}`} />
        <div className={`h-4 w-96 max-w-full ${o} opacity-70`} />
      </div>
      <div className="surface rounded-xl border p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <div className={`h-8 w-40 ${o}`} />
          <div className={`h-8 w-28 ${o} opacity-70`} />
          <div className={`ml-auto h-8 w-64 ${o} opacity-70`} />
        </div>
      </div>
      <div className="surface rounded-xl border p-5 shadow-sm">
        <div className={`mb-4 h-5 w-48 ${o}`} />
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className={`h-4 w-24 ${o}`} />
              <div className={`h-4 flex-1 ${o} opacity-70`} />
              <div className={`h-4 w-16 ${o} opacity-70`} />
              <div className={`h-4 w-20 ${o} opacity-70`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
