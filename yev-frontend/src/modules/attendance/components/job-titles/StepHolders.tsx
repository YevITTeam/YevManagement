"use client";

import { X } from "lucide-react";

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
}

// "Đang giữ chức vụ X" — chip list + combobox thêm, dùng chung cho khối Nhóm/Bộ phận VÀ nhánh
// "không tự động theo Line Leader" của khối Chuyền (2026-09-05, tách khỏi ApprovalStepManager.tsx cùng
// đợt với StepCard.tsx — 3 nơi copy y hệt JSX này trước đó).
export default function StepHolders({
    holders,
    isLoadingEmployees,
    removingHolderId,
    onRemoveHolder,
    addOptions,
    addingValue,
    onAddChange,
    labels,
}: {
    holders: HolderItem[];
    isLoadingEmployees: boolean;
    removingHolderId: number | null;
    onRemoveHolder: (holder: HolderItem) => void;
    addOptions: SelectOption[];
    addingValue: number | "";
    onAddChange: (value: number | "") => void;
    labels: StepHoldersLabels;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 pl-8">
            <span className="text-xs font-semibold text-[#8a8f94]">{labels.holdersLabel}</span>
            {isLoadingEmployees ? (
                <span className="text-xs text-[#8a8f94]">{labels.loadingEmployees}</span>
            ) : (
                <>
                    {holders.length === 0 ? (
                        <span className="text-xs italic text-[#8a8f94]">{labels.noHolders}</span>
                    ) : (
                        holders.map((holder) => (
                            <span
                                key={holder.id}
                                className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                            >
                                {holder.lastName} {holder.firstName} ({holder.code})
                                <button
                                    type="button"
                                    onClick={() => onRemoveHolder(holder)}
                                    disabled={removingHolderId === holder.id}
                                    title={labels.removeHolderHint}
                                    aria-label={labels.removeHolderHint}
                                    className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <X size={10} />
                                </button>
                            </span>
                        ))
                    )}
                    <div className="w-56 shrink-0">
                        <SearchableSelect
                            options={addOptions}
                            value={addingValue}
                            onChange={onAddChange}
                            placeholder={labels.addHolderPlaceholder}
                            disabled={removingHolderId !== null}
                            triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                        />
                    </div>
                </>
            )}
        </div>
    );
}
