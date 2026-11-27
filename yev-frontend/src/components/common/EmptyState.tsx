import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    /** Smaller padding and icon for empty sections inside a card. */
    compact?: boolean;
}

// Put inside a <td colSpan> for tables, or directly inside a card/list body.
export function EmptyState({ icon: Icon, title, description, compact }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center gap-2 text-center ${compact ? "py-4" : "py-10"}`}>
            <Icon className={`${compact ? "h-6 w-6" : "h-10 w-10"} text-[#c4c9cd]`} />
            <p className="text-sm font-semibold text-[#191c1e]">{title}</p>
            {description && <p className="text-xs text-[#8a8f94]">{description}</p>}
        </div>
    );
}
