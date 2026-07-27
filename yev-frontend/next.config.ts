import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default function nextConfig(phase: string) {
  const config: NextConfig = {
    /* config options here */
    allowedDevOrigins: ['10.45.1.181', '10.45.1.155'],
    // `output: 'export'` chỉ bật khi `next build` (static export cho IIS).
    // Next dev không hỗ trợ middleware/proxy cùng lúc với output: 'export'
    // (báo lỗi "Middleware cannot be used with output: export"), nên phải tách theo phase.
    ...(phase === PHASE_PRODUCTION_BUILD ? { output: "export" as const } : {}),
    trailingSlash: true,
    experimental: {
      // Tránh webpack dev phải resolve toàn bộ barrel file của lucide-react mỗi lần compile 1 route.
      optimizePackageImports: ["lucide-react"],
    },
  };

  return withNextIntl(config);
}
 