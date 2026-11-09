"use client";

import { User, X } from "lucide-react";

import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

export interface StepHoldersLabels {
    holdersLabel: string;
    loadingEmployees: string;
    noHolders: string;
    removeHolderHint: string;
    addHolderPlaceholder: string;
}

interface HolderItem {
    id: number;
    lastName: string;
    firstName: string;
    code: string;
    badge?: string | null;
    // Managed elsewhere, so this list only shows them.
    locked?: boolean;
}

export default function StepHolders({
    holders,
    isLoadingEmployees,
    removingHolderId,
    onRemoveHolder,
    addOptions,
    addingValue,
    onAddChange,
    onAddQueryChange,
    labels,
    readOnly = false,
}: {
    holders: HolderItem[];
    isLoadingEmployees: boolean;
    removingHolderId: number | null;
    onRemoveHolder: (holder: HolderItem) => void;
    addOptions: SelectOption[];
    addingValue: number | "";
    onAddChange: (value: number | "") => void;
    onAddQueryChange?: (query: string) => void;
    labels: StepHoldersLabels;
    readOnly?: boolean;
}) {
    return (
        <div className="relative ml-[1.35rem] pb-1 pl-5" title={labels.holdersLabel}>
            {isLoadingEmployees ? (
                <div className="py-1 text-xs text-[#8a8f94]">{labels.loadingEmployees}</div>
            ) : (
                <ul>
                    {holders.length === 0 && (
                        <TreeLeaf>
                            <span className="text-xs italic text-[#8a8f94]">{labels.noHolders}</span>
                        </TreeLeaf>
                    )}
                    {holders.map((holder) => (
                        <TreeLeaf key={holder.id}>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#191c1e]">
                                <User size={12} className="text-[#8a8f94]" />
                                {holder.lastName} {holder.firstName}
                                <span className="rounded bg-[#f2f4f6] px-1.5 py-px text-[11px] text-[#5e3f3a]">{holder.code}</span>
                                {holder.badge && <span className="rounded bg-[#fff4f2] px-1.5 py-px text-[11px] text-[#930006]">{holder.badge}</span>}
                                {!readOnly && !holder.locked && <button
                                    type="button"
                                    onClick={() => onRemoveHolder(holder)}
                                    disabled={removingHolderId === holder.id}
                                    title={labels.removeHolderHint}
                                    aria-label={labels.removeHolderHint}
                                    className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <X size={11} />
                                </button>}
                            </span>
                        </TreeLeaf>
                    ))}
                    {!readOnly && <TreeLeaf>
                        <div className="w-44">
                            <SearchableSelect
                                options={addOptions}
                                value={addingValue}
                                onChange={onAddChange}
                                onQueryChange={onAddQueryChange}
                                placeholder={labels.addHolderPlaceholder}
                                disabled={removingHolderId !== null}
                                triggerClassName="h-6 rounded-md border border-dashed border-[#e0e3e5] bg-white px-2 pr-6 text-[11px]! text-[#8a8f94] outline-none transition hover:border-[#e3000f] focus:border-[#e3000f]"
                            />
                        </div>
                    </TreeLeaf>}
                </ul>
            )}
        </div>
    );
}

// One leaf of the holder tree: vertical guide + horizontal elbow (guide stops at the elbow on the last leaf).
function TreeLeaf({ children }: { children: React.ReactNode }) {
    return (
        <li className="group/leaf relative flex min-h-6 items-center pl-4">
            <span className="absolute -left-2.5 bottom-0 top-0 w-px bg-[#d5d9dd] group-last/leaf:bottom-auto group-last/leaf:h-1/2" aria-hidden />
            <span className="absolute -left-2.5 top-1/2 h-px w-3 bg-[#d5d9dd]" aria-hidden />
            {children}
        </li>
    );
}
