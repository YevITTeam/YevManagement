"use client";

import type { ReactNode } from "react";
import { FilterX, RefreshCw, Search, SearchX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";

export const fieldClassName =
    "h-9 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm text-[#191c1e] outline-none transition placeholder:text-[#8a8f94] focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:bg-[#f8fafc]";
export const theadRowClassName = "border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a] [&>th]:whitespace-nowrap";
export const rowClassName = "border-b border-[#f1f5f9] transition hover:bg-[#f8fafc]";

const iconButtonVariants = {
    primary: "bg-[#e3000f] text-white hover:bg-[#b40009]",
    default: "border border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]",
    ghost: "text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]",
    danger: "text-[#930006] hover:bg-[#fff4f2] hover:text-[#e3000f]",
};

// Icon-only action: the label lives in title + aria-label.
export function IconButton({
    icon: Icon,
    label,
    onClick,
    disabled,
    variant = "default",
    size = "md",
}: {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    variant?: keyof typeof iconButtonVariants;
    size?: "sm" | "md";
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${
                size === "sm" ? "h-7 w-7" : "h-9 w-9"
            } ${iconButtonVariants[variant]}`}
        >
            <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
    );
}

export function SearchField({
    value,
    onChange,
    onEnter,
    placeholder,
    wide,
}: {
    value: string;
    onChange: (value: string) => void;
    onEnter: () => void;
    placeholder: string;
    wide?: boolean;
}) {
    const t = useTranslations("usbLog");
    return (
        <div className={`relative w-full ${wide ? "sm:w-64" : "sm:w-48"}`}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8f94]" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onEnter()}
                placeholder={placeholder}
                aria-label={t("common.search")}
                className={`${fieldClassName} w-full pl-8`}
            />
        </div>
    );
}

export function DateRange({ from, to, onChange, title }: { from: string; to: string; onChange: (next: { fromDate: string; toDate: string }) => void; title?: string }) {
    const t = useTranslations("usbLog");
    return (
        <div className="flex items-center gap-1" title={title ?? t("common.dateRange")}>
            <input type="date" value={from} onChange={(event) => onChange({ fromDate: event.target.value, toDate: to })} aria-label={t("common.fromDate")} className={`${fieldClassName} w-36`} />
            <span className="text-[#8a8f94]">–</span>
            <input type="date" value={to} onChange={(event) => onChange({ fromDate: from, toDate: event.target.value })} aria-label={t("common.toDate")} className={`${fieldClassName} w-36`} />
        </div>
    );
}

export function ToggleChip({
    checked,
    onChange,
    icon: Icon,
    label,
    title,
    compact,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: LucideIcon;
    label: string;
    title?: string;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            aria-pressed={checked}
            onClick={() => onChange(!checked)}
            title={title ?? label}
            aria-label={label}
            className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-sm font-medium transition ${
                checked ? "border-[#e9bcb6] bg-[#fff4f2] text-[#e3000f]" : "border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6]"
            }`}
        >
            <Icon className="h-4 w-4" />
            {/* Icon-only between sm and 2xl so the filter row fits one line at 1366px; phones wrap anyway and keep the text. */}
            <span className={compact ? "sm:hidden 2xl:inline" : undefined}>{label}</span>
        </button>
    );
}

// Search / clear / refresh trio shared by every filtered USB list.
export function FilterActions({ onSearch, onReset, onRefresh, disabled }: { onSearch: () => void; onReset: () => void; onRefresh?: () => void; disabled: boolean }) {
    const t = useTranslations("usbLog");
    return (
        <div className="flex items-center gap-1.5">
            <IconButton icon={Search} label={t("common.search")} onClick={onSearch} disabled={disabled} variant="primary" />
            <IconButton icon={FilterX} label={t("common.clearFilter")} onClick={onReset} disabled={disabled} />
            {onRefresh && <IconButton icon={RefreshCw} label={t("common.refresh")} onClick={onRefresh} disabled={disabled} />}
        </div>
    );
}

// Filter row at the top of the list card; trailing actions sit on the right.
export function ListToolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e3e5] px-3 py-2.5">
            {children}
            {actions && <div className="flex items-center gap-1.5 sm:ml-auto">{actions}</div>}
        </div>
    );
}

// Skeleton while the first page loads, empty state once it returns nothing.
export function TableStatusRows({ loading, empty, columns, emptyText }: { loading: boolean; empty: boolean; columns: number; emptyText?: string }) {
    const t = useTranslations("usbLog");
    if (!empty) return null;
    if (loading) return <TableSkeletonRows rows={5} columns={columns} />;
    return (
        <tr>
            <td colSpan={columns}>
                <EmptyState icon={SearchX} title={emptyText ?? t("common.noData")} />
            </td>
        </tr>
    );
}

const flagTones = {
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-[#fde8e8] text-[#930006]",
    warning: "bg-[#fff4e5] text-[#9a5b00]",
    neutral: "bg-[#f2f4f6] text-[#5e3f3a]",
};

// Icon-only status marker next to a name. aria-label, not an sr-only child: absolute children escape the table's scroll box.
export function IconFlag({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: keyof typeof flagTones }) {
    return (
        <span role="img" aria-label={label} title={label} className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${flagTones[tone]}`}>
            <Icon className="h-3 w-3" aria-hidden />
        </span>
    );
}

const dotTones = { online: "bg-emerald-500", offline: "bg-[#e3000f]", idle: "bg-[#c4c9cd]" };

export function StatusDot({ tone, label }: { tone: keyof typeof dotTones; label: string }) {
    return (
        <span role="img" aria-label={label} title={label} className="inline-flex h-4 w-2 shrink-0 items-center">
            <span className={`h-2 w-2 rounded-full ${dotTones[tone]}`} />
        </span>
    );
}

export function ErrorBar({ message }: { message: string | null | undefined }) {
    if (!message) return null;
    return <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-2.5 text-sm text-[#930006]">{message}</div>;
}
