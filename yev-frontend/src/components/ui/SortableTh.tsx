import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide } from "lucide-react";

// Server-side column sort; no sortBy = the list's default order.
export interface SortState {
    sortBy?: string;
    sortDesc: boolean;
}

export const NO_SORT: SortState = { sortDesc: false };

// Clicking the same column cycles ascending → descending → default order (same as DeviceList).
export function nextSort(current: SortState, key: string): SortState {
    if (current.sortBy !== key) return { sortBy: key, sortDesc: false };
    return current.sortDesc ? NO_SORT : { sortBy: key, sortDesc: true };
}

interface SortableThProps {
    label: string;
    sortKey: string;
    sort: SortState;
    onSort: (next: SortState) => void;
    className?: string;
}

export function SortableTh({ label, sortKey, sort, onSort, className = "" }: SortableThProps) {
    const active = sort.sortBy === sortKey;
    return (
        <th className={className} aria-sort={active ? (sort.sortDesc ? "descending" : "ascending") : undefined}>
            <button
                type="button"
                onClick={() => onSort(nextSort(sort, sortKey))}
                title={`Sắp xếp theo ${label.toLowerCase()}`}
                className={`inline-flex cursor-pointer items-center gap-1.5 uppercase transition hover:text-[#191c1e] ${active ? "text-[#191c1e]" : ""}`}
            >
                {label}
                {!active && <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                {active && !sort.sortDesc && <ArrowUpNarrowWide className="h-3.5 w-3.5" />}
                {active && sort.sortDesc && <ArrowDownWideNarrow className="h-3.5 w-3.5" />}
            </button>
        </th>
    );
}
