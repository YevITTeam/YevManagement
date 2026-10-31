import { defineRouting } from "next-intl/routing";

// Static export on IIS has no middleware to rewrite, so every URL (including vi) must carry its locale prefix
// to match the out/vi/..., out/ja/... files; "as-needed" would 404.
export const routing = defineRouting({
  locales: ["vi", "ja"],
  defaultLocale: "vi",
  localePrefix: "always",
});
