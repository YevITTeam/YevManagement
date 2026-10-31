"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TimeRange } from "@/modules/attendance/components/ot-form/TimeRange";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Car, Check, ChevronDown, Clock, History, MessageCircle, Printer, Trash2, User, UserX, Utensils, X } from "lucide-react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalStepDto, OtFormDto, OtFormEditLogDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import { otFormStatusClasses } from "@/modules/attendance/types/enums";
import OtCaseBadge from "@/modules/attendance/components/OtCaseBadge";
import { useEnumLabels } from "@/modules/attendance/lib/useEnumLabels";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { formatHours } from "@/modules/attendance/lib/time";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useRouter } from "@/navigation";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import AccumulationHistoryModal from "@/modules/attendance/components/employees/AccumulationHistoryModal";
import { MealTicketTypeBadge } from "@/modules/attendance/components/ot-form/MealTicketTypeBadge";
import OtFormPrintView from "@/modules/attendance/components/ot-form/OtFormPrintView";

interface OtFormDetailProps {
    id: number;
    // Shown inside another screen's popup: hide every action that navigates away or changes the form.
    readOnly?: boolean;
}

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
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

// The chain is the snapshot in form.approvalSteps (sorted by stepOrder); each step's state comes from step.status.
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

// removedAtLevel holds a StepOrder; resolve the job title name from this form's own snapshot chain.
function stepNameByOrder(form: OtFormDto, stepOrder: number | null): string {
    if (stepOrder === null) return "";
    return form.approvalSteps.find((s) => s.stepOrder === stepOrder)?.jobTitleNameSnapshot ?? `#${stepOrder}`;
}

