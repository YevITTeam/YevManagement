"use client";

import { Fragment, useState } from "react";
import { TimeRange } from "@/modules/attendance/components/ot-form/TimeRange";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Car, Check, ChevronDown, MessageCircle, Printer, Utensils, X } from "lucide-react";

import { OtFormBatchApi } from "@/modules/attendance/api/ot-form-batch.api";
import type { OtFormBatchDto, ProcessOtFormBatchFormDto } from "@/modules/attendance/types/ot-form-batch.dto";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { formatHours } from "@/modules/attendance/lib/time";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { useRouter } from "@/navigation";
import { MEAL_TICKET_MAIN, MEAL_TICKET_SECONDARY } from "@/modules/attendance/lib/mealTicket";
import OtCaseBadge from "@/modules/attendance/components/OtCaseBadge";
import { MealTicketTypeBadge } from "@/modules/attendance/components/ot-form/MealTicketTypeBadge";

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

type OtFormBatchDetailProps = { variant: "app"; id: number } | { variant: "email"; token: string };

// Compact on/off pill for one "other support" item inside an expanded form row.
function ProcessChip({ icon, label, active, activeLabel, inactiveLabel }: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#e0e3e5] bg-white text-[#8a8f94]"
            }`}
        >
            {icon}
            {label}: {active ? activeLabel : inactiveLabel}
        </span>
    );
}

// Shared by both channels (app via JWT, public via email link). Every form and employee defaults to
// approve; the approver rejects a form or unticks employees, then submits the whole batch once.
export default function OtFormBatchDetail(props: OtFormBatchDetailProps) {
    const t = useTranslations("Attendance.OtFormBatchDetail");
    const tDetail = useTranslations("Attendance.OtFormDetail");
    const tCommon = useTranslations("Common");
    const router = useRouter();
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

    const fetchKey = props.variant === "app" ? props.id : props.token;

    const { isLoading, error: loadError } = useFetchEffect(
        () => (props.variant === "app" ? OtFormBatchApi.getById(props.id) : OtFormBatchApi.getByEmailToken(props.token)),
        [props.variant, fetchKey],
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

    const openProcessModal = () => {
        if (!batch) return;
        // Validate ở FE trước khi mở modal mật khẩu — đơn Duyệt mà bỏ chọn hết nhân viên phải chuyển
        // sang Từ chối cả đơn thay vì cố duyệt 1 đơn 0 người (docs §Đơn tổng).
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
            if (props.variant === "app") {
                await OtFormBatchApi.approve(props.id, { secondaryPassword, forms });
                toast.success(t("processSuccess"));
            } else {
                await OtFormBatchApi.approveByEmailToken(props.token, { secondaryPassword, forms });
            }
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
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (loadError || !batch) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>;
    }

    const isDone = processedResult || batch.status === 1;

    const approveCount = batch.otForms.filter((form) => decisions[form.otFormId]?.decision === 0).length;
    const rejectCount = batch.otForms.length - approveCount;
    const totalEmployees = batch.otForms.reduce((sum, form) => sum + form.employees.length, 0);
    const totalHours = batch.otForms.reduce((sum, form) => sum + form.employees.reduce((acc, e) => acc + e.actualHours, 0), 0);

    return (
        <div className={`space-y-4 ${props.variant === "email" ? "mx-auto max-w-[1400px] px-4 py-5 md:px-6" : ""}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-[#191c1e]">{t("titleWithId", { id: batch.id })}</h1>
                    <p className="mt-1 text-sm text-[#5e3f3a]">
                        {bilingualText(batch.scopeNameVn, batch.scopeNameJp)} — {t("batchDateLabel", { date: formatDate(batch.batchDate) })}
                    </p>
                </div>
                {isDone && (
                    <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        {t("statusProcessed")}
                    </span>
                )}
            </div>

            {isDone ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {t("processedResultMessage")}
                </div>
            ) : batch.otForms.length === 0 ? (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">{t("noFormsLeft")}</div>
            ) : (
                <>
                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5 text-xs font-semibold text-[#5e3f3a]">
                            <span>{t("summaryForms", { count: batch.otForms.length })}</span>
                            <span className="text-[#c7ccd1]">·</span>
                            <span>{t("summaryEmployees", { count: totalEmployees })}</span>
                            <span className="text-[#c7ccd1]">·</span>
                            <span>{formatHours(totalHours)}</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                        <th className="w-8 px-2 py-2" />
                                        <th className="px-3 py-2">{t("colForm")}</th>
                                        <th className="px-3 py-2">{t("colGroup")}</th>
                                        <th className="px-3 py-2">{t("colReason")}</th>
                                        <th className="px-3 py-2">{t("colWhen")}</th>
                                        <th className="px-3 py-2">{t("createdByLabel")}</th>
                                        <th className="px-3 py-2 text-center">{t("colEmployees")}</th>
                                        <th className="px-3 py-2 text-center">{t("colHours")}</th>
                                        <th className="px-3 py-2 text-center">{t("colDecision")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batch.otForms.map((form) => {
                                        const state = decisions[form.otFormId];
                                        if (!state) return null;
                                        const isExpanded = expandedFormIds.has(form.otFormId);
                                        const isReject = state.decision === 1;
                                        const included = form.employees.filter((e) => !state.excludedEmployeeIds.has(e.employeeId));
                                        const includedHours = included.reduce((sum, e) => sum + e.actualHours, 0);
                                        return (
                                            <Fragment key={form.otFormId}>
                                                <tr
                                                    onClick={() => toggleExpanded(form.otFormId)}
                                                    className={`cursor-pointer border-b border-[#f1f5f9] transition ${
                                                        isReject ? "bg-[#fff8f7] hover:bg-[#fff4f2]" : "bg-white hover:bg-[#f8fafc]"
                                                    }`}
                                                >
                                                    <td className="px-2 py-2.5 text-[#8a8f94]">
                                                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-[#191c1e]">
                                                        {t("formTitle", { id: form.otFormId })}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-sm text-[#191c1e]">{bilingualText(form.groupNameVn, form.groupNameJp)}</td>
                                                    <td className="px-3 py-2.5 text-sm text-[#191c1e]">
                                                        <span className="mr-1.5 inline-flex rounded-md border border-[#d5dade] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#5e3f3a]">
                                                            <OtCaseBadge code={form.otCaseCode} description={form.otCaseDescription} descriptionJp={form.otCaseDescriptionJp} />
                                                        </span>
                                                        {bilingualText(form.reasonNameVn, form.reasonNameJp)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#5e3f3a]">
                                                        {formatDate(form.date)} · {formatTime(form.startTime)}–{formatTime(form.endTime)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-sm text-[#5e3f3a]">{form.createdByFullName ?? form.createdByUserName}</td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-[#191c1e]">
                                                        {t("employeeSummary", { count: isReject ? form.employees.length : included.length, total: form.employees.length })}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-[#191c1e]">
                                                        {formatHours(isReject ? 0 : includedHours)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center" onClick={(event) => event.stopPropagation()}>
                                                        <div className="inline-flex overflow-hidden rounded-lg border border-[#e0e3e5]">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDecision(form.otFormId, 0)}
                                                                title={t("decisionApprove")}
                                                                aria-pressed={!isReject}
                                                                className={`inline-flex cursor-pointer items-center gap-1 px-2.5 py-1 text-xs! font-semibold! transition ${
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
                                                                className={`inline-flex cursor-pointer items-center gap-1 border-l border-[#e0e3e5] px-2.5 py-1 text-xs! font-semibold! transition ${
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
                                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd]">
                                                        <td colSpan={9} className="p-0">
                                                            <div className="space-y-3 px-4 py-3">
                                                                {form.subReason && (
                                                                    <div className="text-xs text-[#5e3f3a]">
                                                                        <span className="font-semibold text-[#191c1e]">{tDetail("subReasonLabel")}:</span> {form.subReason}
                                                                    </div>
                                                                )}

                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <ProcessChip
                                                                        icon={<Utensils size={12} />}
                                                                        label={tDetail("eatFieldLabel")}
                                                                        active={Boolean(form.processPart?.isEat)}
                                                                        activeLabel={tDetail("yes")}
                                                                        inactiveLabel={tDetail("no")}
                                                                    />
                                                                    <ProcessChip
                                                                        icon={<Car size={12} />}
                                                                        label={tDetail("transportationFieldLabel")}
                                                                        active={Boolean(form.processPart?.isTransportation)}
                                                                        activeLabel={tDetail("yes")}
                                                                        inactiveLabel={tDetail("no")}
                                                                    />
                                                                    <ProcessChip
                                                                        icon={<Printer size={12} />}
                                                                        label={tDetail("copyRoomFieldLabel")}
                                                                        active={Boolean(form.processPart?.isUseCopyRoom)}
                                                                        activeLabel={tDetail("yes")}
                                                                        inactiveLabel={tDetail("no")}
                                                                    />
                                                                    {form.processPart?.isEat && (
                                                                        <>
                                                                            <span className="rounded-full border border-[#e0e3e5] bg-white px-2.5 py-1 text-xs font-medium text-[#5e3f3a]">
                                                                                {tDetail("mainTicketLabel", { count: form.processPart.mainTicketCount })}
                                                                            </span>
                                                                            <span className="rounded-full border border-[#e0e3e5] bg-white px-2.5 py-1 text-xs font-medium text-[#5e3f3a]">
                                                                                {tDetail("secondaryTicketLabel", { count: form.processPart.secondaryTicketCount })}
                                                                            </span>
                                                                            <span className="rounded-full border border-[#e0e3e5] bg-white px-2.5 py-1 text-xs font-medium text-[#5e3f3a]">
                                                                                {tDetail("milkLabel", { count: form.processPart.milkCount })}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {form.processPart?.anotherSuggestionVn && (
                                                                    <div className="flex items-start gap-2 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-xs text-[#5e3f3a]">
                                                                        <MessageCircle size={14} className="mt-0.5 shrink-0" />
                                                                        <span>
                                                                            <span className="font-semibold text-[#191c1e]">{tDetail("anotherSuggestionFieldLabel")}: </span>
                                                                            {bilingualText(form.processPart.anotherSuggestionVn, form.processPart.anotherSuggestionJp)}
                                                                        </span>
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
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full border-collapse text-left">
                                                <thead>
                                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                                        <th rowSpan={2} className="px-3 py-1.5 align-bottom">{t("colInclude")}</th>
                                                        <th rowSpan={2} className="px-3 py-1.5 align-bottom">{t("colEmployeeCode")}</th>
                                                        <th rowSpan={2} className="px-3 py-1.5 align-bottom">{t("colFullName")}</th>
                                                        <th rowSpan={2} className="px-3 py-1.5 align-bottom">{t("colTime")}</th>
                                                        <th rowSpan={2} className="px-3 py-1.5 text-center align-bottom">{t("colHours")}</th>
                                                        <th colSpan={2} className="border-b border-[#e0e3e5] px-3 py-1.5 text-center">{tDetail("colAccumulation")}</th>
                                                        <th rowSpan={2} className="px-3 py-1.5 text-center align-bottom">{tDetail("colMeal")}</th>
                                                        <th rowSpan={2} className="px-3 py-1.5 align-bottom">{tDetail("colNote")}</th>
                                                    </tr>
                                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                                        <th className="px-3 py-1.5 text-center">{tDetail("colMonth")}</th>
                                                        <th className="px-3 py-1.5 text-center">{tDetail("colYear")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.employees.map((employee) => {
                                                        const isExcluded = state.excludedEmployeeIds.has(employee.employeeId);
                                                        const hours = employee.actualHours;
                                                        const isMonthOverLimit = employee.monthToDate > setting.monthlyOtHourLimit;
                                                        const isYearOverLimit = employee.yearToDate > setting.yearlyOtHourLimit;
                                                        return (
                                                            <tr key={employee.employeeId} className={`border-b border-[#f1f5f9] bg-white even:bg-[#f2f4f7] ${isExcluded ? "opacity-50" : ""}`}>
                                                                <td className="px-3 py-1.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!isExcluded}
                                                                        onChange={() => toggleEmployee(form.otFormId, employee.employeeId)}
                                                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-1.5 text-sm">
                                                                    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-[#d5dade] bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#191c1e]">
                                                                        {employee.employeeCode}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-[#191c1e]">{employee.fullName}</td>
                                                                <td className="px-3 py-1.5 text-sm text-[#5e3f3a]">
                                                                    <TimeRange start={formatTime(employee.startTime)} end={formatTime(employee.endTime)} />
                                                                </td>
                                                                <td className="px-3 py-1.5 text-center text-sm text-[#191c1e]">{formatHours(hours)}</td>
                                                                <td className={`px-3 py-1.5 text-center text-sm ${isMonthOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                                                    {employee.monthToDate}h
                                                                </td>
                                                                <td className={`px-3 py-1.5 text-center text-sm ${isYearOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                                                    {employee.yearToDate}h
                                                                </td>
                                                                <td className="px-3 py-1.5 text-center text-sm">
                                                                    {employee.mealTicketType === MEAL_TICKET_MAIN || employee.mealTicketType === MEAL_TICKET_SECONDARY ? (
                                                                        <MealTicketTypeBadge type={employee.mealTicketType} t={tDetail} />
                                                                    ) : (
                                                                        <span className="text-[#c7ccd1]">–</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-sm text-[#5e3f3a]">{bilingualText(employee.noteVn, employee.noteJp)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>                                                            )}
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
                        <div className="text-sm text-[#5e3f3a]">{t("footerSummary", { approve: approveCount, reject: rejectCount })}</div>
                        <button
                            onClick={openProcessModal}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-5 py-2 text-sm! font-semibold! text-white transition hover:bg-[#b40009]"
                        >
                            {t("processButton")}
                        </button>
                    </div>
                </>
            )}

            {props.variant === "app" && isDone && (
                <div>
                    <button
                        onClick={() => router.push({ pathname: "/ot/batches" })}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        {t("backToListButton")}
                    </button>
                </div>
            )}

            {isProcessModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeProcessModal} />
                    <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("modalTitle")}</h3>
                            <button onClick={closeProcessModal} className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]" aria-label={tCommon("close")}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
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

                            {actionError && (
                                <p className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{actionError}</p>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeProcessModal}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleProcess}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting ? tCommon("processing") : t("confirmProcess")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
