"use client";

import { useState } from "react";
import { TimeRange } from "@/modules/attendance/components/ot-form/TimeRange";
import { useSearchParams } from "next/navigation";
import { Car, Check, Clock, MessageCircle, Printer, UserX, X } from "lucide-react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalStepDto, OtFormDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";
import { otFormStatusClasses } from "@/modules/attendance/types/enums";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import {
    bilingualText,
    bilingualYesNo,
    createBilingualTranslator,
    otFormStatusLabelsBilingual,
    processPartFieldLabelsBilingual,
    removedByLabelBilingual,
    removedReasonLabelBilingual,
} from "@/modules/attendance/lib/bilingual";
import { formatHours } from "@/modules/attendance/lib/time";
import OtCaseBadge from "@/modules/attendance/components/OtCaseBadge";
import {
    AccumulationHours,
    exceededLimits,
    mealCountsText,
    MealTicketTypeBadge,
    ProcessPartTile,
} from "@/modules/attendance/components/ot-form/MealTicketTypeBadge";
import { IconFlag } from "@/components/ui/ListToolbar";

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

// "27/11 14:05" for tight cells; the full timestamp goes to the tooltip.
function formatShortDateTime(value: string) {
    if (!value) return "-";
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

type ApprovalStepState = "done" | "current" | "rejected" | "skipped" | "upcoming";

interface ApprovalStepView {
    step: OtFormApprovalStepDto;
    state: ApprovalStepState;
    history: OtFormDto["approvalHistories"][number] | null;
}

// Chain comes from the form.approvalSteps snapshot, same as OtFormDetail.tsx.
function buildApprovalSteps(form: OtFormDto): ApprovalStepView[] {
    const firstPendingOrder = form.approvalSteps.find((s) => s.status === 0)?.stepOrder;
    return form.approvalSteps.map((step): ApprovalStepView => {
        const history = form.approvalHistories.find((item) => item.stepOrder === step.stepOrder) ?? null;
        if (step.status === 2) return { step, history, state: "rejected" };
        if (step.status === 3) return { step, history, state: "skipped" };
        if (step.status === 1) return { step, history, state: "done" };
        return { step, history: null, state: step.stepOrder === firstPendingOrder ? "current" : "upcoming" };
    });
}

// removedAtLevel holds a StepOrder (see OtFormDetail.tsx).
function stepNameByOrder(form: OtFormDto, stepOrder: number | null): string {
    if (stepOrder === null) return "";
    return form.approvalSteps.find((s) => s.stepOrder === stepOrder)?.jobTitleNameSnapshot ?? `#${stepOrder}`;
}

// Public route secured by the URL token; opened from the approve/reject email sent to managers.
export default function OtFormEmailConfirmPage() {
    // Bilingual (VN / JP) regardless of the /vi or /ja segment the link was opened in.
    const t = createBilingualTranslator("Attendance.OtFormDetail");
    const tConfirm = createBilingualTranslator("Attendance.OtFormEmailConfirm");
    const tCommon = createBilingualTranslator("Common");
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [form, setForm] = useState<OtFormDto | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionResult, setActionResult] = useState<"approved" | "rejected" | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [comment, setComment] = useState("");
    const [secondaryPassword, setSecondaryPassword] = useState("");

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectComment, setRejectComment] = useState("");
    // No JWT here, so "is it set up" can't be pre-checked; not-set/wrong-password errors come back via actionError.
    const [rejectSecondaryPassword, setRejectSecondaryPassword] = useState("");

    // Removing an employee here asks for the secondary password like Approve/Reject: the link is the only other credential.
    const [removeTarget, setRemoveTarget] = useState<OtFormEmployeeDto | null>(null);
    const [removeReason, setRemoveReason] = useState("");
    const [removeSecondaryPassword, setRemoveSecondaryPassword] = useState("");
    const [isRemovingEmployee, setIsRemovingEmployee] = useState(false);

    // Throw a JSON {message} so getApiErrorMessage surfaces this specific text instead of the generic fallback.
    const { isLoading, error: loadError } = useFetchEffect(
        async () => {
            if (!token) {
                throw new Error(JSON.stringify({ message: tConfirm("missingTokenError") }));
            }
            return OtFormApi.getOtFormByEmailToken(token);
        },
        [token],
        (data) => setForm(data),
        tConfirm("loadError")
    );

    const openApproveModal = () => {
        setComment("");
        setSecondaryPassword("");
        setActionError(null);
        setIsApproveModalOpen(true);
    };

    const closeApproveModal = () => {
        if (isSubmitting) return;
        setIsApproveModalOpen(false);
    };

    const handleApprove = async () => {
        if (!secondaryPassword) {
            setActionError(tConfirm("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmitting(true);
        setActionError(null);
        try {
            await OtFormApi.approveOtFormByEmailToken(token, { comment: comment.trim() || null, secondaryPassword });
            setIsApproveModalOpen(false);
            setActionResult("approved");
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, tConfirm("approveError")));
        } finally {
            setIsSubmitting(false);
        }
    };

    const openRejectModal = () => {
        setRejectComment("");
        setRejectSecondaryPassword("");
        setActionError(null);
        setIsRejectModalOpen(true);
    };

    const closeRejectModal = () => {
        if (isSubmitting) return;
        setIsRejectModalOpen(false);
    };

    const handleReject = async () => {
        if (!rejectComment.trim()) {
            setActionError(tConfirm("rejectCommentRequiredError"));
            return;
        }
        if (!rejectSecondaryPassword) {
            setActionError(tConfirm("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmitting(true);
        setActionError(null);
        try {
            await OtFormApi.rejectOtFormByEmailToken(token, {
                comment: rejectComment.trim(),
                secondaryPassword: rejectSecondaryPassword,
            });
            setIsRejectModalOpen(false);
            setActionResult("rejected");
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, tConfirm("rejectError")));
        } finally {
            setIsSubmitting(false);
        }
    };

    const openRemove = (employee: OtFormEmployeeDto) => {
        setRemoveReason("");
        setRemoveSecondaryPassword("");
        setActionError(null);
        setRemoveTarget(employee);
    };

    const closeRemove = () => {
        if (isRemovingEmployee) return;
        setRemoveTarget(null);
    };

    const handleRemoveEmployee = async () => {
        if (!removeTarget) return;
        if (!removeReason.trim()) {
            setActionError(tConfirm("removeReasonRequiredError"));
            return;
        }
        if (!removeSecondaryPassword) {
            setActionError(tConfirm("secondaryPasswordRequiredError"));
            return;
        }
        setIsRemovingEmployee(true);
        setActionError(null);
        try {
            const updated = await OtFormApi.removeOtFormEmployeeByEmailToken(token, {
                employeeId: removeTarget.employeeId,
                reason: removeReason.trim(),
                secondaryPassword: removeSecondaryPassword,
            });
            setForm(updated);
            setRemoveTarget(null);
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, tConfirm("removeError")));
        } finally {
            setIsRemovingEmployee(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (loadError || !form) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-12">
                <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>
            </div>
        );
    }

    const approvalStepViews = buildApprovalSteps(form);
    // Removed employees (via the app) are excluded from the displayed total hours.
    const activeEmployees = form.employees.filter((employee) => !employee.isRemoved);
    const totalWorkedHours = activeEmployees.reduce((sum, employee) => sum + employee.actualHours, 0);
    const hasNotes = activeEmployees.some((employee) => Boolean(employee.noteVn || employee.noteJp));
    // Columns after the employee cell (the "removed" row spans the rest).
    const removedColSpan = 5 + Number(!form.isProductionForm) + Number(hasNotes) + Number(!actionResult);
    const mealCounts = mealCountsText(form.processPart, t);

    return (
        // Public route outside the app layout, so it can exceed 1280px; the 9-column employee table wraps names at 1280px.
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("titleWithId", { id: form.id })}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {bilingualText(form.departmentNameVn, form.departmentNameJp)} — {bilingualText(form.groupNameVn, form.groupNameJp)}
                    </p>
                </div>
                <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                >
                    {otFormStatusLabelsBilingual[form.status] ?? t("unknownStatus")}
                </span>
            </div>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                {form.approvalChainWarning && (
                    <div className="mb-4 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-xs text-[#9a5b00]">
                        {form.approvalChainWarning}
                    </div>
                )}
                <div className="flex overflow-x-auto pb-1">
                    {/* Steps at or below the creator's rank are dropped from the chain, so the creator heads the progress. */}
                    <div className="relative flex min-w-[6.5rem] flex-1 flex-col items-center">
                        {approvalStepViews.length > 0 && <div className="absolute right-0 top-4 h-0.5 w-1/2 -translate-y-1/2 bg-emerald-500" />}
                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
                            <Check size={16} />
                        </div>
                        <div className="mt-2 text-center text-xs font-semibold text-[#191c1e]">{t("createdByLabel")}</div>
                        <div className="mt-0.5 text-center text-[11px] leading-tight text-[#5e3f3a]">
                            {form.createdByFullName ?? form.createdByUserName}
                            <br />
                            <span title={formatDateTime(form.createdAt)}>{formatShortDateTime(form.createdAt)}</span>
                        </div>
                        {form.creatorSignatureImage && (
                            // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image can't optimize it
                            <img
                                src={`data:image/png;base64,${form.creatorSignatureImage}`}
                                alt={t("signatureAlt", { name: form.createdByFullName ?? form.createdByUserName })}
                                className="mt-1 h-10 w-24 rounded border border-[#e0e3e5] bg-white object-contain"
                            />
                        )}
                    </div>
                    {approvalStepViews.map((view, index) => (
                        <div key={view.step.id} className="relative flex min-w-[6.5rem] flex-1 flex-col items-center">
                            <div
                                className={`absolute left-0 top-4 h-0.5 w-1/2 -translate-y-1/2 ${
                                    index === 0 || approvalStepViews[index - 1].state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                }`}
                            />
                            {index < approvalStepViews.length - 1 && (
                                <div
                                    className={`absolute right-0 top-4 h-0.5 w-1/2 -translate-y-1/2 ${
                                        view.state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                    }`}
                                />
                            )}
                            <div
                                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                    view.state === "done"
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : view.state === "rejected"
                                        ? "border-[#930006] bg-[#930006] text-white"
                                        : view.state === "current"
                                        ? "border-[#9a5b00] bg-[#fff4e5] text-[#9a5b00]"
                                        : "border-[#e0e3e5] bg-white text-[#8a8f94]"
                                }`}
                            >
                                {view.state === "done" && <Check size={16} />}
                                {view.state === "rejected" && <X size={16} />}
                                {view.state === "current" && <Clock size={16} />}
                                {(view.state === "upcoming" || view.state === "skipped") && index + 1}
                            </div>
                            <div
                                className={`mt-2 text-center text-xs font-semibold ${
                                    view.state === "upcoming" || view.state === "skipped" ? "text-[#8a8f94]" : "text-[#191c1e]"
                                }`}
                            >
                                {view.step.jobTitleNameSnapshot}
                            </div>
                            {view.history ? (
                                <>
                                    <div className="mt-0.5 text-center text-[11px] leading-tight text-[#5e3f3a]">
                                        {view.history.approverFullName ?? view.history.approverUserName}
                                        <br />
                                        <span title={formatDateTime(view.history.actionAt)}>{formatShortDateTime(view.history.actionAt)}</span>
                                    </div>
                                    {view.history.comment && (
                                        <div title={view.history.comment} className="mt-1 line-clamp-3 max-w-[10rem] text-center text-[11px] italic text-[#191c1e]">
                                            &quot;{view.history.comment}&quot;
                                        </div>
                                    )}
                                    {view.history.hasSignature && view.history.signatureImage && (
                                        // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image can't optimize it
                                        <img
                                            src={`data:image/png;base64,${view.history.signatureImage}`}
                                            alt={t("signatureAlt", { name: view.history.approverFullName ?? view.history.approverUserName })}
                                            className="mt-1 h-10 w-24 rounded border border-[#e0e3e5] bg-white object-contain"
                                        />
                                    )}
                                </>
                            ) : view.state === "current" ? (
                                <div
                                    className="mt-0.5 text-center text-[11px] text-[#9a5b00]"
                                    title={
                                        view.step.candidates.length > 1
                                            ? t("waitingCandidatesTooltip", {
                                                  names: view.step.candidates.map((c) => c.fullName).join(", "),
                                              })
                                            : undefined
                                    }
                                >
                                    {t("waitingShort")}
                                </div>
                            ) : view.state === "skipped" ? (
                                <div className="mt-0.5 text-center text-[11px] text-[#8a8f94]">{t("skippedShort")}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-2 rounded-xl border border-[#e0e3e5] bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#191c1e]">
                    <span className="inline-flex flex-wrap items-center gap-x-1.5" title={t("timeLabel")}>
                        {formatDate(form.date)}
                        <span className="text-[#8a8f94]">·</span>
                        <TimeRange start={formatTime(form.startTime)} end={formatTime(form.endTime)} hours={form.totalHour} />
                    </span>
                    <OtCaseBadge code={form.otCaseCode} description={form.otCaseDescription} descriptionJp={form.otCaseDescriptionJp} showAll={false} />
                    <span title={t("reasonLabel")}>{bilingualText(form.reasonNameVn, form.reasonNameJp)}</span>
                    {form.subReason && (
                        <span className="text-[#5e3f3a]" title={t("subReasonLabel")}>
                            {form.subReason}
                        </span>
                    )}
                </div>
                {/* Off items stay visible struck through; meal is on for every form, so only its non-zero counts show. */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <ProcessPartTile
                        icon={<Car size={12} />}
                        label={processPartFieldLabelsBilingual.transportation}
                        active={Boolean(form.processPart?.isTransportation)}
                        activeLabel={bilingualYesNo(true)}
                        inactiveLabel={bilingualYesNo(false)}
                    />
                    <ProcessPartTile
                        icon={<Printer size={12} />}
                        label={processPartFieldLabelsBilingual.copyRoom}
                        active={Boolean(form.processPart?.isUseCopyRoom)}
                        activeLabel={bilingualYesNo(true)}
                        inactiveLabel={bilingualYesNo(false)}
                    />
                    {mealCounts && <span className="text-xs font-semibold text-[#191c1e]">{mealCounts}</span>}
                </div>
                {form.processPart?.anotherSuggestionVn && (
                    <div className="flex items-start gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                        <span
                            role="img"
                            title={processPartFieldLabelsBilingual.anotherSuggestion}
                            aria-label={processPartFieldLabelsBilingual.anotherSuggestion}
                            className="mt-0.5 shrink-0"
                        >
                            <MessageCircle size={14} aria-hidden />
                        </span>
                        <span>{bilingualText(form.processPart.anotherSuggestionVn, form.processPart.anotherSuggestionJp)}</span>
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("employeeListTitle", { count: form.numberOfEmployee })}
                    </h2>
                    <span
                        title={t("totalWorkedHoursLabel")}
                        className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-white px-3 py-1 text-xs font-semibold tabular-nums text-[#191c1e]"
                    >
                        <Clock className="h-3.5 w-3.5 text-[#8a8f94]" aria-hidden />
                        {formatHours(totalWorkedHours)}
                    </span>
                </div>
                <div className="relative overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colEmployee")}</th>
                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colTime")}</th>
                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 text-center align-bottom">{t("colHours")}</th>
                                <th colSpan={2} className="whitespace-nowrap border-b border-[#e0e3e5] px-3 py-1.5 text-center">{t("colAccumulation")}</th>
                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 text-center align-bottom">{t("colMeal")}</th>
                                {/* Production-line forms always eat (DidEat true), so this column doesn't apply. */}
                                {!form.isProductionForm && <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 text-center align-bottom">{t("colDidEat")}</th>}
                                {hasNotes && <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colNote")}</th>}
                                {!actionResult && <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom" />}
                            </tr>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-3 py-1.5 text-center">{t("colMonth")}</th>
                                <th className="whitespace-nowrap px-3 py-1.5 text-center">{t("colYear")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.employees.map((employee) => {
                                // Removed via the app before this link was opened; the email channel can't remove but must reflect it.
                                const employeeCell = (
                                    <>
                                        <div className="font-semibold text-[#191c1e]">{employee.fullName}</div>
                                        <div className="text-xs tabular-nums text-[#5e3f3a]">{employee.employeeCode}</div>
                                    </>
                                );
                                if (employee.isRemoved) {
                                    const level = stepNameByOrder(form, employee.removedAtLevel);
                                    return (
                                        <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-[#f8fafc] opacity-60">
                                            <td className="whitespace-nowrap px-3 py-2.5 text-sm line-through">{employeeCell}</td>
                                            <td
                                                colSpan={removedColSpan}
                                                title={[removedByLabelBilingual, employee.removeReason && removedReasonLabelBilingual].filter(Boolean).join(" · ")}
                                                className="px-3 py-2.5 text-sm text-[#930006]"
                                            >
                                                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                                                    <UserX className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                    {employee.removedByFullName ?? employee.removedByUserName}
                                                    {level && ` (${level})`}
                                                    {employee.removeReason && <> · {employee.removeReason}</>}
                                                    {employee.removedAt && (
                                                        <span className="text-[#8a8f94]" title={formatDateTime(employee.removedAt)}>
                                                            · {formatShortDateTime(employee.removedAt)}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }
                                const over = exceededLimits(employee, form);
                                const isOverLimit = over.month !== null || over.year !== null;
                                return (
                                    <tr
                                        key={employee.employeeId}
                                        className={`border-b border-[#f1f5f9] transition-colors ${
                                            isOverLimit ? "bg-[#fff4f2] hover:bg-[#ffe9e6]" : "bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                        }`}
                                    >
                                        <td className="whitespace-nowrap px-3 py-2.5 text-sm">{employeeCell}</td>
                                        <td className="px-3 py-2.5 text-sm whitespace-nowrap text-[#5e3f3a]">
                                            <TimeRange start={formatTime(employee.startTime)} end={formatTime(employee.endTime)} />
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-sm font-semibold tabular-nums text-[#191c1e]">
                                            {formatHours(employee.actualHours)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm">
                                            <AccumulationHours
                                                hours={employee.monthToDate}
                                                overTitle={over.month !== null ? t("overMonthlyHint", { limit: over.month }) : undefined}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm">
                                            <AccumulationHours
                                                hours={employee.yearToDate}
                                                overTitle={over.year !== null ? t("overYearlyHint", { limit: over.year }) : undefined}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-sm">
                                            <MealTicketTypeBadge type={employee.mealTicketType} t={t} />
                                        </td>
                                        {!form.isProductionForm && (
                                            <td className="px-3 py-2.5 text-center text-sm">
                                                <span className="inline-flex justify-center">
                                                    {employee.didEat ? (
                                                        <IconFlag icon={Check} tone="success" label={t("didEatYes")} />
                                                    ) : (
                                                        <IconFlag icon={Clock} tone="warning" label={t("didEatNoHint")} />
                                                    )}
                                                </span>
                                            </td>
                                        )}
                                        {hasNotes && <td className="px-3 py-2.5 text-sm text-[#5e3f3a]">{bilingualText(employee.noteVn, employee.noteJp)}</td>}
                                        {!actionResult && (
                                            <td className="px-3 py-2.5 text-right">
                                                {activeEmployees.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openRemove(employee)}
                                                        title={tConfirm("removeEmployeeButton")}
                                                        aria-label={tConfirm("removeEmployeeButton")}
                                                        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#e9bcb6] bg-white p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                                                    >
                                                        <UserX className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {actionResult ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {actionResult === "approved" ? tConfirm("approvedResultMessage") : tConfirm("rejectedResultMessage")}
                </div>
            ) : (
                <div className="sticky bottom-0 z-20 flex justify-end gap-3 border-t border-[#e0e3e5] bg-white py-3">
                        <button
                            onClick={openRejectModal}
                            disabled={isSubmitting}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#930006] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <X className="h-4 w-4" />
                            {t("rejectButton")}
                        </button>
                        <button
                            onClick={openApproveModal}
                            disabled={isSubmitting}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Check className="h-4 w-4" />
                            {t("approveButton")}
                        </button>
                </div>
            )}

            {isApproveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeApproveModal} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("modalTitleApprove")}</h3>
                            <button
                                onClick={closeApproveModal}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {tConfirm("commentOptionalLabel")}
                                </span>
                                <textarea
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    disabled={isSubmitting}
                                    rows={3}
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {tConfirm("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
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
                                    onClick={closeApproveModal}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApprove}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting ? tCommon("processing") : t("confirmApprove")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isRejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeRejectModal} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{tConfirm("rejectModalTitle")}</h3>
                            <button
                                onClick={closeRejectModal}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {tConfirm("rejectReasonLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <textarea
                                    value={rejectComment}
                                    onChange={(event) => setRejectComment(event.target.value)}
                                    disabled={isSubmitting}
                                    rows={3}
                                    required
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {tConfirm("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={rejectSecondaryPassword}
                                    onChange={(event) => setRejectSecondaryPassword(event.target.value)}
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
                                    onClick={closeRejectModal}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting ? tCommon("processing") : t("confirmReject")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {removeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeRemove} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("removeModalTitle", { name: removeTarget.fullName })}</h3>
                            <button
                                onClick={closeRemove}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-[#5e3f3a]" title={t("removeModalHint")}>
                                {t("removeModalDesc")}
                            </p>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("removeReasonLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <textarea
                                    value={removeReason}
                                    onChange={(event) => setRemoveReason(event.target.value)}
                                    disabled={isRemovingEmployee}
                                    rows={3}
                                    required
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {tConfirm("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={removeSecondaryPassword}
                                    onChange={(event) => setRemoveSecondaryPassword(event.target.value)}
                                    disabled={isRemovingEmployee}
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
                                    onClick={closeRemove}
                                    disabled={isRemovingEmployee}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRemoveEmployee}
                                    disabled={isRemovingEmployee}
                                    className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isRemovingEmployee ? tCommon("processing") : t("confirmRemove")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
