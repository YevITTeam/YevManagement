"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

export interface MultiSelectOption {
    value: number;
    label: string;
    /** Lowercase string matched against the search box; defaults to the lowercased label. */
    searchText?: string;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    values: number[];
    onChange: (values: number[]) => void;
    placeholder: string;
    disabled?: boolean;
}

interface PanelPosition {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}

const triggerClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

// Searchable multi-select: ticking an option keeps the panel open, and every selected option is
// shown as a removable chip under the trigger (same look as the IP chips in DeviceForm).
export function MultiSelect({ options, values, onChange, placeholder, disabled }: MultiSelectProps) {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();

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

    // Closes on outside click, page scroll (outside the panel) and resize; the panel is portaled to <body>.
    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(e: MouseEvent) {
            const target = e.target as Node;
            if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            close();
        }
        function handleScroll(e: Event) {
            if (panelRef.current?.contains(e.target as Node)) return;
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

    const normalizedQuery = query.toLowerCase().trim();
    const filtered =
        normalizedQuery === ""
            ? options
            : options.filter((o) => (o.searchText ?? o.label.toLowerCase()).includes(normalizedQuery));
    const selectedOptions = values
        .map((value) => options.find((o) => o.value === value))
        .filter((o): o is MultiSelectOption => o !== undefined);

    function open() {
        if (disabled) return;
        setPanelPosition(computePosition());
        setIsOpen(true);
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 0);
    }

    function close() {
        setIsOpen(false);
        setQuery("");
        setPanelPosition(null);
    }

    function toggle(value: number) {
        onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
    }

    return (
        <div>
            <div ref={containerRef} className="relative">
                <div
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    className={`${triggerClassName} flex cursor-pointer items-center ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={open}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") open();
                    }}
                    tabIndex={disabled ? -1 : 0}
                >
                    <span className={`flex-1 truncate ${values.length === 0 ? "text-[#8a8f94]" : ""}`}>
                        {values.length === 0 ? placeholder : `Đã chọn ${values.length} mục`}
                    </span>
                    <ChevronDown
                        className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8f94] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                    />
                </div>

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
                                    }}
                                    placeholder="Tìm kiếm…"
                                    className="h-8 w-full rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                            </div>

                            {values.length > 0 && (
                                <button
                                    type="button"
                                    onMouseDown={() => onChange([])}
                                    className="flex w-full shrink-0 items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 text-left text-xs text-[#8a8f94] transition-colors hover:bg-[#f8fafc]"
                                >
                                    <X size={11} /> Bỏ chọn tất cả
                                </button>
                            )}

                            <ul id={listboxId} role="listbox" aria-multiselectable="true" className="flex-1 overflow-y-auto">
                                {filtered.length === 0 ? (
                                    <li className="px-3 py-4 text-center text-sm text-[#8a8f94]">Không tìm thấy kết quả</li>
                                ) : (
                                    filtered.map((opt) => {
                                        const isSelected = values.includes(opt.value);
                                        return (
                                            <li
                                                key={opt.value}
                                                role="option"
                                                aria-selected={isSelected}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    toggle(opt.value);
                                                }}
                                                className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-[#fff4f2] hover:text-[#e3000f] ${
                                                    isSelected ? "bg-[#fff4f2] font-semibold text-[#e3000f]" : "text-[#191c1e]"
                                                }`}
                                            >
                                                <span
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                        isSelected ? "border-[#e3000f] bg-[#e3000f] text-white" : "border-[#cbd5e1] bg-white"
                                                    }`}
                                                >
                                                    {isSelected && <Check size={12} />}
                                                </span>
                                                {opt.label}
                                            </li>
                                        );
                                    })
                                )}
                            </ul>

                            {normalizedQuery !== "" && (
                                <div className="shrink-0 border-t border-[#f1f5f9] px-3 py-1.5 text-right text-xs text-[#8a8f94]">
                                    {filtered.length} kết quả
                                </div>
                            )}
                        </div>,
                        document.body
                    )}
            </div>

            {selectedOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {selectedOptions.map((opt) => (
                        <span
                            key={opt.value}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#191c1e]"
                        >
                            {opt.label}
                            <button
                                type="button"
                                onClick={() => toggle(opt.value)}
                                disabled={disabled}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#e3000f] disabled:cursor-not-allowed"
                                aria-label={`Bỏ ${opt.label}`}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
