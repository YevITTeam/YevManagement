"use client";

import { Fragment, useState } from "react";
import { TimeRange } from "@/modules/attendance/components/ot-form/TimeRange";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { CalendarDays, Car, Check, CheckCircle2, ChevronDown, Clock, Inbox, MessageCircle, Printer, Send, User, Users, X } from "lucide-react";

import { OtFormBatchApi } from "@/modules/attendance/api/ot-form-batch.api";
import type { OtFormBatchDto, ProcessOtFormBatchFormDto } from "@/modules/attendance/types/ot-form-batch.dto";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { formatHours } from "@/modules/attendance/lib/time";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import OtCaseBadge from "@/modules/attendance/components/OtCaseBadge";
import {
    AccumulationHours,
    exceededLimits,
    mealCountsText,
    MealTicketTypeBadge,
    ProcessPartTile,
} from "@/modules/attendance/components/ot-form/MealTicketTypeBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconFlag } from "@/components/ui/ListToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import FormDialog from "@/components/common/FormDialog";

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

interface FormDecisionState {
    decision: 0 | 1; // OtFormBatchFormDecision: 0=Approve, 1=Reject
    rejectReason: string;
    excludedEmployeeIds: Set<number>;
}

function buildInitialDecisions(batch: OtFormBatchDto): Record<number, FormDecisionState> {
    const result: Record<number, FormDecisionState> = {};
    for (const form of batch.otForms) {
        result[form.otFormId] = { decision: 0, rejectReason: "", excludedEmployeeIds: new Set() };
    }
    return result;
}

type OtFormBatchDetailProps = { token: string };

// A column whose value is the same on every form of the batch moves to the subtitle.
const isUniform = (values: unknown[]) => new Set(values).size <= 1;

