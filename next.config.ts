import type { NextConfig } from "next";

/** Một năm, không đổi — chỉ cho tệp mà nội dung gắn liền với tên tệp. */
const BAT_BIEN = "public, max-age=31536000, immutable";

/**
 * Một ngày; trong 7 ngày kế tiếp trình duyệt được dùng bản cũ trong lúc âm
 * thầm hỏi lại server — đủ để đổi thiết kế mà không bắt người dùng chờ.
 */
const MOT_NGAY_ROI_HOI_LAI = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  // Không khai "X-Powered-By: Next.js" trong mọi phản hồi: kẻ dò quét dùng
  // header này để chọn đúng lỗ hổng theo framework. Bỏ đi không ảnh hưởng gì.
  poweredByHeader: false,

  experimental: {
    serverActions: {
      // Cho phép upload file báo cáo PDF/Excel tới 25MB qua server action
      bodySizeLimit: "25mb",
    },
  },

  async headers() {
    return [
      {
        // Header bảo mật cho MỌI phản hồi. Không có chúng thì trang nhúng được
        // vào iframe của site lạ (clickjacking lên nút Duyệt/Xóa/Xuất kho), lần
        // gõ tay tên miền đầu tiên đi qua HTTP thuần, và đường dẫn nội bộ rò
        // sang site ngoài qua Referer. Đo trước khi sửa: 0/5 header trên site thật.
        // CSP cố ý CHƯA bật: Next cần nonce cho style/script, bật vội là vỡ giao
        // diện — sẽ đi qua Content-Security-Policy-Report-Only trước.
        // HSTS chỉ có hiệu lực khi phản hồi đi qua HTTPS (site thật); bản
        // localhost:3000 trên máy văn phòng không bị ảnh hưởng.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Phông chữ tự host. Mặc định Next trả `Cache-Control: max-age=0` cho
        // mọi thứ trong public/ — trình duyệt phải hỏi lại server 5 tệp phông ở
        // MỖI lần mở trang đầy đủ (đăng nhập, đổi ngôn ngữ, F5), và trong lúc
        // chờ câu trả lời 304 (~200 ms trên đường truyền tàu) chữ hiện bằng
        // phông hệ thống rồi mới nhảy sang Manrope: nháy chữ ở mỗi lần mở trang.
        // Đo trên bản chạy thật trước khi sửa: /fonts/*.woff2 → max-age=0.
        //
        // Hệ quả phải nhớ: tệp phông KHÔNG sửa tại chỗ. Muốn đổi phông thì đổi
        // TÊN tệp (và đường dẫn trong globals.css), vì bản cũ có thể nằm trong
        // bộ nhớ đệm của trình duyệt tới một năm.
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: BAT_BIEN }],
      },
      {
        source: "/motif-ring.svg",
        headers: [{ key: "Cache-Control", value: MOT_NGAY_ROI_HOI_LAI }],
      },
      {
        source: "/favicon.svg",
        headers: [{ key: "Cache-Control", value: MOT_NGAY_ROI_HOI_LAI }],
      },
    ];
  },
};

export default nextConfig;
