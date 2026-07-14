"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";

const LOCALES = [
  { code: "vi", label: "VI" },
  { code: "ja", label: "JA" },
] as const;

// Đổi locale bằng router.replace giữ nguyên path hiện tại — next-intl tự thêm/bỏ tiền tố,
// KHÔNG hard-reload nên state form/app hiện có không bị mất.
export default function LanguageSwitcher() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleChange = (nextLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

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
