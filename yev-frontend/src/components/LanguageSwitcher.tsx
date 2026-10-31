"use client";

import { useEffect, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";

const LOCALES = [
  { code: "vi", label: "VI" },
  { code: "ja", label: "JA" },
] as const;

const STORAGE_KEY = "yev-locale";

// usePathname() drops the query string, which several screens use as the route (?id=), so it is re-appended.
// Read from window.location in the handler: useSearchParams() here (root Header) would force a Suspense boundary for static export.
export default function LanguageSwitcher() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchTo = (nextLocale: string) => {
    const query = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    startTransition(() => {
      router.replace({ pathname, query }, { locale: nextLocale });
    });
  };

  const handleChange = (nextLocale: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {}
    switchTo(nextLocale);
  };

  // Manual VI/JA choice lasts for this tab session; new visits follow the machine language/time zone.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(STORAGE_KEY);
    } catch {}
    // Intl's default locale follows the browser UI (Windows) language, which can differ from navigator.language.
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    const isJapanese =
      navigator.language.toLowerCase().startsWith("ja") ||
      resolved.locale.toLowerCase().startsWith("ja") ||
      resolved.timeZone === "Asia/Tokyo";
    const target = saved ?? (isJapanese ? "ja" : null);

    if (target && target !== locale && LOCALES.some((l) => l.code === target)) switchTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white p-1" aria-label={t("language")}>
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          disabled={isPending || locale === code}
          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed ${
            locale === code
              ? "bg-[#e3000f] text-white"
              : "text-[#5e3f3a] hover:bg-[#f2f4f6]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
