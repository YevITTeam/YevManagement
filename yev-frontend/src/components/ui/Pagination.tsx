"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface PaginationProps {
    pageIndex: number;
    totalPages: number;
    onPageChange: (pageIndex: number) => void;
    disabled?: boolean;
    /** Left-hand count text, e.g. "1-10 of 42". Hidden below `sm` in favour of `compactSummary`. */
    summary: ReactNode;
    /** Short count shown below `sm` (defaults to nothing). */
    compactSummary?: ReactNode;
    /** With `onPageSizeChange`, shows a "rows" box; a new size jumps back to page 1. */
    pageSize?: number;
    onPageSizeChange?: (pageSize: number) => void;
}

// Matches GenericRepository.MaxPageSize on the BE.
const MAX_PAGE_SIZE = 1000;

// Page window of at most 7 slots ("…" included) so the pager keeps a fixed width.
function buildPageItems(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
    if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "…", current - 1, current, current + 1, "…", total];
}

const arrowClassName =
    "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

// Footer of a paged list: count on the left, `‹ 1 2 3 … ›` on the right. The page buttons collapse to
// `‹ 2 / 9 ›` below `sm`, and the nav is omitted when there is a single page.
export function Pagination({ pageIndex, totalPages, onPageChange, disabled, summary, compactSummary, pageSize, onPageSizeChange }: PaginationProps) {
    const tCommon = useTranslations("Common");

    // Applied on Enter/blur, not per keystroke, so typing "100" doesn't fetch for "1" and "10" first.
    const commitPageSize = (input: HTMLInputElement) => {
        const next = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(input.value))));
        if (input.value.trim() === "" || !Number.isFinite(next) || next === pageSize) {
            input.value = String(pageSize);
            return;
        }
        onPageChange(1);
        onPageSizeChange?.(next);
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#e0e3e5] px-4 py-2.5">
            <p className="text-sm tabular-nums text-[#5e3f3a]">
                <span className="hidden sm:inline">{summary}</span>
                <span className="sm:hidden">{compactSummary}</span>
            </p>
            <div className="flex items-center gap-3">
                {onPageSizeChange && pageSize !== undefined && (
                    <label className="flex items-center gap-2 whitespace-nowrap text-sm text-[#5e3f3a]" title={tCommon("rowsPerPageTitle")}>
                        {tCommon("rowsPerPage")}
                        <input
                            key={pageSize}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={MAX_PAGE_SIZE}
                            defaultValue={pageSize}
                            onBlur={(event) => commitPageSize(event.currentTarget)}
                            onKeyDown={(event) => event.key === "Enter" && commitPageSize(event.currentTarget)}
                            className="h-9 w-16 rounded-md border border-[#e0e3e5] bg-white px-2 text-right text-sm tabular-nums text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>
                )}
                {totalPages > 1 && (
                    <nav
                        aria-label={tCommon("pageOf", {
                            current: pageIndex,
                            total: totalPages,
                        })}
                        className="flex items-center gap-1"
                    >
                        <button
                            type="button"
                            disabled={pageIndex <= 1 || disabled}
                            onClick={() => onPageChange(Math.max(1, pageIndex - 1))}
                            aria-label={tCommon("prevPage")}
                            className={arrowClassName}
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <span className="inline-flex h-9 items-center px-2 text-sm font-medium tabular-nums text-[#191c1e] sm:hidden">
                            {pageIndex} / {totalPages}
                        </span>
                        <span className="hidden items-center gap-1 sm:flex">
                            {buildPageItems(pageIndex, totalPages).map((item, index) =>
                                item === "…" ? (
                                    <span key={`gap-${index}`} className="inline-flex h-9 min-w-9 items-center justify-center text-sm text-[#6b7075]">
                                        …
                                    </span>
                                ) : (
                                    <button
                                        key={item}
                                        type="button"
                                        disabled={disabled}
                                        aria-current={item === pageIndex ? "page" : undefined}
                                        onClick={() => onPageChange(item)}
                                        className={`inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums ${
                                            item === pageIndex ? "bg-[#e6e9ec] text-[#191c1e]" : "text-[#191c1e]/70 hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                        }`}
                                    >
                                        {item}
                                    </button>
                                )
                            )}
                        </span>
                        <button
                            type="button"
                            disabled={pageIndex >= totalPages || disabled}
                            onClick={() => onPageChange(pageIndex + 1)}
                            aria-label={tCommon("nextPage")}
                            className={arrowClassName}
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </nav>
                )}
            </div>
        </div>
    );
}
