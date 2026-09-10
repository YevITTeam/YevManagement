// Loading placeholder (DESIGN_SYSTEM.md §4.4: "Loading skeleton: bg-[#f1f5f9] rounded animate-pulse").
// Size the block with className (h-4 w-32, h-8 w-8 rounded-full, ...).
export function Skeleton({ className = "" }: { className?: string }) {
    return <span className={`block animate-pulse rounded bg-[#f1f5f9] ${className}`} />;
}
