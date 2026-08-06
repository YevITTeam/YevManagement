"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { X } from "lucide-react";

import { OtFormBatchApi } from "@/modules/attendance/api/ot-form-batch.api";
import type { OtFormBatchDto, ProcessOtFormBatchFormDto } from "@/modules/attendance/types/ot-form-batch.dto";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { calculateHours, formatHours } from "@/modules/attendance/lib/time";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useRouter } from "@/navigation";

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

// Màn duyệt "Đơn tổng" — dùng chung cho cả 2 kênh (trong app qua JWT + trang public qua link email),
// docs/attendance-api-fe.md §Đơn tổng. Mặc định mọi nhân viên/đơn nhỏ đều được Duyệt — Trưởng phòng bỏ
// chọn từng nhân viên không muốn cho OT, hoặc bấm "Từ chối" cả 1 đơn nhỏ, rồi duyệt 1 lần cho phần còn
// lại (mỗi đơn nhỏ tiếp tục đúng luồng duyệt hiện có, không đổi gì ở đó).
export default function OtFormBatchDetail(props: OtFormBatchDetailProps) {
    const t = useTranslations("Attendance.OtFormBatchDetail");
    const tCommon = useTranslations("Common");
    const router = useRouter();

    const [batch, setBatch] = useState<OtFormBatchDto | null>(null);
    const [decisions, setDecisions] = useState<Record<number, FormDecisionState>>({});
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [processedResult, setProcessedResult] = useState(false);

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

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("titleWithId", { id: batch.id })}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {bilingualText(batch.departmentNameVn, batch.departmentNameJp)} — {t("batchDateLabel", { date: formatDate(batch.batchDate) })}
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
                    <div className="space-y-4">
                        {batch.otForms.map((form) => {
                            const state = decisions[form.otFormId];
                            if (!state) return null;
                            const totalHours = form.employees.reduce(
                                (sum, employee) => sum + calculateHours(employee.startTime, employee.endTime),
                                0
                            );
                            return (
                                <section key={form.otFormId} className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-4">
                                        <div>
                                            <div className="text-sm font-semibold text-[#191c1e]">
                                                {t("formTitle", { id: form.otFormId })} — {bilingualText(form.groupNameVn, form.groupNameJp)}
                                            </div>
                                            <div className="mt-0.5 text-xs text-[#5e3f3a]">
                                                {form.otCaseCode} · {bilingualText(form.reasonNameVn, form.reasonNameJp)} · {formatDate(form.date)} ·{" "}
                                                {formatTime(form.startTime)}–{formatTime(form.endTime)} · {t("createdByLabel")}:{" "}
                                                {form.createdByFullName ?? form.createdByUserName}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setDecision(form.otFormId, 0)}
                                                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                                    state.decision === 0
                                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                        : "border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6]"
                                                }`}
                                            >
                                                {t("decisionApprove")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDecision(form.otFormId, 1)}
                                                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                                    state.decision === 1
                                                        ? "border-[#930006] bg-[#fff4f2] text-[#930006]"
                                                        : "border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6]"
                                                }`}
                                            >
                                                {t("decisionReject")}
                                            </button>
                                        </div>
                                    </div>

                                    {state.decision === 1 ? (
                                        <div className="px-6 py-4">
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
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full border-collapse text-left">
                                                <thead>
                                                    <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                                        <th className="px-6 py-2.5">{t("colInclude")}</th>
                                                        <th className="px-6 py-2.5">{t("colEmployeeCode")}</th>
                                                        <th className="px-6 py-2.5">{t("colFullName")}</th>
                                                        <th className="px-6 py-2.5">{t("colTime")}</th>
                                                        <th className="px-6 py-2.5 text-center">{t("colHours")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.employees.map((employee) => {
                                                        const isExcluded = state.excludedEmployeeIds.has(employee.employeeId);
                                                        const hours = calculateHours(employee.startTime, employee.endTime);
                                                        return (
                                                            <tr key={employee.employeeId} className={`border-b border-[#f1f5f9] ${isExcluded ? "opacity-50" : ""}`}>
                                                                <td className="px-6 py-2.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!isExcluded}
                                                                        onChange={() => toggleEmployee(form.otFormId, employee.employeeId)}
                                                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-2.5 text-sm">
                                                                    <span className="inline-flex items-center rounded-md bg-[#eceef0] px-2 py-0.5 font-mono text-xs font-semibold text-[#191c1e]">
                                                                        {employee.employeeCode}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-2.5 text-sm font-medium text-[#191c1e]">{employee.fullName}</td>
                                                                <td className="px-6 py-2.5 text-sm text-[#5e3f3a]">
                                                                    {formatTime(employee.startTime)} — {formatTime(employee.endTime)}
                                                                </td>
                                                                <td className="px-6 py-2.5 text-center text-sm text-[#191c1e]">{formatHours(hours)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <div className="border-t border-[#e0e3e5] bg-[#fbfcfd] px-6 py-2 text-right text-xs font-semibold text-[#5e3f3a]">
                                                {t("formTotalHoursLabel", { hours: formatHours(totalHours) })}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={openProcessModal}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b40009]"
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
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
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
                            <p className="text-sm text-[#5e3f3a]">{t("modalDesc")}</p>
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
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleProcess}
                                    disabled={isSubmitting}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
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
