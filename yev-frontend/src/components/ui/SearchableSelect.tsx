"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { sortByLabel } from "@/lib/sort-options";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

const inputClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// For master-data dropdowns with many options; not for small fixed enums, where typing to search only adds friction.

export interface SelectOption {
    value: number;
    label: string;
    /** Lowercase filter text; usually broader than label (code, unaccented name...). */
    searchText: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: number | "";
    onChange: (v: number | "") => void;
    placeholder: string;
    disabled?: boolean;
    /** Overrides the trigger className (default size h-10). */
    triggerClassName?: string;
    /** Fired as the user types (and with "" on open/close) so a caller can fetch matching options from the server. */
    onQueryChange?: (query: string) => void;
}

interface PanelPosition {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}

export function SearchableSelect({ options, value, onChange, placeholder, disabled, triggerClassName, onQueryChange }: SearchableSelectProps) {
    const [query, setQueryState] = useState("");
    // Ref keeps the callback out of close()'s identity, which the outside-click effect depends on.
    const onQueryChangeRef = useRef(onQueryChange);
    useEffect(() => {
        onQueryChangeRef.current = onQueryChange;
    });
    const setQuery = (next: string) => {
        setQueryState(next);
        onQueryChangeRef.current?.(next);
    };
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();
    const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);

    // Called from open() on click, not in an effect: React Compiler forbids synchronous setState in effects.
    // Flips upward when space below is too small.
    function computePosition(): PanelPosition | null {
        const trigger = containerRef.current;
        if (!trigger) return null;
        const rect = trigger.getBoundingClientRect();
        const margin = 8;
        const minPanelHeight = 160;
        const spaceBelow = window.innerHeight - rect.bottom - margin;
        const spaceAbove = rect.top - margin;
        const openUp = spaceBelow < minPanelHeight && spaceAbove > spaceBelow;
        const maxHeight = Math.min(360, Math.max(minPanelHeight, openUp ? spaceAbove : spaceBelow));
        const width = Math.max(rect.width, 240);
        const left = Math.min(rect.left, window.innerWidth - width - margin);
        return {
            top: openUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
            left: Math.max(margin, left),
            width,
            maxHeight,
        };
    }

    // Panel is portaled with position: fixed from coordinates taken at open, so scroll/resize closes it instead of repositioning.
    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(e: MouseEvent) {
            const target = e.target as Node;
            if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            close();
        }
        // Capture-phase listener also sees scrolls inside the panel's own list; ignore those or it closes instantly.
        function handleScroll(e: Event) {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            close();
        }
        function handleResize() {
            close();
        }
        document.addEventListener("mousedown", handleOutside);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleResize);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleResize);
        };
    }, [isOpen]);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

    const sorted = useMemo(() => sortByLabel(options), [options]);
    const filtered =
        query.trim() === ""
            ? sorted
            : sorted.filter((o) => o.searchText.includes(query.toLowerCase().trim()));

    function open() {
        if (disabled) return;
        setPanelPosition(computePosition());
        setIsOpen(true);
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 0);
    }

    function close() {
        setIsOpen(false);
        setQueryState("");
        onQueryChangeRef.current?.("");
        setPanelPosition(null);
    }

    function selectOption(v: number | "") {
        onChange(v);
        close();
    }

    return (
        <div ref={containerRef} className="relative">
            <div
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                className={`${triggerClassName ?? inputClassName} flex cursor-pointer items-center ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                onClick={open}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") open();
                }}
                tabIndex={disabled ? -1 : 0}
            >
                <span className={`flex-1 truncate ${value === "" ? "text-[#8a8f94]" : ""}`}>
                    {value === "" ? placeholder : selectedLabel}
                </span>
                <ChevronDown
                    className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8f94] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                />
            </div>

            {/* Portaled to <body> with position: fixed so a parent modal can't clip it. */}
            {isOpen &&
                panelPosition &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={panelRef}
                        style={{
                            position: "fixed",
                            top: panelPosition.top,
                            left: panelPosition.left,
                            width: panelPosition.width,
                            maxHeight: panelPosition.maxHeight,
                        }}
                        className="z-[100] flex flex-col overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg"
                    >
                        <div className="shrink-0 border-b border-[#f1f5f9] p-2">
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") close();
                                    if (e.key === "Enter" && filtered.length === 1) selectOption(filtered[0].value);
                                }}
                                placeholder="Tìm kiếm…"
                                className="h-8 w-full rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            />
                        </div>

                        {value !== "" && (
                            <button
                                onMouseDown={() => selectOption("")}
                                className="flex w-full shrink-0 items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 text-left text-xs text-[#8a8f94] transition-colors hover:bg-[#f8fafc]"
                            >
                                <X size={11} /> Bỏ chọn
                            </button>
                        )}

                        <ul id={listboxId} role="listbox" className="flex-1 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <li className="px-3 py-4 text-center text-sm text-[#8a8f94]">
                                    Không tìm thấy kết quả
                                </li>
                            ) : (
                                filtered.map((opt) => (
                                    <li
                                        key={opt.value}
                                        onMouseDown={() => selectOption(opt.value)}
                                        className={`cursor-pointer px-3 py-2.5 text-sm transition-colors hover:bg-[#fff4f2] hover:text-[#e3000f] ${
                                            opt.value === value
                                                ? "bg-[#fff4f2] font-semibold text-[#e3000f]"
                                                : "text-[#191c1e]"
                                        }`}
                                    >
                                        {opt.label}
                                    </li>
                                ))
                            )}
                        </ul>

                        {query.trim() !== "" && (
                            <div className="shrink-0 border-t border-[#f1f5f9] px-3 py-1.5 text-right text-xs text-[#8a8f94]">
                                {filtered.length} kết quả
                            </div>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
}
