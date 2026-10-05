"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const triggerBaseClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-60";

// Dropdown có style riêng (không phải <option> gốc của trình duyệt — không chỉnh được font/hover/màu,
// xem StatusFilterSelect cũ trong InventoryReportPage.tsx) dùng cho enum cố định ít lựa chọn (trạng
// thái, có/không, mức ưu tiên…). Khác SearchableSelect (ô gõ tìm, value number) — component này KHÔNG
// có ô tìm vì danh sách quá ngắn, gõ tìm chỉ gây thêm thao tác thừa, và value có thể là string hoặc
// number tuỳ enum — xem docs/docs-fe/DESIGN_SYSTEM.md §4.3.
export interface StyledSelectOption<T extends string | number> {
    value: T;
    label: string;
    /** Tailwind bg class của chấm màu trạng thái (vd "bg-[#16a34a]"); bỏ trống = không có chấm. */
    dotClassName?: string;
}

interface StyledSelectProps<T extends string | number> {
    options: StyledSelectOption<T>[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    triggerClassName?: string;
    ariaLabel?: string;
}

export function StyledSelect<T extends string | number>({
    options,
    value,
    onChange,
    disabled,
    triggerClassName,
    ariaLabel,
}: StyledSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [isOpen]);

    const selected = options.find((option) => option.value === value);
    const hasDots = options.some((option) => option.dotClassName);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                onClick={() => setIsOpen((current) => !current)}
                className={`${triggerClassName ?? triggerBaseClassName} flex cursor-pointer items-center text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
                {selected?.dotClassName && <span className={`mr-2 h-2 w-2 shrink-0 rounded-full ${selected.dotClassName}`} />}
                <span className="flex-1 truncate">{selected?.label ?? ""}</span>
                <ChevronDown
                    className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-64 w-full min-w-max overflow-y-auto rounded-lg border border-[#e0e3e5] bg-white py-1 shadow-lg">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onMouseDown={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`flex w-full cursor-pointer items-center whitespace-nowrap px-3 py-2 text-left text-sm transition-colors hover:bg-[#fff4f2] hover:text-[#e3000f] ${
                                option.value === value ? "bg-[#fff4f2] font-semibold text-[#e3000f]" : "text-[#191c1e]"
                            }`}
                        >
                            {hasDots && (
                                <span className={`mr-2 h-2 w-2 shrink-0 rounded-full ${option.dotClassName ?? "bg-transparent"}`} />
                            )}
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
