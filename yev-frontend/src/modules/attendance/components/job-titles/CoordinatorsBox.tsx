"use client";

import { Users, X } from "lucide-react";

import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import AvatarStack from "@/components/ui/AvatarStack";

export interface CoordinatorsBoxLabels {
    title: string;
    hint: string;
    label: string;
    loading: string;
    noCoordinators: string;
    notLinked: string;
    notLinkedHint: string;
    removeHint: string;
    addPlaceholder: string;
}

interface CoordinatorItem {
    employeeId: number;
    fullName: string;
    employeeCode: string;
    userName: string | null;
}

// Khối "Người phụ trách Cây duyệt" — tách dùng chung cho khối Nhóm + khối Bộ phận (2026-09-05, cùng
// đợt polish với StepCard.tsx/StepHolders.tsx). 2 khối trước đó copy y hệt ~60 dòng JSX này, chỉ khác
// nguồn dữ liệu/handler truyền vào.
export default function CoordinatorsBox({
    isLoading,
    coordinators,
    onRemove,
    isSaving,
    addOptions,
    addingValue,
    onAddChange,
    labels,
}: {
    isLoading: boolean;
    coordinators: CoordinatorItem[];
    onRemove: (employeeId: number) => void;
    isSaving: boolean;
    addOptions: SelectOption[];
    addingValue: number | "";
    onAddChange: (value: number | "") => void;
    labels: CoordinatorsBoxLabels;
}) {
    return (
        <div className="space-y-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
            <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#8a8f94]" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{labels.title}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[#8a8f94]">{labels.label}</span>
                {isLoading ? (
                    <span className="text-xs text-[#8a8f94]">{labels.loading}</span>
                ) : (
                    <>
                        <AvatarStack people={coordinators.map((c) => ({ id: c.employeeId, name: c.fullName, code: c.employeeCode }))} />
                        {coordinators.length === 0 ? (
                            <span className="text-xs italic text-[#8a8f94]">{labels.noCoordinators}</span>
                        ) : (
                            coordinators.map((coordinator) => (
                                <span
                                    key={coordinator.employeeId}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-white py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                                >
                                    {coordinator.fullName} ({coordinator.employeeCode})
                                    {!coordinator.userName && (
                                        <span className="text-[#9a5b00]" title={labels.notLinkedHint}>
                                            — {labels.notLinked}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onRemove(coordinator.employeeId)}
                                        disabled={isSaving}
                                        title={labels.removeHint}
                                        aria-label={labels.removeHint}
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
                                placeholder={labels.addPlaceholder}
                                disabled={isSaving}
                                triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
