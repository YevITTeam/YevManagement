"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, CheckCircle2, Star, X } from "lucide-react";

import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import type { ResolveApprovalChainResultDto } from "@/modules/attendance/types/job-title.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";

const fieldLabelClassName =
    "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";

// Tab "Thử chuỗi duyệt" — công cụ xem trước Giai đoạn 2 "Cây chức vụ" (2026-08-06, xây song song,
// CHƯA wiring vào OtForm thật). Không phải màn CRUD nên implement ListHandle tối giản (openCreate no-op,
// refresh no-op vì không có danh sách nào cần tải sẵn) — cùng khuôn AttendanceSettingPanel.
const ApprovalChainPreviewPanel = forwardRef<ListHandle, ListToolbarProps>(function ApprovalChainPreviewPanel(
    { onLoadingChange },
    ref
) {
    const t = useTranslations("Attendance.ApprovalChainPreview");

    const [employees, setEmployees] = useState<EmployeeDto[]>([]);
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);
    const [employeeId, setEmployeeId] = useState<number | "">("");
    const [otCaseId, setOtCaseId] = useState<number | "">("");
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isResolving, setIsResolving] = useState(false);
    const [result, setResult] = useState<ResolveApprovalChainResultDto | null>(null);

    useEffect(() => {
        setIsLoadingOptions(true);
        Promise.all([EmployeeApi.getAllEmployees(), OtCaseApi.getAllOtCases()])
            .then(([employeeData, otCaseData]) => {
                setEmployees(employeeData);
                setOtCases(otCaseData);
            })
            .catch((err) => {
                console.error(err);
                toast.error(t("loadOptionsError"));
            })
            .finally(() => setIsLoadingOptions(false));
    }, [t]);

    useEffect(() => {
        onLoadingChange?.(isLoadingOptions);
    }, [isLoadingOptions, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: () => {},
        openCreate: () => {},
    }));

    // Xây options cho SearchableSelect ─────────────────────────────────────
    // Employee: tìm theo tên (firstName / lastName), mã NV, chức vụ.
    // searchText rộng hơn label (gộp cả firstName+lastName theo 2 chiều, mã, chức vụ).
    const employeeOptions: SelectOption[] = employees.map((e) => ({
        value: e.id,
        label: `${e.lastName} ${e.firstName} (${e.code})${e.jobTitleName ? ` — ${e.jobTitleName}` : ""}`,
        searchText: [
            e.lastName,
            e.firstName,
            `${e.firstName} ${e.lastName}`,
            e.code,
            e.jobTitleName ?? "",
        ]
            .join(" ")
            .toLowerCase(),
    }));

    // OtCase: tìm theo mã hoặc mô tả.
    const otCaseOptions: SelectOption[] = otCases.map((c) => ({
        value: c.id,
        label: `${c.code}${c.description ? ` — ${c.description}` : ""}`,
        searchText: `${c.code} ${c.description ?? ""}`.toLowerCase(),
    }));
    // ───────────────────────────────────────────────────────────────────────

    const handleResolve = async () => {
        if (!employeeId || !otCaseId) return;
        setIsResolving(true);
        setResult(null);
        try {
            const data = await JobTitleApi.resolveChain(employeeId, otCaseId);
            setResult(data);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("resolveError")));
        } finally {
            setIsResolving(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <p className="text-sm text-[#5e3f3a]">{t("description")}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldEmployee")}</span>
                        <SearchableSelect
                            options={employeeOptions}
                            value={employeeId}
                            onChange={setEmployeeId}
                            placeholder={t("fieldEmployeePlaceholder")}
                            disabled={isLoadingOptions}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldOtCase")}</span>
                        <SearchableSelect
                            options={otCaseOptions}
                            value={otCaseId}
                            onChange={setOtCaseId}
                            placeholder={t("fieldOtCasePlaceholder")}
                            disabled={isLoadingOptions}
                        />
                    </label>
                </div>

                <button
                    onClick={handleResolve}
                    disabled={!employeeId || !otCaseId || isResolving}
                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isResolving ? t("resolving") : t("resolveButton")}
                </button>
            </section>

            {result && (
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    {result.isComplete ? (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            {result.steps.length === 0 ? t("alreadyAtTerminalLevel") : t("chainComplete")}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#930006]">
                            <AlertTriangle className="h-4 w-4" />
                            {result.warning}
                        </div>
                    )}

                    {result.steps.length > 0 && (
                        <ol className="space-y-3">
                            {result.steps.map((step) => (
                                <li key={step.stepOrder} className="rounded-lg border border-[#e0e3e5] p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                                                {step.stepOrder}
                                            </span>
                                            <span className="text-sm font-semibold text-[#191c1e]">
                                                {step.jobTitleName}
                                            </span>
                                            <span className="text-xs text-[#8a8f94]">
                                                ({step.jobTitleCode}, cấp {step.rankOrder})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                                    step.requiresSignature
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                        : "border-[#e0e3e5] bg-white text-[#8a8f94]"
                                                }`}
                                            >
                                                {step.requiresSignature ? (
                                                    <Check size={12} />
                                                ) : (
                                                    <X size={12} />
                                                )}
                                                {step.requiresSignature
                                                    ? t("requiresSignatureYes")
                                                    : t("requiresSignatureNo")}
                                            </span>
                                            {step.isResponsible && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                                    <Star size={12} fill="currentColor" />
                                                    {t("isResponsibleYes")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ul className="mt-2 space-y-1">
                                        {step.candidates.map((candidate) => (
                                            <li
                                                key={candidate.employeeId}
                                                className="text-sm text-[#5e3f3a]"
                                            >
                                                {candidate.fullName} ({candidate.userName})
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            )}
        </div>
    );
});

export default ApprovalChainPreviewPanel;
