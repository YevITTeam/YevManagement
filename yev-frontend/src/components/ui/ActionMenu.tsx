"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface ActionMenuItem {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    title?: string;
}

interface ActionMenuProps {
    label: string;
    icon?: ReactNode;
    items: ActionMenuItem[];
    disabled?: boolean;
    /** Icon-only trigger sized for list toolbars; label moves to title. */
    iconOnly?: boolean;
}

// No portal (unlike RowActionsMenu): it always sits in a toolbar, never clipped by table overflow.
export default function ActionMenu({ label, icon, items, disabled, iconOnly }: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                title={iconOnly ? label : undefined}
                className={`flex cursor-pointer items-center gap-1.5 border border-[#e0e3e5] bg-white text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50 ${
                    iconOnly ? "h-9 rounded-md px-2 text-[#5e3f3a]" : "h-10 rounded-lg px-4"
                }`}
            >
                {icon}
                {!iconOnly && label}
                <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-max min-w-[200px] overflow-hidden rounded-lg border border-[#e0e3e5] bg-white py-1 shadow-lg"
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            role="menuitem"
                            type="button"
                            disabled={item.disabled}
                            title={item.title}
                            onClick={() => {
                                setOpen(false);
                                item.onClick();
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm font-semibold text-[#5e3f3a] transition hover:bg-[#f8fafc] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
