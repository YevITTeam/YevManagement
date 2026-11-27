"use client";

import { TriangleAlert, X } from "lucide-react";

import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";

export interface StepHoldersLabels {
    holdersLabel: string;
    noHolders: string;
    noHoldersHint: string;
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

export const peopleListClassName = "pl-1.5 @2xl:pl-0";
export const personMessageClassName = "flex min-h-8 items-center gap-1.5 text-xs italic text-[#8a8f94]";
// The panel opens at least 240px wide, so the trigger can stay a short text link.
export const addPersonRowClassName = "w-24";
export const addPersonTriggerClassName =
    "h-6 w-full rounded-md bg-transparent px-1.5 pr-6 text-xs! text-[#8a8f94] outline-none transition hover:bg-[#f2f4f6] hover:text-[#191c1e] focus:text-[#191c1e]";
export const personButtonClassName = "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition";

export function PersonRow({
    name,
    code,
    badge,
    onRemove,
    removeLabel,
    removeDisabled,
    children,
}: {
    name: string;
    code: string;
    badge?: string | null;
    onRemove?: () => void;
    removeLabel: string;
    removeDisabled?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <li className="flex min-h-8 items-center gap-2 text-xs text-[#191c1e]">
            <span className="min-w-16 shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[#8a8f94]">{code}</span>
            <span className="min-w-0">{name}</span>
            {badge && <span className="whitespace-nowrap rounded bg-[#fff4f2] px-1.5 py-px text-[11px] text-[#930006]">{badge}</span>}
            <span className="inline-flex shrink-0 items-center">
                {children}
                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={removeDisabled}
                        title={removeLabel}
                        aria-label={removeLabel}
                        className={`${personButtonClassName} text-[#8a8f94] hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                        <X size={12} />
                    </button>
                )}
            </span>
        </li>
    );
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
    if (isLoadingEmployees) return <Skeleton className="my-1.5 h-5 w-40" />;

    return (
        <ul className={peopleListClassName} title={labels.holdersLabel}>
            {holders.length === 0 && (
                <li className={personMessageClassName} title={labels.noHoldersHint}>
                    <TriangleAlert className="h-3.5 w-3.5 not-italic text-[#9a5b00]" aria-label={labels.noHoldersHint} />
                    {labels.noHolders}
                </li>
            )}
            {holders.map((holder) => (
                <PersonRow
                    key={holder.id}
                    name={`${holder.lastName} ${holder.firstName}`}
                    code={holder.code}
                    badge={holder.badge}
                    onRemove={readOnly || holder.locked ? undefined : () => onRemoveHolder(holder)}
                    removeLabel={labels.removeHolderHint}
                    removeDisabled={removingHolderId === holder.id}
                />
            ))}
            {!readOnly && (
                <li className={addPersonRowClassName}>
                    <SearchableSelect
                        options={addOptions}
                        value={addingValue}
                        onChange={onAddChange}
                        onQueryChange={onAddQueryChange}
                        placeholder={labels.addHolderPlaceholder}
                        disabled={removingHolderId !== null}
                        triggerClassName={addPersonTriggerClassName}
                    />
                </li>
            )}
        </ul>
    );
}
