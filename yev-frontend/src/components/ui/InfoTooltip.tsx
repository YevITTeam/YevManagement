"use client";

import { Info } from "lucide-react";

// Pure CSS (group-hover): no state or click-outside handling needed.
export default function InfoTooltip({ text }: { text: string }) {
    return (
        <span className="group relative inline-flex">
            <Info className="h-3.5 w-3.5 cursor-help text-[#8a8f94]" />
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg bg-[#191c1e] px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                {text}
            </span>
        </span>
    );
}
