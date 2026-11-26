"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, FileText } from "lucide-react";

// Files live in public/guides; replace a PDF there to update it, no code change needed.
const GUIDES = [
    { key: "userId", file: "/guides/lay-userid.pdf" },
    { key: "secondaryPassword", file: "/guides/mat-khau-cap-2-chu-ky.pdf" },
    { key: "createOt", file: "/guides/tao-don-tang-ca.pdf" },
    { key: "approveOt", file: "/guides/duyet-don-tang-ca.pdf" },
] as const;

export default function GuideViewer() {
    const t = useTranslations("Guide");
    const [active, setActive] = useState<(typeof GUIDES)[number]>(GUIDES[0]);

    return (
        <div className="flex flex-col gap-3 lg:flex-row">
            <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-64 lg:flex-col">
                {GUIDES.map((guide) => (
                    <button
                        key={guide.key}
                        type="button"
                        onClick={() => setActive(guide)}
                        className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${guide.key === active.key
                            ? "border-[#e3000f] bg-white text-[#191c1e]"
                            : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                            }`}
                    >
                        <FileText className={`h-4 w-4 shrink-0 ${guide.key === active.key ? "text-[#e3000f]" : ""}`} />
                        {t(guide.key)}
                    </button>
                ))}
            </nav>

            <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#e0e3e5] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#e0e3e5] px-4 py-2">
                    <span className="truncate text-sm font-semibold text-[#191c1e]">{t(active.key)}</span>
                    <a
                        href={active.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#5e3f3a] transition hover:text-[#e3000f]"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t("openNewTab")}
                    </a>
                </div>
                <iframe key={active.file} src={active.file} title={t(active.key)} className="h-[calc(100vh-11rem)] w-full" />
            </div>
        </div>
    );
}
