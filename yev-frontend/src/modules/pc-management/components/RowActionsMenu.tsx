"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface RowAction {
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
    disabled?: boolean;
}

interface RowActionsMenuProps {
    actions: RowAction[];
}

// Menu "3 chấm" gom các thao tác của 1 hàng. Dropdown render qua portal thẳng
// vào document.body (không lồng trong bảng) để không bị các ô sticky của
// dòng khác đè lên, dù đã dùng position: fixed + z-50.
export default function RowActionsMenu({ actions }: RowActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const updatePosition = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };

    const toggle = () => {
        if (!open) updatePosition();
        setOpen((current) => !current);
    };

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (buttonRef.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) {
                return;
            }
            setOpen(false);
        };
        const handleDismiss = () => setOpen(false);
        const handleKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);

        document.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("scroll", handleDismiss, true);
        window.addEventListener("resize", handleDismiss);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            window.removeEventListener("scroll", handleDismiss, true);
            window.removeEventListener("resize", handleDismiss);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                onClick={toggle}
                className="cursor-pointer rounded-md p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                title="Thao tác"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {open &&
                coords &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        style={{ position: "fixed", top: coords.top, right: coords.right }}
                        className="z-50 w-max min-w-[140px] overflow-hidden rounded-lg border border-[#e0e3e5] bg-white py-1 shadow-lg"
                    >
                        {actions.map((action) => (
                            <button
                                key={action.label}
                                role="menuitem"
                                disabled={action.disabled}
                                onClick={() => {
                                    setOpen(false);
                                    action.onClick();
                                }}
                                className={`block w-full cursor-pointer whitespace-nowrap px-4 py-2 text-left text-sm font-semibold transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50 ${
                                    action.variant === "danger"
                                        ? "text-[#930006] hover:text-[#e3000f]"
                                        : "text-[#5e3f3a] hover:text-[#191c1e]"
                                }`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}
