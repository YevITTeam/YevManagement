import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
}

// Put inside a <td colSpan> for tables, or directly inside a card/list body.
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Icon className="h-10 w-10 text-[#c4c9cd]" />
            <p className="text-sm font-semibold text-[#191c1e]">{title}</p>
            {description && <p className="text-xs text-[#8a8f94]">{description}</p>}
        </div>
    );
}
