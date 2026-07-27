import { createNavigation } from "next-intl/navigation";
import { routing } from "./i18n/routing";

// Mọi component cần chuyển trang phải dùng Link/useRouter/usePathname từ đây thay vì
// next/link hay next/navigation, để next-intl tự thêm/bỏ tiền tố locale khi điều hướng.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
