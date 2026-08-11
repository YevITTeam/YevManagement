"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

const inputClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Combobox nhỏ dùng chung trong module job-titles: gõ để lọc, click chọn, Escape/blur để đóng.
// Không phụ thuộc thư viện ngoài — dùng trong ApprovalStepManager.tsx cho các ô chọn Bộ phận/Nhóm
// và ô "+ Thêm người giữ" (danh sách có thể dài, gõ tìm nhanh hơn cuộn <select> thường nhiều).

export interface SelectOption {
    value: number;
    /** Nội dung hiển thị trên dòng đã chọn + từng row trong dropdown */
    label: string;
    /** Chuỗi lowercase dùng để filter; thường rộng hơn label (thêm mã, tên không dấu…) */
    searchText: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: number | "";
    onChange: (v: number | "") => void;
    placeholder: string;
    disabled?: boolean;
    /** Override className của ô trigger — mặc định dùng kích thước chuẩn (h-10). */
    triggerClassName?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder, disabled, triggerClassName }: SearchableSelectProps) {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Đóng khi click ra ngoài
    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

    const filtered =
        query.trim() === ""
            ? options
            : options.filter((o) => o.searchText.includes(query.toLowerCase().trim()));

    function open() {
        if (disabled) return;
        setIsOpen(true);
        setQuery("");
        // Focus input sau khi render
        setTimeout(() => inputRef.current?.focus(), 0);
    }

    function selectOption(v: number | "") {
        onChange(v);
        setIsOpen(false);
        setQuery("");
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
            <div
                role="combobox"
                aria-expanded={isOpen}
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

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg">
                    {/* Ô tìm kiếm */}
                    <div className="border-b border-[#f1f5f9] p-2">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") { setIsOpen(false); setQuery(""); }
                                if (e.key === "Enter" && filtered.length === 1) selectOption(filtered[0].value);
                            }}
                            placeholder="Tìm kiếm…"
                            className="h-8 w-full rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </div>

                    {/* Option: bỏ chọn */}
                    {value !== "" && (
                        <button
                            onMouseDown={() => selectOption("")}
                            className="flex w-full items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 text-left text-xs text-[#8a8f94] transition-colors hover:bg-[#f8fafc]"
                        >
                            <X size={11} /> Bỏ chọn
                        </button>
                    )}

                    {/* Danh sách */}
                    <ul className="max-h-52 overflow-y-auto">
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

                    {/* Đếm kết quả khi đang lọc */}
                    {query.trim() !== "" && (
                        <div className="border-t border-[#f1f5f9] px-3 py-1.5 text-right text-xs text-[#8a8f94]">
                            {filtered.length} kết quả
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
