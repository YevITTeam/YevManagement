"use client";

import { Check, GripVertical, PenLine, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

// Thẻ 1 bước duyệt — tách dùng chung cho cả 3 khối (Nhóm/Bộ phận/Chuyền) của ApprovalStepManager.tsx
// (2026-09-05, đợt polish giao diện). Trước đó 3 khối copy gần y hệt ~110 dòng JSX mỗi nơi — khác nhau
// đúng 2 điểm: (1) khối Bộ phận không có pill "Người chịu trách nhiệm" (bỏ qua `onToggleResponsible`),
// (2) phần "đang giữ chức vụ" bên dưới khác hẳn giữa 3 khối (Nhóm/Bộ phận: luôn là danh sách holder;
// Chuyền: tuỳ `isLineScoped`/`terminalLevel` mà đổi hẳn nội dung) — nên phần đó vẫn để nguyên ở component
// cha, truyền vào đây qua prop `footer`.
//
// Đợt polish (2026-09-16, "pipeline dọc"): số thứ tự + tay cầm kéo chuyển ra 1 cột riêng bên trái
// ("rail") nối bằng 1 đường kẻ dọc xuyên suốt danh sách — trực quan hoá đây là 1 CHUỖI bước nối tiếp
// nhau thay vì các thẻ rời rạc. Props/hành vi (drag, toggle, remove) giữ nguyên 100%, chỉ đổi bố cục.
export interface StepCardLabels {
    dragHandleLabel: string;
    toggleSignatureHint: string;
    requiresSignatureYes: string;
    requiresSignatureNo: string;
    removeStep: string;
    // Chỉ cần khi có `onToggleResponsible` (khối Bộ phận không dùng 3 key này).
    toggleResponsibleHint?: string;
    isResponsibleYes?: string;
    isResponsibleNo?: string;
}

interface StepCardProps {
    registerNodeRef: (el: HTMLElement | null) => void;
    isDragging: boolean;
    onDragStart: (event: React.DragEvent) => void;
    onDragOver: (event: React.DragEvent) => void;
    onDragEnd: () => void;
    displayNumber: number;
    jobTitleName: string;
    jobTitleCode: string;
    rankOrder: number;
    requiresSignature: boolean;
    onToggleSignature: () => void;
    // undefined = khối này không có khái niệm "Người chịu trách nhiệm" (khối Bộ phận).
    isResponsible?: boolean;
    onToggleResponsible?: () => void;
    onRemove: () => void;
    labels: StepCardLabels;
    footer?: React.ReactNode;
}

export default function StepCard({
    registerNodeRef,
    isDragging,
    onDragStart,
    onDragOver,
    onDragEnd,
    displayNumber,
    jobTitleName,
    jobTitleCode,
    rankOrder,
    requiresSignature,
    onToggleSignature,
    isResponsible,
    onToggleResponsible,
    onRemove,
    labels,
    footer,
}: StepCardProps) {
    const tJobTitle = useTranslations("Attendance.JobTitle");
    const codeWithRank = tJobTitle("codeWithRank", { code: jobTitleCode, rank: rankOrder });

    return (
        <li
            ref={registerNodeRef}
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className="group/step relative pl-7"
        >
            {/* Tree connectors: vertical guide (stops at the elbow on the last node) + horizontal elbow. */}
            <span className="absolute bottom-0 left-2.5 top-0 w-px bg-[#d5d9dd] group-last/step:bottom-auto group-last/step:h-4" aria-hidden />
            <span className="absolute left-2.5 top-4 h-px w-4 bg-[#d5d9dd]" aria-hidden />
            <div
                className={`rounded-md transition-[background-color,box-shadow] duration-150 ${
                    isDragging ? "bg-[#fff4f2] shadow-md ring-2 ring-[#e3000f]/25" : ""
                }`}
            >
                <div className="flex flex-wrap items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#f2f4f7] lg:flex-nowrap">
                    <span title={labels.dragHandleLabel} aria-label={labels.dragHandleLabel} className="shrink-0 cursor-grab text-[#b6bbc0] hover:text-[#5e3f3a] active:cursor-grabbing">
                        <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-[11px] font-bold text-white">
                        {displayNumber}
                    </span>
                    <div className="flex min-w-0 items-center gap-2" title={`${jobTitleName} (${codeWithRank})`}>
                        <span className="min-w-0 truncate text-sm font-semibold text-[#191c1e]">{jobTitleName}</span>
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#f2f4f6] px-2 py-0.5 text-[11px] font-medium text-[#5e3f3a]">
                            {codeWithRank}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onToggleSignature}
                        title={`${requiresSignature ? labels.requiresSignatureYes : labels.requiresSignatureNo} — ${labels.toggleSignatureHint}`}
                        aria-pressed={requiresSignature}
                        className={`inline-flex h-6 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border text-[11px]! font-semibold! transition ${
                            requiresSignature
                                ? "border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100"
                                : "w-6 border-transparent text-[#b6bbc0] hover:border-[#e0e3e5] hover:bg-[#f2f4f6] hover:text-[#5e3f3a]"
                        }`}
                    >
                        {requiresSignature ? <Check size={11} /> : <PenLine size={12} />}
                        {requiresSignature && labels.requiresSignatureYes}
                    </button>
                    {onToggleResponsible && (
                        <button
                            type="button"
                            onClick={onToggleResponsible}
                            title={`${isResponsible ? labels.isResponsibleYes : labels.isResponsibleNo} — ${labels.toggleResponsibleHint}`}
                            aria-pressed={isResponsible}
                            className={`inline-flex h-6 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border text-[11px]! font-semibold! transition ${
                                isResponsible
                                    ? "border-amber-200 bg-amber-50 px-2 text-amber-700 hover:bg-amber-100"
                                    : "w-6 border-transparent text-[#b6bbc0] hover:border-[#e0e3e5] hover:bg-[#f2f4f6] hover:text-[#5e3f3a]"
                            }`}
                        >
                            <Star size={11} fill={isResponsible ? "currentColor" : "none"} />
                            {isResponsible && labels.isResponsibleYes}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onRemove}
                        title={labels.removeStep}
                        aria-label={labels.removeStep}
                        className="ml-auto shrink-0 cursor-pointer rounded-md p-1.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006]"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>

                {footer}
            </div>
        </li>
    );
}
