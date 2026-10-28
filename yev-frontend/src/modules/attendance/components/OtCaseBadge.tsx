"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { CircleAlert } from "lucide-react";

import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";

const PANEL_WIDTH = 320;

// One request per page load; a failure (e.g. no OtCase.View) is not cached so the next open retries.
let allCasesPromise: Promise<OtCaseDto[]> | null = null;
function loadAllCases() {
    allCasesPromise ??= OtCaseApi.getAllOtCases().catch((error) => {
        allCasesPromise = null;
        throw error;
    });
    return allCasesPromise;
}

// OT case code with a "!" button that opens the descriptions (OtCase.Description / DescriptionJp, by locale) of every
// case with the current one highlighted. showAll=false (public email page, no token) shows just the current case.
// Fixed positioning keeps the panel from being clipped by scrollable tables.
export default function OtCaseBadge({
    code,
    description,
    descriptionJp,
    showAll = true,
}: {
    code: string;
    description?: string | null;
    descriptionJp?: string | null;
    showAll?: boolean;
}) {
    const locale = useLocale();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [cases, setCases] = useState<OtCaseDto[]>([]);

    useEffect(() => {
        if (!position) return;
        const close = () => setPosition(null);
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [position]);

    const pick = (vn: string | null | undefined, jp: string | null | undefined) => (locale === "ja" && jp ? jp : vn);
    const currentDescription = pick(description, descriptionJp);
    if (!currentDescription && !showAll) return <>{code}</>;

    const toggle = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (position) {
            setPosition(null);
            return;
        }
        const rect = buttonRef.current!.getBoundingClientRect();
        const left = Math.min(Math.max(8, rect.left + rect.width / 2 - PANEL_WIDTH / 2), window.innerWidth - PANEL_WIDTH - 8);
        setPosition({ top: rect.bottom + 8, left });
        if (showAll) loadAllCases().then(setCases).catch(() => undefined);
    };

    const rows = showAll && cases.length > 0 ? cases : [{ id: 0, code, description: description ?? null, descriptionJp: descriptionJp ?? null }];

    return (
        <span className="inline-flex items-center gap-1">
            {code}
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                aria-label={code}
                aria-expanded={position !== null}
                className="cursor-pointer rounded-full text-[#8a8f94] transition hover:text-[#e3000f]"
            >
                <CircleAlert className="h-3.5 w-3.5" />
            </button>
            {position && (
                <div
                    ref={panelRef}
                    role="tooltip"
                    style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
                    className="fixed z-70 space-y-1 whitespace-normal rounded-lg bg-[#191c1e] p-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg"
                >
                    {rows.map((row) => (
                        <div key={row.code} className={`rounded-md px-2 py-1 ${row.code === code ? "bg-white/15" : ""}`}>
                            <span className="font-semibold">{row.code}</span>: {pick(row.description, row.descriptionJp) || "-"}
                        </div>
                    ))}
                </div>
            )}
        </span>
    );
}
