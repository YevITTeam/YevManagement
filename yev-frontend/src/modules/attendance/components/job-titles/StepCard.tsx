"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

// Shared by the group/department/production blocks; the people part differs per block, so it comes in via `footer`.
export interface StepCardLabels {
    dragHandleLabel: string;
    toggleSignatureHint: string;
    requiresSignatureYes: string;
    requiresSignatureNo: string;
    removeStep: string;
    // Only needed with `onToggleResponsible` (the department block omits these keys).
    toggleResponsibleHint?: string;
    isResponsibleYes?: string;
    isResponsibleNo?: string;
    toggleResubmitHint?: string;
    canResubmitYes?: string;
    canResubmitNo?: string;
    toggleResubmitSkipHint?: string;
    resubmitSkipYes?: string;
    resubmitSkipNo?: string;
}

// Header and rows share one grid, so the ticks line up across blocks; @2xl reads the enclosing card's width.
// The people track stops at 24rem so the ticks stay close to the names on wide screens.
const ROW_GRID = "@2xl:grid @2xl:grid-cols-[11rem_minmax(0,24rem)_auto_1fr]";
const SIGN_WIDTH = "@2xl:w-10";
const RESPONSIBLE_WIDTH = "@2xl:w-28";
const RESUBMIT_WIDTH = "@2xl:w-44";
const REMOVE_WIDTH = "w-7";

const controlClassName = "h-4 w-4 shrink-0 cursor-pointer accent-[#e3000f] disabled:cursor-not-allowed";
const cellClassName = "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 @2xl:justify-center";
const inlineLabelClassName = "whitespace-nowrap text-xs text-[#5e3f3a] @2xl:hidden";

export function StepSectionHeader({ children, columns }: { children: React.ReactNode; columns?: React.ReactNode }) {
    return (
        <div className={`mb-2 flex items-center gap-x-3 px-1.5 ${ROW_GRID}`}>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 @2xl:col-span-2">
                {children}
                <div className="h-px flex-1 bg-[#e0e3e5]" />
            </div>
            {columns}
        </div>
    );
}

