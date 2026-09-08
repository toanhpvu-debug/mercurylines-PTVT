/**
 * Khung chờ (skeleton) cho MỌI trang sau đăng nhập.
 *
 * Không có file này, mỗi lần bấm sang trang khác màn hình đứng im cho tới khi
 * server dựng xong cả trang (truy vấn + render + tải về) — vài trăm mili-giây
 * mà không có phản hồi nào, nên cảm giác "app bị đơ". Có file này, Next hiện
 * ngay khung xám nhấp nháy trong phần nội dung (thanh bên giữ nguyên), rồi
 * thay bằng trang thật khi dữ liệu về. Cùng một thời gian tải, nhưng người
 * dùng thấy app phản ứng tức thì.
 *
 * Bố cục khung mô phỏng trang điển hình (tiêu đề → thanh công cụ → bảng) để
 * lúc thay bằng trang thật không bị "nhảy" bố cục.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-72 rounded bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200/70" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-40 rounded bg-slate-200" />
          <div className="h-8 w-28 rounded bg-slate-200/70" />
          <div className="ml-auto h-8 w-64 rounded bg-slate-200/70" />
        </div>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 h-5 w-48 rounded bg-slate-200" />
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-4 flex-1 rounded bg-slate-200/70" />
              <div className="h-4 w-16 rounded bg-slate-200/70" />
              <div className="h-4 w-20 rounded bg-slate-200/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