// Process-part items default to "No" when form.processPart is null.
function ProcessPartTile({
    icon,
    label,
    active,
    activeLabel,
    inactiveLabel,
}: {
    icon: ReactNode;
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
}) {
    return (
        <span
            title={active ? activeLabel : inactiveLabel}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${
                active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-[#e0e3e5] bg-white text-[#9aa0a6] line-through"
            }`}
        >
            {icon}
            {label}
        </span>
    );
}

// `wide` spans both grid columns.
function InfoField({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
    return (
        <div className={wide ? "col-span-2" : undefined}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{label}</div>
            <div className="mt-0.5 text-sm font-semibold text-[#191c1e]">{children}</div>
        </div>
    );
}

export default function OtFormDetail({ id, readOnly = false }: OtFormDetailProps) {
    const t = useTranslations("Attendance.OtFormDetail");
    const tCommon = useTranslations("Common");
    const enumLabels = useEnumLabels();
    const { user } = useAuth();
    const router = useRouter();
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [hasMySignature, setHasMySignature] = useState<boolean | null>(null);
    const [hasSecondaryPassword, setHasSecondaryPassword] = useState<boolean | null>(null);
    // Thresholds come from Admin-editable settings.
    const { setting } = useAttendanceSetting();

    const [actionOpen, setActionOpen] = useState<"approve" | "reject" | null>(null);
    const [comment, setComment] = useState("");
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // BE blocks deleting Completed forms (accumulation already counted); hide the button instead of letting it 400.
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState("");
    const [isDeletingForm, setIsDeletingForm] = useState(false);

    // Approvers only; modal shared with EmployeeList.tsx.
    const [historyEmployee, setHistoryEmployee] = useState<OtFormEmployeeDto | null>(null);

    // No secondary password needed, same as the email channel (see RemoveOtFormEmployeeDto).
    const [removeTarget, setRemoveTarget] = useState<OtFormEmployeeDto | null>(null);
    const [removeReason, setRemoveReason] = useState("");
    const [isRemovingEmployee, setIsRemovingEmployee] = useState(false);

    const { isLoading, error, refetch: fetchForm } = useFetchEffect(
        () => OtFormApi.getOtFormById(id),
        [id],
        (data) => setForm(data),
        t("loadError"),
        undefined,
        "ot-form-detail"
    );

    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");
    // Separate permission from canEdit (which is creator-only for group forms): the endpoint uses the
    // "current pending step candidate" rule for both form types, and BE is the real gate.
    const canRemoveEmployee = !readOnly && hasPermission(user, "Attendance.OTForm.RemoveEmployee");
    // Lowest pending StepOrder; null when Completed/Rejected or the chain is empty (auto-completed on create).
    const currentStep = form?.approvalSteps.find((s) => s.status === 0) ?? null;
    const showApprovalActions = !readOnly && canApprove && form?.status === 0 && currentStep !== null;
    const requireSignatureToApprove = currentStep?.requiresSignatureSnapshot ?? false;

    // Group forms: Create + must be the creator. Production-line forms: CreateProduction, editable per step;
    // candidate checks are left to BE (OtFormService.UpdateAsync) like Approve/Reject.
    // Account names differ only in case between login ("YEV\x") and imported data ("yev\x").
    const myUserName = user?.userName.toLowerCase();
    const canEdit =
        !readOnly &&
        Boolean(form?.isEditable) &&
        (form?.isProductionForm
            ? hasPermission(user, "Attendance.OTForm.CreateProduction")
            : hasPermission(user, "Attendance.OTForm.Create") && form?.createdByUserName.toLowerCase() === myUserName);

    const canResubmit =
        !readOnly &&
        !canEdit &&
        form?.resubmitKind != null &&
        (form.resubmitUserNames.some((n) => n.toLowerCase() === myUserName) || (form.resubmitKind === 2 && Boolean(user?.roles.includes("Admin"))));

    // Admin only; blocked once Completed (status=1, accumulation already counted).
    const canDelete = !readOnly && hasPermission(user, "Attendance.OTForm.Delete") && form?.status !== 1;

    // Production-line forms show Line/Team/shift both in the info block (distinct values of active employees) and per row.
    const productionSummary = useMemo(() => {
        if (!form?.isProductionForm) return null;
        const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => Boolean(v))));
        const activeEmployees = form.employees.filter((e) => !e.isRemoved);
        return {
            lines: distinct(activeEmployees.map((e) => e.blockCodeSnapshot)),
            teams: distinct(activeEmployees.map((e) => e.teamCodeSnapshot)),
            shiftTeams: distinct(activeEmployees.map((e) => e.shiftTeamCodeSnapshot)),
        };
    }, [form]);

    const openAction = (type: "approve" | "reject") => {
        setComment("");
        setSecondaryPassword("");
        setActionOpen(type);
        if (type === "approve") {
            UserSignatureApi.getMySignature()
                .then((data) => setHasMySignature(Boolean(data)))
                .catch(() => setHasMySignature(false));
        }
        // The secondary password applies to both approve and reject.
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    };

    const closeAction = () => {
        if (isSubmittingAction) return;
        setActionOpen(null);
    };

    const handleApprove = async () => {
        if (requireSignatureToApprove && hasMySignature === false) {
            toast.error(t("approveSignatureMissingError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.approveOtForm(id, { comment: comment.trim() || null, secondaryPassword });
            toast.success(t("approveSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("approveError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            toast.error(t("rejectCommentRequiredError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.rejectOtForm(id, { comment: comment.trim(), secondaryPassword });
            toast.success(t("rejectSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("rejectError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const openRemove = (employee: OtFormEmployeeDto) => {
        setRemoveReason("");
        setRemoveTarget(employee);
    };

    const closeRemove = () => {
        if (isRemovingEmployee) return;
        setRemoveTarget(null);
    };

    const handleRemoveEmployee = async () => {
        if (!removeTarget) return;
        if (!removeReason.trim()) {
            toast.error(t("removeReasonRequiredError"));
            return;
        }
        setIsRemovingEmployee(true);
        try {
            const updated = await OtFormApi.removeOtFormEmployee(id, {
                employeeId: removeTarget.employeeId,
                reason: removeReason.trim(),
            });
            setForm(updated);
            toast.success(t("removeSuccess", { name: removeTarget.fullName }));
            setRemoveTarget(null);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("removeError")));
        } finally {
            setIsRemovingEmployee(false);
        }
    };

    // Label of one edit-log row; actionType follows enum OtFormEditActionType.
    const editLogFieldLabels: Record<string, string> = {
        StartTime: t("editLogFieldStartTime"),
        EndTime: t("editLogFieldEndTime"),
        DidEat: t("editLogFieldDidEat"),
        NoteVn: t("editLogFieldNoteVn"),
        NoteJp: t("editLogFieldNoteJp"),
        Date: t("editLogFieldDate"),
        FormStartTime: t("editLogFieldFormStartTime"),
        FormEndTime: t("editLogFieldFormEndTime"),
        Reason: t("editLogFieldReason"),
        SubReason: t("editLogFieldSubReason"),
        OtCase: t("editLogFieldOtCase"),
        MilkCount: t("editLogFieldMilkCount"),
        IsTransportation: t("editLogFieldTransportation"),
        IsUseCopyRoom: t("editLogFieldCopyRoom"),
        AnotherSuggestionVn: t("editLogFieldAnotherSuggestionVn"),
        AnotherSuggestionJp: t("editLogFieldAnotherSuggestionJp"),
    };
    const editLogActionLabel = (log: OtFormEditLogDto) => {
        if (log.actionType === 2) return t("editLogEmployeeAdded");
        if (log.actionType === 3) return t("editLogEmployeeRemoved");
        if (log.actionType === 5) return t("editLogResubmitted");
        return (log.fieldName && editLogFieldLabels[log.fieldName]) || log.fieldName || "";
    };

    const openDeleteModal = () => {
        setDeleteReason("");
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        if (isDeletingForm) return;
        setIsDeleteModalOpen(false);
    };

    const handleDeleteForm = async () => {
        if (!deleteReason.trim()) {
            toast.error(t("deleteReasonRequiredError"));
            return;
        }
        setIsDeletingForm(true);
        try {
            await OtFormApi.deleteOtForm(id, { reason: deleteReason.trim() });
            toast.success(t("deleteSuccess"));
            router.push({ pathname: "/ot/list" });
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeletingForm(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (error || !form) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    const approvalStepViews = buildApprovalSteps(form);
    // Removed employees are excluded from totals but their rows stay visible as an audit trail.
    const activeEmployees = form.employees.filter((employee) => !employee.isRemoved);
    const totalWorkedHours = activeEmployees.reduce((sum, employee) => sum + employee.actualHours, 0);
    // Notes column only when at least one active employee has a note.
    const hasNotes = activeEmployees.some((employee) => Boolean(employee.noteVn || employee.noteJp));
    // Columns after code + name (the "removed" row spans the rest).
    const removedColSpan = 5 + (hasNotes ? 1 : 0) + (form.isProductionForm ? 3 : 0) + (canRemoveEmployee ? 1 : 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-[#191c1e]">{t("titleWithId", { id: form.id })}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {bilingualText(form.departmentNameVn, form.departmentNameJp)} — {bilingualText(form.groupNameVn, form.groupNameJp)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                    >
                        {enumLabels.otFormStatus[form.status] ?? t("unknownStatus")}
                    </span>
                    {canEdit && (
                        <button
                            onClick={() => router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } })}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            {t("editButton")}
                        </button>
                    )}
                    {canResubmit && (
                        <button
                            onClick={() => router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } })}
                            title={form.resubmitDeadline ? t("resubmitDeadline", { date: new Date(form.resubmitDeadline).toLocaleString("vi-VN") }) : undefined}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            {t("resubmitButton")}
                        </button>
                    )}
                    <button
                        onClick={() => setIsPrintOpen(true)}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        {t("printButton")}
                    </button>
                    {canDelete && (
                        <button
                            onClick={openDeleteModal}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#930006] bg-white px-3 py-1.5 text-xs font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> {t("deleteButton")}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
                {/* Left column: form info, support items and approval progress. */}
                <div className="space-y-4">
                    <section className="space-y-3.5 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                            <InfoField label={t("otCaseLabel")}>
                                <OtCaseBadge code={form.otCaseCode} description={form.otCaseDescription} descriptionJp={form.otCaseDescriptionJp} />
                            </InfoField>
                            <InfoField label={t("dateLabel")}>{formatDate(form.date)}</InfoField>
                            <InfoField label={t("reasonLabel")} wide>
                                {bilingualText(form.reasonNameVn, form.reasonNameJp)}
                            </InfoField>
                            <InfoField label={t("timeLabel")}>
                                <TimeRange start={formatTime(form.startTime)} end={formatTime(form.endTime)} hours={form.totalHour} />
                            </InfoField>
                            <InfoField label={t("createdByLabel")}>{form.createdByFullName ?? form.createdByUserName}</InfoField>
                            {productionSummary && (
                                <>
                                    <InfoField label={t("colBlockCode")}>{productionSummary.lines.join(", ") || "—"}</InfoField>
                                    <InfoField label={t("colTeamCode")}>{productionSummary.teams.join(", ") || "—"}</InfoField>
                                    <InfoField label={t("colShiftTeam")} wide>
                                        {productionSummary.shiftTeams.join(", ") || "—"}
                                    </InfoField>
                                </>
                            )}
                            {form.subReason && (
                                <InfoField label={t("subReasonLabel")} wide>
                                    {form.subReason}
                                </InfoField>
                            )}
                        </div>

                        {/* Always shown even when processPart is null (defaults to "No"), otherwise users assume info is missing. */}
                        <div className="space-y-2 border-t border-[#e0e3e5] pt-3.5">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{t("processPartTitle")}</h2>
                            <div className="flex flex-nowrap gap-1.5">
                                <ProcessPartTile
                                    icon={<Utensils size={12} />}
                                    label={t("eatFieldLabel")}
                                    active={Boolean(form.processPart?.isEat)}
                                    activeLabel={t("yes")}
                                    inactiveLabel={t("no")}
                                />
                                <ProcessPartTile
                                    icon={<Car size={12} />}
                                    label={t("transportationFieldLabel")}
                                    active={Boolean(form.processPart?.isTransportation)}
                                    activeLabel={t("yes")}
                                    inactiveLabel={t("no")}
                                />
                                <ProcessPartTile
                                    icon={<Printer size={12} />}
                                    label={t("copyRoomFieldLabel")}
                                    active={Boolean(form.processPart?.isUseCopyRoom)}
                                    activeLabel={t("yes")}
                                    inactiveLabel={t("no")}
                                />
                            </div>
                            {form.processPart?.isEat && (
                                <p className="text-xs font-semibold text-[#191c1e]">
                                    {[
                                        t("mainTicketLabel", { count: form.processPart.mainTicketCount }),
                                        t("secondaryTicketLabel", { count: form.processPart.secondaryTicketCount }),
                                        t("milkLabel", { count: form.processPart.milkCount }),
                                    ].join("  ·  ")}
                                </p>
                            )}
                            {form.processPart?.anotherSuggestionVn && (
                                <div className="flex items-start gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                                    <MessageCircle size={14} className="mt-0.5 shrink-0" />
                                    <span>
                                        <span className="font-semibold text-[#191c1e]">{t("anotherSuggestionFieldLabel")}: </span>
                                        {bilingualText(form.processPart.anotherSuggestionVn, form.processPart.anotherSuggestionJp)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{t("approvalProgressTitle")}</h2>
                        {form.approvalChainWarning && (
                            <div className="mb-4 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-xs text-[#9a5b00]">
                                {form.approvalChainWarning}
                            </div>
                        )}
                        <ol>
                            {/* Steps at or below the creator's rank are dropped from the chain, so the creator heads the timeline to show who sent it up. */}
                            <li className="relative flex gap-3 pb-4 last:pb-0">
                                {approvalStepViews.length > 0 && <span className="absolute bottom-0 left-3.5 top-7 w-px bg-emerald-500" aria-hidden />}
                                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
                                    <Check size={14} />
                                </span>
                                <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                        <span className="text-sm font-semibold text-[#191c1e]">{t("requesterStep")}</span>
                                        <span className="text-[11px] text-[#8a8f94]">{formatDateTime(form.createdAt)}</span>
                                    </div>
                                    <div className="text-xs text-[#5e3f3a]">
                                        {form.createdByFullName ?? form.createdByUserName} · {t("createdAction")}
                                    </div>
                                    {form.creatorSignatureImage && (
                                        // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image can't optimize it
                                        <img
                                            src={`data:image/png;base64,${form.creatorSignatureImage}`}
                                            alt={t("signatureAlt", { name: form.createdByFullName ?? form.createdByUserName })}
                                            className="mt-1 h-10 w-28 rounded border border-[#e0e3e5] bg-white object-contain"
                                        />
                                    )}
                                </div>
                            </li>
                            {approvalStepViews.map((view, index) => {
                                const history = view.history;
                                const isMuted = view.state === "upcoming" || view.state === "skipped";
                                return (
                                    <li key={view.step.id} className="relative flex gap-3 pb-4 last:pb-0">
                                        {index < approvalStepViews.length - 1 && (
                                            <span
                                                className={`absolute bottom-0 left-3.5 top-7 w-px ${view.state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"}`}
                                                aria-hidden
                                            />
                                        )}
                                        {/* relative z-10: the connector line is absolute and would draw over the circle */}
                                        <span
                                            className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                                view.state === "done"
                                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                                    : view.state === "rejected"
                                                    ? "border-[#930006] bg-[#930006] text-white"
                                                    : view.state === "current"
                                                    ? "border-[#9a5b00] bg-[#fff4e5] text-[#9a5b00]"
                                                    : "border-[#e0e3e5] bg-white text-[#9aa0a6]"
                                            }`}
                                        >
                                            {view.state === "done" && <Check size={14} />}
                                            {view.state === "rejected" && <X size={14} />}
                                            {view.state === "current" && <Clock size={14} />}
                                            {isMuted && index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                                <span className={`text-sm font-semibold ${isMuted ? "text-[#9aa0a6]" : "text-[#191c1e]"}`}>
                                                    {view.step.jobTitleNameSnapshot}
                                                </span>
                                                {history && (
                                                    <span className="text-[11px] text-[#8a8f94]">{formatDateTime(history.actionAt)}</span>
                                                )}
                                            </div>
                                            {history ? (
                                                <>
                                                    <div className="text-xs text-[#5e3f3a]">
                                                        {history.approverFullName ?? history.approverUserName}
                                                        {history.onBehalfOfUserName &&
                                                            ` (${t("onBehalfOf", { name: history.onBehalfOfFullName ?? history.onBehalfOfUserName })})`}{" "}
                                                        · {enumLabels.approvalAction[history.action]}
                                                    </div>
                                                    {history.comment && (
                                                        <div className="text-xs italic text-[#191c1e]">&quot;{history.comment}&quot;</div>
                                                    )}
                                                    {history.hasSignature && history.signatureImage && (
                                                        // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image can't optimize it
                                                        <img
                                                            src={`data:image/png;base64,${history.signatureImage}`}
                                                            alt={t("signatureAlt", { name: history.approverFullName ?? history.approverUserName })}
                                                            className="mt-1 h-10 w-28 rounded border border-[#e0e3e5] bg-white object-contain"
                                                        />
                                                    )}
                                                </>
                                            ) : view.state === "current" ? (
                                                <div
                                                    className="text-xs text-[#9a5b00]"
                                                    title={
                                                        view.step.candidates.length > 1
                                                            ? t("waitingCandidatesTooltip", {
                                                                  names: view.step.candidates.map((c) => c.fullName).join(", "),
                                                              })
                                                            : undefined
                                                    }
                                                >
                                                    {view.step.candidates.length > 1
                                                        ? t("waitingShortMulti", { count: view.step.candidates.length })
                                                        : t("waitingShort")}
                                                </div>
                                            ) : view.state === "skipped" ? (
                                                <div className="text-xs text-[#9aa0a6]">{t("skippedShort")}</div>
                                            ) : (
                                                <div className="text-xs text-[#9aa0a6]">{t("notProcessedYet")}</div>
                                            )}
                                            {/* Candidates snapshotted at creation; only for unprocessed steps (processed ones show the real approver). */}
                                            {!history && (view.state === "current" || view.state === "upcoming") && view.step.candidates.length > 0 && (
                                                <div className="flex flex-wrap gap-1 pt-1">
                                                    {view.step.candidates.slice(0, 3).map((candidate) => (
                                                        <span
                                                            key={candidate.employeeId}
                                                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                                                view.state === "current"
                                                                    ? "border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]"
                                                                    : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                                            }`}
                                                        >
                                                            <User size={10} />
                                                            {candidate.fullName}
                                                        </span>
                                                    ))}
                                                    {view.step.candidates.length > 3 && (
                                                        <span
                                                            title={view.step.candidates
                                                                .slice(3)
                                                                .map((candidate) => candidate.fullName)
                                                                .join(", ")}
                                                            className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#5e3f3a]"
                                                        >
                                                            +{view.step.candidates.length - 3}
                                                        </span>
                                                    )}
                                                    {view.step.delegates.map((delegate) => (
                                                        <span
                                                            key={`${delegate.delegatorUserName}-${delegate.delegateFullName}`}
                                                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-[#c9ced3] bg-white px-2 py-0.5 text-[11px] font-medium text-[#5e3f3a]"
                                                        >
                                                            <User size={10} />
                                                            {delegate.delegateFullName} (
                                                            {t("onBehalfOf", {
                                                                name:
                                                                    view.step.candidates.find((c) => c.userName === delegate.delegatorUserName)?.fullName ??
                                                                    delegate.delegatorUserName,
                                                            })}
                                                            )
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                </div>

                {/* Right column: employees and edit log. */}
                <div className="min-w-0 space-y-6">
                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                {t("employeeListTitle", { count: form.numberOfEmployee })}
                            </h2>
                            <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-white px-3 py-0.5 text-xs font-semibold text-[#191c1e]">
                                {t("totalWorkedHoursLabel", { hours: formatHours(totalWorkedHours) })}
                            </span>
                        </div>
                        {/* The list can be hundreds of rows: scroll inside the table with a sticky header instead of stretching the page. */}
                        <div className="max-h-[560px] overflow-auto">
                            <table className="min-w-full border-collapse text-left [&_td]:border-r [&_td]:border-[#eef1f3] [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-[#e0e3e5]">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colEmployeeCode")}</th>
                                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colFullName")}</th>
                                        {form.isProductionForm && (
                                            <>
                                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colBlockCode")}</th>
                                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colTeamCode")}</th>
                                                <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colShiftTeam")}</th>
                                            </>
                                        )}
                                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colTime")}</th>
                                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 text-center align-bottom">{t("colHours")}</th>
                                        <th colSpan={2} className="whitespace-nowrap border-b border-[#e0e3e5] px-3 py-1.5 text-center">{t("colAccumulation")}</th>
                                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 text-center align-bottom">{t("colMeal")}</th>
                                        {hasNotes && <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom">{t("colNote")}</th>}
                                        {canRemoveEmployee && <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 align-bottom" />}
                                    </tr>
                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                        <th className="whitespace-nowrap px-3 py-1.5 text-center">{t("colMonth")}</th>
                                        <th className="whitespace-nowrap px-3 py-1.5 text-center">{t("colYear")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.employees.map((employee) => {
                                        const isMonthOverLimit = employee.monthToDate > setting.monthlyOtHourLimit;
                                        const isYearOverLimit = employee.yearToDate > setting.yearlyOtHourLimit;
                                        const isOverLimit = isMonthOverLimit || isYearOverLimit;
                                        const hours = employee.actualHours;
                                        // Removed: keep the row as an audit trail, dimmed and struck through, with the reason instead of the numbers.
                                        if (employee.isRemoved) {
                                            return (
                                                <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-[#f8fafc] opacity-60">
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-sm">
                                                        <span className="inline-flex items-center rounded-md border border-[#d5dade] bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#191c1e] line-through">
                                                            {employee.employeeCode}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-[#191c1e] line-through">{employee.fullName}</td>
                                                    <td colSpan={removedColSpan} className="px-3 py-2.5 text-xs text-[#930006]">
                                                        {t(employee.removeReason ? "removedInlineNote" : "removedInlineNoteNoReason", {
                                                            name: employee.removedByFullName ?? employee.removedByUserName ?? "",
                                                            level: stepNameByOrder(form, employee.removedAtLevel),
                                                            reason: employee.removeReason ?? "",
                                                        })}
                                                        {employee.removedAt && (
                                                            <span className="ml-2 text-[#9aa0a6]">({formatDateTime(employee.removedAt)})</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return (
                                            <tr
                                                key={employee.employeeId}
                                                className={`border-b border-[#f1f5f9] transition-colors ${
                                                    isOverLimit ? "bg-[#fff4f2] hover:bg-[#ffe9e6]" : "bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                                }`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2.5 text-sm">
                                                    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-[#d5dade] bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-[#191c1e]">
                                                        {employee.employeeCode}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-[#191c1e]">{employee.fullName}</td>
                                                {form.isProductionForm && (
                                                    <>
                                                        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#5e3f3a]">{employee.blockCodeSnapshot ?? "—"}</td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#5e3f3a]">{employee.teamCodeSnapshot ?? "—"}</td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#5e3f3a]">{employee.shiftTeamCodeSnapshot ?? "—"}</td>
                                                    </>
                                                )}
                                                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#5e3f3a]">
                                                    <TimeRange start={formatTime(employee.startTime)} end={formatTime(employee.endTime)} />
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-sm">
                                                    <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                                        {formatHours(hours)}
                                                    </span>
                                                </td>
                                                <td className={`px-3 py-2.5 text-center text-sm ${isMonthOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                                    {employee.monthToDate}h
                                                </td>
                                                <td className={`whitespace-nowrap px-3 py-2.5 text-center text-sm ${isYearOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                                    <span className="inline-flex items-center gap-1">
                                                        {employee.yearToDate}h
                                                        {canApprove && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setHistoryEmployee(employee)}
                                                                title={t("viewAccumulationHistoryHint")}
                                                                aria-label={t("viewAccumulationHistoryHint")}
                                                                className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                            >
                                                                <History className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </span>
                                                </td>
                                                {/* Meal ticket type plus a "didn't eat" label; production-line forms always eat (DidEat true), so no label there. */}
                                                <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm">
                                                    <span className="inline-flex items-center justify-center gap-1.5">
                                                        <MealTicketTypeBadge type={employee.mealTicketType} t={t} />
                                                        {!form.isProductionForm && !employee.didEat && (
                                                            <span
                                                                title={t("didEatNoHint")}
                                                                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#9a5b00]"
                                                            >
                                                                <X size={11} />
                                                                {t("didEatNo")}
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                                {hasNotes && (
                                                    <td className="px-3 py-2.5 text-sm text-[#5e3f3a]">{bilingualText(employee.noteVn, employee.noteJp)}</td>
                                                )}
                                                {canRemoveEmployee && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        {activeEmployees.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openRemove(employee)}
                                                                title={t("removeEmployeeButton")}
                                                                aria-label={t("removeEmployeeButton")}
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

                    <details className="group overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a] [&::-webkit-details-marker]:hidden">
                            <span>
                                {t("editLogTitle")} ({form.editLogs.length})
                            </span>
                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-[#e0e3e5] px-5 py-3">
                            {form.editLogs.length === 0 ? (
                                <p className="text-sm text-[#9aa0a6]">{t("editLogEmpty")}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                                <th className="whitespace-nowrap px-3 py-2">{t("editLogColTime")}</th>
                                                <th className="whitespace-nowrap px-3 py-2">{t("editLogColActor")}</th>
                                                <th className="whitespace-nowrap px-3 py-2">{t("editLogColEmployee")}</th>
                                                <th className="whitespace-nowrap px-3 py-2">{t("editLogColAction")}</th>
                                                <th className="whitespace-nowrap px-3 py-2">{t("editLogColChange")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.editLogs.map((log, index) => (
                                                <tr key={index} className="border-b border-[#f1f5f9] text-sm">
                                                    <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{formatDateTime(log.actionAt)}</td>
                                                    <td className="px-3 py-2 text-[#191c1e]">{log.actionByFullName ?? log.actionByUserName}</td>
                                                    <td className="px-3 py-2 text-[#191c1e]">{log.employeeCodeSnapshot ?? "-"}</td>
                                                    <td className="px-3 py-2 text-[#5e3f3a]">{editLogActionLabel(log)}</td>
                                                    <td className="px-3 py-2 text-[#191c1e]">
                                                        {log.actionType === 5
                                                            ? log.newValue
                                                            : log.oldValue != null || log.newValue != null
                                                            ? t("editLogChangeValue", { oldValue: log.oldValue ?? "-", newValue: log.newValue ?? "-" })
                                                            : "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            </div>


{showApprovalActions && (
                <div className="sticky bottom-0 z-20 flex justify-end gap-3 border-t border-[#e0e3e5] bg-[#f8fafc]/95 py-3 backdrop-blur">
                    <button
                        onClick={() => openAction("reject")}
                        className="cursor-pointer rounded-lg border border-[#930006] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                    >
                        {t("rejectButton")}
                    </button>
                    <button
                        onClick={() => openAction("approve")}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        {t("approveButton")}
                    </button>
                </div>
            )}

            {actionOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeAction} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">
                                {actionOpen === "approve" ? t("modalTitleApprove") : t("modalTitleReject")}
                            </h3>
                            <button
                                onClick={closeAction}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("commentLabel")} {actionOpen === "reject" && <span className="text-[#930006]">*</span>}
                                </span>
                                <textarea
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    disabled={isSubmittingAction}
                                    rows={3}
                                    required={actionOpen === "reject"}
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={secondaryPassword}
                                    onChange={(event) => setSecondaryPassword(event.target.value)}
                                    disabled={isSubmittingAction}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <div
                                className={`rounded-lg border px-3 py-2 text-xs ${
                                    hasSecondaryPassword === false
                                        ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                        : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                }`}
                            >
                                {hasSecondaryPassword === false ? t("secondaryPasswordMissingHint") : t("secondaryPasswordOkHint")}
                            </div>

                            {actionOpen === "approve" && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-xs ${
                                        requireSignatureToApprove && hasMySignature === false
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`}
                                >
                                    {requireSignatureToApprove && hasMySignature === false
                                        ? t("approveSignatureMissingHint")
                                        : t("approveSignatureOkHint")}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeAction}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={actionOpen === "approve" ? handleApprove : handleReject}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmittingAction
                                        ? tCommon("processing")
                                        : actionOpen === "approve"
                                        ? t("confirmApprove")
                                        : t("confirmReject")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPrintOpen &&
                createPortal(
                    <div id="ot-print-portal" className="fixed inset-0 z-50 flex justify-center bg-black/40 p-4">
                        {/* Print only the popup: hide the rest of the page and un-fix the overlay */}
                        <style>{`@media print{body>*:not(#ot-print-portal){display:none!important}#ot-print-portal,#ot-print-portal>div{position:static!important;display:block!important;overflow:visible!important;max-height:none!important;padding:0!important;background:none!important;box-shadow:none!important}}`}</style>
                        <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-xl shadow-xl">
                            <OtFormPrintView id={form.id} onClose={() => setIsPrintOpen(false)} />
                        </div>
                    </div>,
                    document.body
                )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeDeleteModal} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("deleteModalTitle", { id: form.id })}</h3>
                            <button
                                onClick={closeDeleteModal}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-[#5e3f3a]">{t("deleteModalDesc")}</p>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("deleteReasonLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <textarea
                                    value={deleteReason}
                                    onChange={(event) => setDeleteReason(event.target.value)}
                                    disabled={isDeletingForm}
                                    rows={3}
                                    required
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeDeleteModal}
                                    disabled={isDeletingForm}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteForm}
                                    disabled={isDeletingForm}
                                    className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isDeletingForm ? tCommon("processing") : t("confirmDelete")}
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
                            <p className="text-sm text-[#5e3f3a]">{t("removeModalDesc")}</p>

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

            {historyEmployee && (
                <AccumulationHistoryModal
                    employeeId={historyEmployee.employeeId}
                    employeeLabel={`${historyEmployee.fullName} (${historyEmployee.employeeCode})`}
                    onClose={() => setHistoryEmployee(null)}
                />
            )}
        </div>
    );
}
