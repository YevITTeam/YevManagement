import { defineRouting } from "next-intl/routing";

// vi là mặc định và giữ URL không tiền tố (/pc, /pc/branches...); ja có tiền tố /ja/...
// (localePrefix: "as-needed") để không phá link/bookmark hiện có.
export const routing = defineRouting({
  locales: ["vi", "ja"],
  defaultLocale: "vi",
  localePrefix: "as-needed",
});
