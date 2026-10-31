import { createNavigation } from "next-intl/navigation";
import { routing } from "./i18n/routing";

// Use Link/useRouter/usePathname from here, not next/link or next/navigation,
// so next-intl adds/strips the locale prefix.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
