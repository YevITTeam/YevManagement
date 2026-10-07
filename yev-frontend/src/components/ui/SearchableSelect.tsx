"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

const inputClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Combobox dùng chung toàn app (2026-08-10, chuyển từ modules/attendance/components/job-titles/ ra
// đây vì ngày càng nhiều màn cần): gõ để lọc, click chọn, Escape/blur để đóng. Không phụ thuộc thư
// viện ngoài. Dùng cho các dropdown chọn master data có thể nhiều lựa chọn (Bộ phận/Nhóm/Chi
// nhánh/Loại thiết bị/NCC/Lý do...) — KHÔNG dùng cho enum cố định ít lựa chọn (trạng thái, có/không...),
// bắt gõ tìm cho danh sách 2-3 mục chỉ gây phiền, ngược lại với mục đích cải thiện UX (yêu cầu người
// dùng 2026-08-10, xem docs/docs-fe/DESIGN_SYSTEM.md §4.3).

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

interface PanelPosition {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}

export function SearchableSelect({ options, value, onChange, placeholder, disabled, triggerClassName }: SearchableSelectProps) {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();
    const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);

    // Tính vị trí panel theo toạ độ thật của trigger trên viewport (dùng cho position: fixed) — gọi
    // trong `open()` lúc click, KHÔNG trong effect (setState đồng bộ trong effect bị React Compiler
    // cấm, xem frontend-conventions.md §3). Tự tính chiều cao còn lại theo viewport và lật lên trên nếu khoảng
    // trống phía dưới quá hẹp, giống combobox chuẩn.
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

    // Đóng khi click ra ngoài / cuộn trang / đổi cỡ cửa sổ — panel đã portal ra <body> + position: fixed
    // theo toạ độ tính lúc mở, nên cuộn/resize thì đóng luôn thay vì định vị lại (giống RowActionsMenu.tsx,
    // cùng pattern menu "3 chấm" dùng portal). Effect chỉ gắn khi đang mở, setState nằm trong callback của
    // sự kiện DOM — không phải gọi đồng bộ trong thân effect.
    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(e: MouseEvent) {
            const target = e.target as Node;
            if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            close();
        }
        // Scroll gắn ở capture phase trên window nên bắt được CẢ sự kiện cuộn bên trong chính <ul> của
        // panel (dropdown) — phải loại trừ, không thì cuộn danh sách bên trong cũng bị coi là "cuộn
        // trang" và tự đóng ngay lập tức.
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

    const filtered =
        query.trim() === ""
            ? options
            : options.filter((o) => o.searchText.includes(query.toLowerCase().trim()));

    function open() {
        if (disabled) return;
        setPanelPosition(computePosition());
        setIsOpen(true);
        setQuery("");
        // Focus input sau khi render
        setTimeout(() => inputRef.current?.focus(), 0);
    }

    function close() {
        setIsOpen(false);
        setQuery("");
        setPanelPosition(null);
    }

    function selectOption(v: number | "") {
        onChange(v);
        close();
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
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

            {/* Dropdown — portal ra <body>, position: fixed theo panelPosition đã tính lúc mở (computePosition)
                nên không bị modal cha cắt mất dù trigger nằm sát đáy dialog. */}
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
                        {/* Ô tìm kiếm */}
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

                        {/* Option: bỏ chọn */}
                        {value !== "" && (
                            <button
                                onMouseDown={() => selectOption("")}
                                className="flex w-full shrink-0 items-center gap-2 border-b border-[#f1f5f9] px-3 py-2 text-left text-xs text-[#8a8f94] transition-colors hover:bg-[#f8fafc]"
                            >
                                <X size={11} /> Bỏ chọn
                            </button>
                        )}

                        {/* Danh sách — chiếm hết phần còn lại trong panelPosition.maxHeight, tự cuộn riêng */}
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

                        {/* Đếm kết quả khi đang lọc */}
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
