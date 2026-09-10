import type { ReactNode } from "react";

// Status pill (DESIGN_SYSTEM.md §4.6). Colors are exactly the ones already hand-rolled per-screen
// in the Workflow module (FormDefinitionList.isPublished, WorkflowRequestList.STATUS_META) —
// centralized here instead of re-declaring the same bg/text pair in every file.
export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    neutral: "bg-[#f2f4f6] text-[#5e3f3a]",
    info: "bg-[#e8f0fe] text-[#1a56db]",
    success: "bg-[#e6f4ea] text-[#1e7a34]",
    warning: "bg-[#fff8ee] text-[#8a5a00]",
    danger: "bg-[#fde8e8] text-[#930006]",
};

interface BadgeProps {
    variant: BadgeVariant;
    withDot?: boolean;
    children: ReactNode;
}

export function Badge({ variant, withDot, children }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${VARIANT_CLASSES[variant]}`}
        >
            {withDot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
            {children}
        </span>
    );
}
