import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['10.45.1.181', '10.45.1.155'],
  output: 'export',
  //trailingSlash: true,
  experimental: {
    // Tránh webpack dev phải resolve toàn bộ barrel file của lucide-react mỗi lần compile 1 route.
    optimizePackageImports: ["lucide-react"],
  },
  //
};

export default withNextIntl(nextConfig);
 