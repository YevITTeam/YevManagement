import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default function nextConfig(phase: string) {
  const config: NextConfig = {
    allowedDevOrigins: ['10.45.1.181', '10.45.1.155'],
    // Export only on `next build`: dev mode rejects middleware together with output: 'export'.
    ...(phase === PHASE_PRODUCTION_BUILD ? { output: "export" as const } : {}),
    trailingSlash: true,
    experimental: {
      // Avoids resolving lucide-react's whole barrel file on every dev route compile.
      optimizePackageImports: ["lucide-react"],
    },
  };

  return withNextIntl(config);
}
 