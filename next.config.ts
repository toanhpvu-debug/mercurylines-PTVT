import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Cho phép upload file báo cáo PDF/Excel tới 25MB qua server action
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
