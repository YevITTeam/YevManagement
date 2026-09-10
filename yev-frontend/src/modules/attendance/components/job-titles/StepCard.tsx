"use client";

import { Check, GripVertical, Star, Trash2, X } from "lucide-react";

// Thẻ 1 bước duyệt — tách dùng chung cho cả 3 khối (Nhóm/Bộ phận/Chuyền) của ApprovalStepManager.tsx
// (2026-09-05, đợt polish giao diện). Trước đó 3 khối copy gần y hệt ~110 dòng JSX mỗi nơi — khác nhau
// đúng 2 điểm: (1) khối Bộ phận không có pill "Người chịu trách nhiệm" (bỏ qua `onToggleResponsible`),
// (2) phần "đang giữ chức vụ" bên dưới khác hẳn giữa 3 khối (Nhóm/Bộ phận: luôn là danh sách holder;
// Chuyền: tuỳ `isLineScoped`/`terminalLevel` mà đổi hẳn nội dung) — nên phần đó vẫn để nguyên ở component
// cha, truyền vào đây qua prop `footer`.
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
    return (
        <li
            ref={registerNodeRef}
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className={`relative space-y-2 rounded-lg border p-3 transition-[box-shadow,border-color,background-color] duration-150 ${
                isDragging
                    ? "z-10 scale-[1.01] border-[#e3000f] bg-[#fff4f2] shadow-lg ring-2 ring-[#e3000f]/25"
                    : "border-[#e0e3e5] bg-white"
            }`}
        >
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                <span
                    title={labels.dragHandleLabel}
                    aria-label={labels.dragHandleLabel}
                    className="shrink-0 cursor-grab text-[#8a8f94] active:cursor-grabbing"
                >
                    <GripVertical className="h-4 w-4" />
                </span>
                <div className="flex w-[230px] shrink-0 items-center gap-2" title={`${jobTitleName} (${jobTitleCode}, cấp ${rankOrder})`}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                        {displayNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191c1e]">{jobTitleName}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-[#8a8f94]">({jobTitleCode}, cấp {rankOrder})</span>
                </div>
                <button
                    type="button"
                    onClick={onToggleSignature}
                    title={labels.toggleSignatureHint}
                    className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                        requiresSignature
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                    }`}
                >
                    {requiresSignature ? <Check size={11} /> : <X size={11} />}
                    {requiresSignature ? labels.requiresSignatureYes : labels.requiresSignatureNo}
                </button>
                {onToggleResponsible && (
                    <button
                        type="button"
                        onClick={onToggleResponsible}
                        title={labels.toggleResponsibleHint}
                        className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                            isResponsible
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                        }`}
                    >
                        <Star size={11} fill={isResponsible ? "currentColor" : "none"} />
                        {isResponsible ? labels.isResponsibleYes : labels.isResponsibleNo}
                    </button>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onRemove}
                        title={labels.removeStep}
                        aria-label={labels.removeStep}
                        className="cursor-pointer rounded-md border border-[#e9bcb6] bg-white p-2 text-[#930006] transition hover:bg-[#fff4f2]"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {footer}
        </li>
    );
}