// signUsed: requester boxes taken out of the 2 on the paper form; omitted where there is no such limit.
export function StepColumnHeaders({
    showResponsible = false,
    showResubmit = false,
    signUsed,
    signHint,
}: {
    showResponsible?: boolean;
    showResubmit?: boolean;
    signUsed?: number;
    signHint?: string;
}) {
    const t = useTranslations("Attendance.JobTitle");
    return (
        <div className="hidden items-center gap-2 text-xs font-medium text-[#5e3f3a] @2xl:flex">
            <span className={`${SIGN_WIDTH} whitespace-nowrap text-center`} title={signHint}>
                {t("columnSign")}
                {signUsed !== undefined && <span className={signUsed >= 2 ? "text-[#9a5b00]" : "text-[#8a8f94]"}> {signUsed}/2</span>}
            </span>
            <span className={`${RESPONSIBLE_WIDTH} whitespace-nowrap text-center`}>{showResponsible && t("columnResponsible")}</span>
            <span className={`${RESUBMIT_WIDTH} whitespace-nowrap`}>{showResubmit && t("columnResubmit")}</span>
            <span className={REMOVE_WIDTH} />
        </div>
    );
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
    // Both requester boxes are taken, so an unticked Sign box can't be ticked.
    signLocked?: boolean;
    // undefined = the block has no "responsible person" concept (department block).
    isResponsible?: boolean;
    onToggleResponsible?: () => void;
    // undefined = the block has no re-submit flag (only the Group block does).
    canResubmit?: boolean;
    onToggleResubmit?: () => void;
    // Only shown while canResubmit is on.
    resubmitSkipsIntermediate?: boolean;
    onToggleResubmitSkip?: () => void;
    onRemove: () => void;
    labels: StepCardLabels;
    footer?: React.ReactNode;
    readOnly?: boolean;
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
    signLocked = false,
    isResponsible,
    onToggleResponsible,
    canResubmit,
    onToggleResubmit,
    resubmitSkipsIntermediate,
    onToggleResubmitSkip,
    onRemove,
    labels,
    footer,
    readOnly = false,
}: StepCardProps) {
    const tJobTitle = useTranslations("Attendance.JobTitle");
    const codeWithRank = tJobTitle("codeWithRank", { code: jobTitleCode, rank: rankOrder });
    const editable = !readOnly;

    return (
        <li
            ref={registerNodeRef}
            draggable={editable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className="group/step border-b border-[#f1f5f9] last:border-b-0"
        >
            <div
                className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md px-1.5 py-1.5 transition-[background-color,box-shadow] duration-150 ${ROW_GRID} ${
                    isDragging ? "bg-[#fff4f2] shadow-md ring-2 ring-[#e3000f]/25" : ""
                }`}
            >
                <div className="flex h-8 w-full items-center gap-2 @2xl:w-auto">
                    {editable ? (
                        <span title={labels.dragHandleLabel} aria-label={labels.dragHandleLabel} className="shrink-0 cursor-grab text-[#b6bbc0] hover:text-[#5e3f3a] active:cursor-grabbing">
                            <GripVertical className="h-4 w-4" />
                        </span>
                    ) : (
                        <span className="w-4 shrink-0" aria-hidden />
                    )}
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-[11px] font-bold text-white">
                        {displayNumber}
                    </span>
                    <span className="min-w-0 text-sm font-semibold text-[#191c1e]" title={`${jobTitleName} (${codeWithRank})`}>
                        {jobTitleName}
                    </span>
                </div>

                <div className="order-last w-full min-w-0 @2xl:order-none @2xl:w-auto">{footer}</div>

                <div className="flex flex-wrap items-start gap-2 @2xl:flex-nowrap">
                    <label className={`${cellClassName} ${SIGN_WIDTH}`} title={`${requiresSignature ? labels.requiresSignatureYes : labels.requiresSignatureNo} — ${labels.toggleSignatureHint}`}>
                        <input
                            type="checkbox"
                            checked={requiresSignature}
                            onChange={onToggleSignature}
                            disabled={readOnly || (signLocked && !requiresSignature)}
                            aria-label={labels.requiresSignatureYes}
                            className={controlClassName}
                        />
                        <span className={inlineLabelClassName}>{tJobTitle("columnSign")}</span>
                    </label>

                    {onToggleResponsible ? (
                        <label className={`${cellClassName} ${RESPONSIBLE_WIDTH}`} title={`${isResponsible ? labels.isResponsibleYes : labels.isResponsibleNo} — ${labels.toggleResponsibleHint}`}>
                            {/* onClick, not onChange: a checked radio fires no change, yet clicking it must still clear the pick. */}
                            <input
                                type="radio"
                                checked={!!isResponsible}
                                readOnly
                                onClick={onToggleResponsible}
                                disabled={readOnly}
                                aria-label={labels.isResponsibleYes}
                                className={controlClassName}
                            />
                            <span className={inlineLabelClassName}>{tJobTitle("columnResponsible")}</span>
                        </label>
                    ) : (
                        <span className={`hidden @2xl:block ${RESPONSIBLE_WIDTH}`} aria-hidden />
                    )}

                    {onToggleResubmit ? (
                        <div className={`flex shrink-0 flex-wrap items-center gap-x-3 ${RESUBMIT_WIDTH}`}>
                            <label className="inline-flex h-8 cursor-pointer items-center gap-1" title={`${canResubmit ? labels.canResubmitYes : labels.canResubmitNo} — ${labels.toggleResubmitHint}`}>
                                <input
                                    type="checkbox"
                                    checked={!!canResubmit}
                                    onChange={onToggleResubmit}
                                    disabled={readOnly}
                                    aria-label={labels.canResubmitYes}
                                    className={controlClassName}
                                />
                                <span className={inlineLabelClassName}>{tJobTitle("columnResubmit")}</span>
                            </label>
                            {onToggleResubmitSkip && canResubmit && (
                                <label className="inline-flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap text-xs text-[#5e3f3a]" title={`${resubmitSkipsIntermediate ? labels.resubmitSkipYes : labels.resubmitSkipNo} — ${labels.toggleResubmitSkipHint}`}>
                                    <input
                                        type="checkbox"
                                        checked={!!resubmitSkipsIntermediate}
                                        onChange={onToggleResubmitSkip}
                                        disabled={readOnly}
                                        className={controlClassName}
                                    />
                                    {labels.resubmitSkipYes}
                                </label>
                            )}
                        </div>
                    ) : (
                        <span className={`hidden @2xl:block ${RESUBMIT_WIDTH}`} aria-hidden />
                    )}

                    {/* Always takes its slot; only the opacity changes, so the row never shifts on hover. */}
                    {editable ? (
                        <button
                            type="button"
                            onClick={onRemove}
                            title={labels.removeStep}
                            aria-label={labels.removeStep}
                            className={`flex h-8 ${REMOVE_WIDTH} shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] focus-visible:opacity-100 @2xl:opacity-0 @2xl:group-hover/step:opacity-100`}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <span className={`hidden shrink-0 @2xl:block ${REMOVE_WIDTH}`} aria-hidden />
                    )}
                </div>
            </div>
        </li>
    );
}
