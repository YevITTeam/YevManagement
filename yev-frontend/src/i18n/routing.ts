import { defineRouting } from "next-intl/routing";

// Deploy dạng static export (output: "export") nên KHÔNG có middleware chạy ở production
// (IIS chỉ serve file tĩnh) — localePrefix phải là "always" để mọi URL (kể cả vi) đều có
// tiền tố (/vi/..., /ja/...) khớp đúng cấu trúc file next export sinh ra
// (out/vi/..., out/ja/...). Dùng "as-needed" sẽ 404 khi deploy static vì file /pc/... không
// tồn tại (chỉ tồn tại /vi/pc/...) và không có middleware để rewrite.
export const routing = defineRouting({
  locales: ["vi", "ja"],
  defaultLocale: "vi",
  localePrefix: "always",
});