// Public page behind the emailed token. Every form and employee defaults to approve; the approver
// rejects a form or unticks employees, then submits the whole batch once.
export default function OtFormBatchDetail({ token }: OtFormBatchDetailProps) {
    const t = useTranslations("Attendance.OtFormBatchDetail");
    const tDetail = useTranslations("Attendance.OtFormDetail");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();

    const [batch, setBatch] = useState<OtFormBatchDto | null>(null);
    const [decisions, setDecisions] = useState<Record<number, FormDecisionState>>({});
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [processedResult, setProcessedResult] = useState(false);
    // Each form card starts collapsed (header + summary only) to keep long batches readable.
    const [expandedFormIds, setExpandedFormIds] = useState<Set<number>>(() => new Set());

    const toggleExpanded = (otFormId: number) => {
        setExpandedFormIds((current) => {
            const next = new Set(current);
            if (next.has(otFormId)) next.delete(otFormId);
            else next.add(otFormId);
            return next;
        });
    };

    const { isLoading, error: loadError } = useFetchEffect(
        () => OtFormBatchApi.getByEmailToken(token),
        [token],
        (data) => {
            setBatch(data);
            setDecisions(buildInitialDecisions(data));
        },
        t("loadError")
    );

    const setDecision = (otFormId: number, decision: 0 | 1) => {
        setDecisions((current) => ({ ...current, [otFormId]: { ...current[otFormId], decision } }));
    };

    const setRejectReason = (otFormId: number, reason: string) => {
        setDecisions((current) => ({ ...current, [otFormId]: { ...current[otFormId], rejectReason: reason } }));
    };

    const toggleEmployee = (otFormId: number, employeeId: number) => {
        setDecisions((current) => {
            const state = current[otFormId];
            const nextSet = new Set(state.excludedEmployeeIds);
            if (nextSet.has(employeeId)) nextSet.delete(employeeId);
            else nextSet.add(employeeId);
            return { ...current, [otFormId]: { ...state, excludedEmployeeIds: nextSet } };
        });
    };

    const setAllIncluded = (otFormId: number, employeeIds: number[], include: boolean) => {
        setDecisions((current) => ({
            ...current,
            [otFormId]: { ...current[otFormId], excludedEmployeeIds: new Set(include ? [] : employeeIds) },
        }));
    };

    const openProcessModal = () => {
        if (!batch) return;
        // An approved form with every employee unticked must be rejected instead of approved with zero people.
        for (const form of batch.otForms) {
            const state = decisions[form.otFormId];
            if (state.decision === 0 && state.excludedEmployeeIds.size >= form.employees.length) {
                toast.error(t("allExcludedError", { id: form.otFormId }));
                return;
            }
            if (state.decision === 1 && !state.rejectReason.trim()) {
                toast.error(t("rejectReasonRequiredError", { id: form.otFormId }));
                return;
            }
        }
        setSecondaryPassword("");
        setActionError(null);
        setIsProcessModalOpen(true);
    };

    const closeProcessModal = () => {
        if (isSubmitting) return;
        setIsProcessModalOpen(false);
    };

    const handleProcess = async () => {
        if (!batch) return;
        if (!secondaryPassword) {
            setActionError(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmitting(true);
        setActionError(null);
        try {
            const forms: ProcessOtFormBatchFormDto[] = batch.otForms.map((form) => {
                const state = decisions[form.otFormId];
                return {
                    otFormId: form.otFormId,
                    decision: state.decision,
                    rejectReason: state.decision === 1 ? state.rejectReason.trim() : null,
                    excludedEmployeeIds:
                        state.decision === 0 && state.excludedEmployeeIds.size > 0 ? Array.from(state.excludedEmployeeIds) : null,
                };
            });
            await OtFormBatchApi.approveByEmailToken(token, { secondaryPassword, forms });
            setIsProcessModalOpen(false);
            setProcessedResult(true);
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, t("processError")));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 md:px-6">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-72 w-full rounded-xl" />
            </div>
        );
    }

    if (loadError || !batch) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>;
    }

    const isDone = processedResult || batch.status === 1;

    const approveCount = batch.otForms.filter((form) => decisions[form.otFormId]?.decision === 0).length;
    const rejectCount = batch.otForms.length - approveCount;
    const totalEmployees = batch.otForms.reduce((sum, form) => sum + form.employees.length, 0);
    const totalHours = batch.otForms.reduce((sum, form) => sum + form.employees.reduce((acc, e) => acc + e.actualHours, 0), 0);

    const dates = batch.otForms.map((form) => form.date);
    const groups = batch.otForms.map((form) => (form.groupNameVn ? bilingualText(form.groupNameVn, form.groupNameJp) : null));
    const creators = batch.otForms.map((form) => form.createdByFullName ?? form.createdByUserName);
    const showDateCol = !isUniform(dates);
    const showGroupCol = !isUniform(groups);
    const showCreatorCol = !isUniform(creators);
    const formColCount = 6 + Number(showGroupCol) + Number(showCreatorCol);
    const subtitleItemClass = "inline-flex items-center gap-1";

    return (
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 md:px-6">
            <div>
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("titleWithId", { id: batch.id })}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5e3f3a]">
                    <span>
                        {bilingualText(batch.scopeNameVn, batch.scopeNameJp)} — {t("batchDateLabel", { date: formatDate(batch.batchDate) })}
                    </span>
                    {!isDone && batch.otForms.length > 0 && (
                        <>
                            {!showDateCol && (
                                <span className={subtitleItemClass} title={tDetail("dateLabel")}>
                                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                                    {formatDate(dates[0])}
                                </span>
                            )}
                            {!showGroupCol && groups[0] && (
                                <span className={subtitleItemClass} title={t("colGroup")}>
                                    <Users className="h-3.5 w-3.5" aria-hidden />
                                    {groups[0]}
                                </span>
                            )}
                            {!showCreatorCol && (
                                <span className={subtitleItemClass} title={t("createdByLabel")}>
                                    <User className="h-3.5 w-3.5" aria-hidden />
                                    {creators[0]}
                                </span>
                            )}
                        </>
                    )}
                </p>
            </div>

            {isDone ? (
                <section className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    <EmptyState icon={CheckCircle2} title={t("statusProcessed")} />
                </section>
            ) : batch.otForms.length === 0 ? (
                <section className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm" title={t("noFormsLeftHint")}>
                    <EmptyState icon={Inbox} title={t("noFormsLeft")} />
                </section>
            ) : (
                <>
                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5 text-xs font-semibold text-[#5e3f3a]">
                            <span>{t("summaryForms", { count: batch.otForms.length })}</span>
                            <span className="text-[#8a8f94]">·</span>
                            <span>{t("summaryEmployees", { count: totalEmployees })}</span>
                            <span className="text-[#8a8f94]">·</span>
                            <span>{formatHours(totalHours)}</span>
                        </div>

                        <div className="relative overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                        <th className="w-8 px-2 py-2" />
                                        <th className="px-3 py-2">{t("colForm")}</th>
                                        {showGroupCol && <th className="px-3 py-2">{t("colGroup")}</th>}
                                        <th className="px-3 py-2">{t("colReason")}</th>
                                        <th className="px-3 py-2">{showDateCol ? t("colWhen") : tDetail("timeLabel")}</th>
                                        {showCreatorCol && <th className="px-3 py-2">{t("createdByLabel")}</th>}
                                        <th className="px-3 py-2 text-center">{t("colEmployees")}</th>
                                        <th className="px-3 py-2 text-center">{t("colHours")}</th>
                                        <th className="px-3 py-2 text-center">{t("colDecision")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batch.otForms.map((form, formIndex) => {
                                        const state = decisions[form.otFormId];
                                        if (!state) return null;
                                        const isExpanded = expandedFormIds.has(form.otFormId);
                                        const isReject = state.decision === 1;
                                        const included = form.employees.filter((e) => !state.excludedEmployeeIds.has(e.employeeId));
                                        const includedHours = included.reduce((sum, e) => sum + e.actualHours, 0);
                                        const mealCounts = mealCountsText(form.processPart, tDetail);
                                        const hasNotes = form.employees.some((e) => Boolean(e.noteVn || e.noteJp));
                                        const allIncluded = state.excludedEmployeeIds.size === 0;
                                        const noneIncluded = included.length === 0;
                                        return (
                                            <Fragment key={form.otFormId}>
                                                <tr
                                                    onClick={() => toggleExpanded(form.otFormId)}
                                                    className={`cursor-pointer border-b border-[#f1f5f9] transition ${
                                                        isReject ? "bg-[#fff4f2] hover:bg-[#ffe9e6]" : "bg-white hover:bg-[#f8fafc]"
                                                    }`}
                                                >
                                                    <td className="px-2 py-2.5 text-[#8a8f94]">
                                                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-[#191c1e]">
                                                        {t("formTitle", { id: form.otFormId })}
                                                    </td>
                                                    {showGroupCol && <td className="px-3 py-2.5 text-sm text-[#191c1e]">{groups[formIndex] ?? "—"}</td>}
                                                    <td className="px-3 py-2.5 text-sm text-[#191c1e]">
                                                        <span className="mr-1.5 inline-flex rounded-md border border-[#e0e3e5] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#5e3f3a]">
                                                            <OtCaseBadge code={form.otCaseCode} description={form.otCaseDescription} descriptionJp={form.otCaseDescriptionJp} />
                                                        </span>
                                                        {bilingualText(form.reasonNameVn, form.reasonNameJp)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-[#5e3f3a]">
                                                        {showDateCol && `${formatDate(form.date)} · `}
                                                        {formatTime(form.startTime)}–{formatTime(form.endTime)}
                                                    </td>
                                                    {showCreatorCol && <td className="px-3 py-2.5 text-sm text-[#5e3f3a]">{creators[formIndex]}</td>}
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-[#191c1e]">
                                                        {t("employeeSummary", { count: isReject ? form.employees.length : included.length, total: form.employees.length })}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm tabular-nums text-[#191c1e]">
                                                        {formatHours(isReject ? 0 : includedHours)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center" onClick={(event) => event.stopPropagation()}>
                                                        <div className="inline-flex overflow-hidden rounded-lg border border-[#e0e3e5]">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDecision(form.otFormId, 0)}
                                                                title={t("decisionApprove")}
                                                                aria-pressed={!isReject}
                                                                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap px-2.5 py-1 text-xs! font-semibold! transition ${
                                                                    !isReject ? "bg-emerald-50 text-emerald-700" : "bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                                }`}
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                                {t("decisionApproveShort")}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setDecision(form.otFormId, 1);
                                                                    setExpandedFormIds((current) => new Set(current).add(form.otFormId));
                                                                }}
                                                                title={t("decisionReject")}
                                                                aria-pressed={isReject}
                                                                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap border-l border-[#e0e3e5] px-2.5 py-1 text-xs! font-semibold! transition ${
                                                                    isReject ? "bg-[#fff4f2] text-[#930006]" : "bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                                }`}
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                                {t("decisionRejectShort")}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {(isExpanded || isReject) && (
                                                    <tr className="border-b border-[#e0e3e5] bg-[#f8fafc]">
                                                        <td colSpan={formColCount} className="p-0">
                                                            <div className="space-y-3 px-4 py-3">
                                                                {form.subReason && (
                                                                    <div className="text-xs text-[#5e3f3a]">
                                                                        <span className="font-semibold text-[#191c1e]">{tDetail("subReasonLabel")}:</span> {form.subReason}
                                                                    </div>
                                                                )}

                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    <ProcessPartTile
                                                                        icon={<Car size={12} />}
                                                                        label={tDetail("transportationFieldLabel")}
                                                                        active={Boolean(form.processPart?.isTransportation)}
                                                                        activeLabel={tDetail("yes")}
                                                                        inactiveLabel={tDetail("no")}
                                                                    />
                                                                    <ProcessPartTile
                                                                        icon={<Printer size={12} />}
                                                                        label={tDetail("copyRoomFieldLabel")}
                                                                        active={Boolean(form.processPart?.isUseCopyRoom)}
                                                                        activeLabel={tDetail("yes")}
                                                                        inactiveLabel={tDetail("no")}
                                                                    />
                                                                    {mealCounts && <span className="text-xs font-semibold text-[#191c1e]">{mealCounts}</span>}
                                                                </div>

                                                                {form.processPart?.anotherSuggestionVn && (
                                                                    <div className="flex items-start gap-2 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-xs text-[#5e3f3a]">
                                                                        <span
                                                                            role="img"
                                                                            title={tDetail("anotherSuggestionFieldLabel")}
                                                                            aria-label={tDetail("anotherSuggestionFieldLabel")}
                                                                            className="mt-0.5 shrink-0"
                                                                        >
                                                                            <MessageCircle size={14} aria-hidden />
                                                                        </span>
                                                                        <span>{bilingualText(form.processPart.anotherSuggestionVn, form.processPart.anotherSuggestionJp)}</span>
                                                                    </div>
                                                                )}

                                                                {isReject && (
                                                                    <label className="block">
                                                                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                                                            {t("rejectReasonLabel")} <span className="text-[#930006]">*</span>
                                                                        </span>
                                                                        <textarea
                                                                            value={state.rejectReason}
                                                                            onChange={(event) => setRejectReason(form.otFormId, event.target.value)}
                                                                            rows={2}
                                                                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>

                                                            {!isReject && (
                                                                <div className="relative overflow-x-auto">
                                                                    <table className="min-w-full border-collapse text-left">
                                                                        <thead>
                                                                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                                                                <th rowSpan={2} className="h-px p-0 align-bottom">
                                                                                    <label className="flex h-full cursor-pointer items-end px-3 py-1.5">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            aria-label={t("colInclude")}
                                                                                            checked={allIncluded}
                                                                                            ref={(el) => {
                                                                                                if (el) el.indeterminate = !allIncluded && !noneIncluded;
                                                                                            }}
                                                                                            onChange={() =>
                                                                                                setAllIncluded(form.otFormId, form.employees.map((e) => e.employeeId), !allIncluded)
                                                                                            }
                                                                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                                        />
                                                                                    </label>
                                                                                </th>
                                                                                <th rowSpan={2} className="px-3 py-1.5 align-bottom">{tDetail("colEmployee")}</th>
                                                                                <th rowSpan={2} className="px-3 py-1.5 align-bottom">{t("colTime")}</th>
                                                                                <th rowSpan={2} className="px-3 py-1.5 text-center align-bottom">{t("colHours")}</th>
                                                                                <th colSpan={2} className="border-b border-[#e0e3e5] px-3 py-1.5 text-center">{tDetail("colAccumulation")}</th>
                                                                                <th rowSpan={2} className="px-3 py-1.5 text-center align-bottom">{tDetail("colMeal")}</th>
                                                                                {hasNotes && <th rowSpan={2} className="px-3 py-1.5 align-bottom">{tDetail("colNote")}</th>}
                                                                            </tr>
                                                                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                                                                <th className="px-3 py-1.5 text-center">{tDetail("colMonth")}</th>
                                                                                <th className="px-3 py-1.5 text-center">{tDetail("colYear")}</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {form.employees.map((employee) => {
                                                                                const isExcluded = state.excludedEmployeeIds.has(employee.employeeId);
                                                                                const over = exceededLimits(employee, setting);
                                                                                return (
                                                                                    <tr
                                                                                        key={employee.employeeId}
                                                                                        onClick={(event) => {
                                                                                            if ((event.target as HTMLElement).closest("input, button, select, textarea, a, label")) return;
                                                                                            toggleEmployee(form.otFormId, employee.employeeId);
                                                                                        }}
                                                                                        className={`cursor-pointer border-b border-[#f1f5f9] bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1] ${isExcluded ? "opacity-50" : ""}`}
                                                                                    >
                                                                                        <td className="h-px p-0">
                                                                                            <label className="flex h-full cursor-pointer items-center px-3 py-1.5">
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    aria-label={`${t("colInclude")} ${employee.fullName}`}
                                                                                                    checked={!isExcluded}
                                                                                                    onChange={() => toggleEmployee(form.otFormId, employee.employeeId)}
                                                                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                                                />
                                                                                            </label>
                                                                                        </td>
                                                                                        <td className="whitespace-nowrap px-3 py-1.5 text-sm">
                                                                                            <span className="mr-2 tabular-nums text-[#5e3f3a]">{employee.employeeCode}</span>
                                                                                            <span className="font-medium text-[#191c1e]">{employee.fullName}</span>
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-sm text-[#5e3f3a]">
                                                                                            <TimeRange start={formatTime(employee.startTime)} end={formatTime(employee.endTime)} />
                                                                                        </td>
                                                                                        <td className="px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-[#191c1e]">
                                                                                            {formatHours(employee.actualHours)}
                                                                                        </td>
                                                                                        <td className="whitespace-nowrap px-3 py-1.5 text-center text-sm">
                                                                                            <AccumulationHours
                                                                                                hours={employee.monthToDate}
                                                                                                overTitle={over.month !== null ? tDetail("overMonthlyHint", { limit: over.month }) : undefined}
                                                                                            />
                                                                                        </td>
                                                                                        <td className="whitespace-nowrap px-3 py-1.5 text-center text-sm">
                                                                                            <AccumulationHours
                                                                                                hours={employee.yearToDate}
                                                                                                overTitle={over.year !== null ? tDetail("overYearlyHint", { limit: over.year }) : undefined}
                                                                                            />
                                                                                        </td>
                                                                                        <td className="whitespace-nowrap px-3 py-1.5 text-center text-sm">
                                                                                            <span className="inline-flex items-center justify-center gap-1.5">
                                                                                                <MealTicketTypeBadge type={employee.mealTicketType} t={tDetail} />
                                                                                                {!form.isProductionForm && !employee.didEat && (
                                                                                                    <IconFlag icon={Clock} tone="warning" label={tDetail("didEatNoHint")} />
                                                                                                )}
                                                                                            </span>
                                                                                        </td>
                                                                                        {hasNotes && (
                                                                                            <td className="px-3 py-1.5 text-sm text-[#5e3f3a]">{bilingualText(employee.noteVn, employee.noteJp)}</td>
                                                                                        )}
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e3e5] bg-white px-4 py-3 shadow-md">
                        <div className="flex items-center gap-4 text-sm font-semibold tabular-nums">
                            <span title={t("decisionApprove")} className="inline-flex items-center gap-1 text-emerald-700">
                                <Check className="h-4 w-4" aria-hidden />
                                {approveCount}
                            </span>
                            <span title={t("decisionReject")} className="inline-flex items-center gap-1 text-[#930006]">
                                <X className="h-4 w-4" aria-hidden />
                                {rejectCount}
                            </span>
                        </div>
                        <button
                            onClick={openProcessModal}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-5 py-2 text-sm! font-semibold! text-white transition hover:bg-[#b40009]"
                        >
                            <Send className="h-4 w-4" />
                            {t("processButton")}
                        </button>
                    </div>
                </>
            )}

            <FormDialog
                isOpen={isProcessModalOpen}
                title={t("modalTitle")}
                onClose={closeProcessModal}
                onSubmit={handleProcess}
                loading={isSubmitting}
                submitLabel={isSubmitting ? tCommon("processing") : t("confirmProcess")}
                cancelLabel={tCommon("cancel")}
                maxWidthClassName="max-w-lg"
            >
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                    </span>
                    <input
                        type="password"
                        value={secondaryPassword}
                        onChange={(event) => setSecondaryPassword(event.target.value)}
                        disabled={isSubmitting}
                        autoComplete="off"
                        className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                    />
                </label>

                {actionError && <p className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{actionError}</p>}
            </FormDialog>
        </div>
    );
}
