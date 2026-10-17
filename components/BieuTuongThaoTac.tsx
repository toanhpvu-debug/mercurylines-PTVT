/**
 * Biểu tượng của nút thao tác TỪNG DÒNG bảng danh mục (/materials): vẽ nét MỘT lần cho cả trang
 * (BoBieuTuongThaoTac, trong <defs>) rồi mỗi nút dùng lại bằng <use> — HTML thuần do server vẽ.
 *
 * Vì sao không dùng thẳng <Pencil /> của lucide-react: bản 1.x là thành phần client ("use client",
 * đọc context mỗi lần vẽ) — 200 dòng × 3 nút là 600 thành phần phải hydrate, mỗi cái vẽ lại 2–6
 * nét (đo 2026-10-17, bảng quản trị: 650 svg + 2.288 nút con). Nét và thuộc tính chép đúng
 * lucide-react 1.43 (ISC): khung 24, không tô, nét currentColor dày 2, đầu / góc tròn — hình y hệt.
 */

type Net = readonly (readonly ["path", { d: string }] | readonly ["line", { x1: string; x2: string; y1: string; y2: string }])[];

const NET = {
  // lucide "pencil"
  sua: [
    ["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }],
    ["path", { d: "m15 5 4 4" }],
  ],
  // lucide "power"
  dung: [
    ["path", { d: "M12 2v10" }],
    ["path", { d: "M18.4 6.6a9 9 0 1 1-12.77.04" }],
  ],
  // lucide "power-off"
  ngung: [
    ["path", { d: "M18.36 6.64A9 9 0 0 1 20.77 15" }],
    ["path", { d: "M6.16 6.16a9 9 0 1 0 12.68 12.68" }],
    ["path", { d: "M12 2v4" }],
    ["path", { d: "m2 2 20 20" }],
  ],
  // lucide "trash-2" (= "trash")
  xoa: [
    ["path", { d: "M10 11v6" }],
    ["path", { d: "M14 11v6" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
  ],
  // lucide "unlink"
  goTau: [
    ["path", { d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" }],
    ["path", { d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" }],
    ["line", { x1: "8", x2: "8", y1: "2", y2: "5" }],
    ["line", { x1: "2", x2: "5", y1: "8", y2: "8" }],
    ["line", { x1: "16", x2: "16", y1: "19", y2: "22" }],
    ["line", { x1: "19", x2: "22", y1: "16", y2: "16" }],
  ],
} satisfies Record<string, Net>;

export type TenBieuTuong = keyof typeof NET;

const ID = (ten: TenBieuTuong) => `tt-${ten}`;

/** Đặt MỘT lần trên trang (trước bảng): không chiếm chỗ, không in. */
export function BoBieuTuongThaoTac() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute size-0 overflow-hidden">
      <defs>
        {(Object.keys(NET) as TenBieuTuong[]).map((ten) => (
          <g key={ten} id={ID(ten)}>
            {NET[ten].map(([the, tt], i) => (the === "path" ? <path key={i} {...tt} /> : <line key={i} {...tt} />))}
          </g>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Một biểu tượng — cùng thuộc tính nét với svg của lucide nên nét, màu (theo chữ của nút) y hệt.
 * Không ghi xmlns / width / height như lucide: SVG nằm trong HTML, cỡ do lớp size-* quyết định
 * (CSS thắng thuộc tính) — bớt ~55 byte RSC mỗi biểu tượng (600 cái trên trang quản trị).
 */
export function BieuTuongThaoTac({ ten, className = "size-4" }: { ten: TenBieuTuong; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide ${className}`}
      aria-hidden="true"
    >
      <use href={`#${ID(ten)}`} />
    </svg>
  );
}
