"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Check, Plus, Star, Trash2, X } from "lucide-react";

import { DepartmentApprovalStepApi } from "@/modules/attendance/api/department-approval-step.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import type { DepartmentApprovalStepDto } from "@/modules/attendance/types/department-approval-step.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Tab "Cây duyệt Phòng ban" — cấu hình tay danh sách Chức vụ (theo thứ tự) là bước duyệt thật của
// TỪNG Phòng ban (2026-08-06, thay cho suy luận tự động qua RankOrder — xem
// docs/docs-be/attendance-module.md §Cây chức vụ). Không phải màn CRUD chuẩn nên implement ListHandle
// tối giản (openCreate no-op), cùng khuôn AttendanceSettingPanel/ApprovalChainPreviewPanel.
const DepartmentApprovalStepManager = forwardRef<ListHandle, ListToolbarProps>(function DepartmentApprovalStepManager(
    { onLoadingChange },
    ref
) {
    const t = useTranslations("Attendance.DepartmentApprovalStep");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [steps, setSteps] = useState<DepartmentApprovalStepDto[]>([]);
    const [addingJobTitleId, setAddingJobTitleId] = useState<number | "">("");
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isLoadingSteps, setIsLoadingSteps] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setIsLoadingOptions(true);
        Promise.all([DepartmentApi.getAllDepartments(), JobTitleApi.getAllJobTitles()])
            .then(([departmentData, jobTitleData]) => {
                setDepartments(departmentData);
                setJobTitles(jobTitleData);
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

    const fetchSteps = (targetDepartmentId: number) => {
        setIsLoadingSteps(true);
        DepartmentApprovalStepApi.getByDepartment(targetDepartmentId)
            .then((data) => {
                setSteps(data);
                setIsDirty(false);
            })
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, t("loadStepsError")));
            })
            .finally(() => setIsLoadingSteps(false));
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (typeof departmentId === "number") fetchSteps(departmentId);
        },
        openCreate: () => {},
    }));

    const handleSelectDepartment = (value: string) => {
        const nextId = value ? Number(value) : "";
        setDepartmentId(nextId);
        setSteps([]);
        setAddingJobTitleId("");
        setIsDirty(false);
        if (typeof nextId === "number") fetchSteps(nextId);
    };

    const usedJobTitleIds = new Set(steps.map((s) => s.jobTitleId));
    const availableJobTitles = jobTitles.filter((jt) => !usedJobTitleIds.has(jt.id));

    const handleAddStep = () => {
        if (!addingJobTitleId) return;
        const jobTitle = jobTitles.find((jt) => jt.id === addingJobTitleId);
        if (!jobTitle) return;
        setSteps((current) => [
            ...current,
            {
                id: 0,
                departmentId: typeof departmentId === "number" ? departmentId : 0,
                stepOrder: current.length + 1,
                jobTitleId: jobTitle.id,
                jobTitleCode: jobTitle.code,
                jobTitleName: jobTitle.name,
                rankOrder: jobTitle.rankOrder,
                requiresSignature: false,
                isResponsible: false,
                terminalLevel: jobTitle.terminalLevel,
            },
        ]);
        setAddingJobTitleId("");
        setIsDirty(true);
    };

    const handleRemoveStep = (index: number) => {
        setSteps((current) => current.filter((_, i) => i !== index));
        setIsDirty(true);
    };

    const handleToggleSignature = (index: number) => {
        setSteps((current) =>
            current.map((step, i) => (i === index ? { ...step, requiresSignature: !step.requiresSignature } : step))
        );
        setIsDirty(true);
    };

    // Chỉ 1 bước/Phòng ban được đánh dấu "chịu trách nhiệm" — bấm lại bước đang đánh dấu để bỏ chọn,
    // bấm bước khác để chuyển đánh dấu sang bước đó (khớp validate "tối đa 1" ở BE).
    const handleSetResponsible = (index: number) => {
        setSteps((current) =>
            current.map((step, i) => ({ ...step, isResponsible: i === index ? !current[index].isResponsible : false }))
        );
        setIsDirty(true);
    };

    const handleMoveStep = (index: number, direction: -1 | 1) => {
        setSteps((current) => {
            const target = index + direction;
            if (target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (typeof departmentId !== "number") return;
        setIsSaving(true);
        try {
            const data = await DepartmentApprovalStepApi.replaceByDepartment(
                departmentId,
                steps.map((s) => ({ jobTitleId: s.jobTitleId, requiresSignature: s.requiresSignature, isResponsible: s.isResponsible }))
            );
            setSteps(data);
            setIsDirty(false);
            toast.success(t("saveSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <p className="text-sm text-[#5e3f3a]">{t("description")}</p>

                <label className="block max-w-sm">
                    <span className={fieldLabelClassName}>{t("fieldDepartment")}</span>
                    <select
                        value={departmentId}
                        onChange={(event) => handleSelectDepartment(event.target.value)}
                        disabled={isLoadingOptions}
                        className={fieldClassName}
                    >
                        <option value="">{t("fieldDepartmentPlaceholder")}</option>
                        {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                                {department.departmentNameVn}
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            {typeof departmentId === "number" && (
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    {isLoadingSteps ? (
                        <p className="text-sm text-[#5e3f3a]">{t("loadingSteps")}</p>
                    ) : (
                        <>
                            {steps.length === 0 && <p className="text-sm text-[#5e3f3a]">{t("noSteps")}</p>}

                            {steps.length > 0 && (
                                <ol className="space-y-2">
                                    {steps.map((step, index) => (
                                        <li
                                            key={`${step.jobTitleId}-${index}`}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e0e3e5] p-3"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                                                    {index + 1}
                                                </span>
                                                <span className="text-sm font-semibold text-[#191c1e]">{step.jobTitleName}</span>
                                                <span className="text-xs text-[#8a8f94]">({step.jobTitleCode}, cấp {step.rankOrder})</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSignature(index)}
                                                    title={t("toggleSignatureHint")}
                                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                        step.requiresSignature
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                            : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                    }`}
                                                >
                                                    {step.requiresSignature ? <Check size={11} /> : <X size={11} />}
                                                    {step.requiresSignature ? t("requiresSignatureYes") : t("requiresSignatureNo")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetResponsible(index)}
                                                    title={t("toggleResponsibleHint")}
                                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                        step.isResponsible
                                                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                            : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                    }`}
                                                >
                                                    <Star size={11} fill={step.isResponsible ? "currentColor" : "none"} />
                                                    {step.isResponsible ? t("isResponsibleYes") : t("isResponsibleNo")}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveStep(index, -1)}
                                                    disabled={index === 0}
                                                    title={t("moveUp")}
                                                    aria-label={t("moveUp")}
                                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white p-1.5 text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveStep(index, 1)}
                                                    disabled={index === steps.length - 1}
                                                    title={t("moveDown")}
                                                    aria-label={t("moveDown")}
                                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white p-1.5 text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveStep(index)}
                                                    title={t("removeStep")}
                                                    aria-label={t("removeStep")}
                                                    className="cursor-pointer rounded-lg border border-[#e9bcb6] bg-white p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-4">
                                <select
                                    value={addingJobTitleId}
                                    onChange={(event) => setAddingJobTitleId(event.target.value ? Number(event.target.value) : "")}
                                    className="h-10 flex-1 min-w-[220px] rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                >
                                    <option value="">{t("fieldAddJobTitlePlaceholder")}</option>
                                    {availableJobTitles.map((jobTitle) => (
                                        <option key={jobTitle.id} value={jobTitle.id}>
                                            {jobTitle.name} ({jobTitle.code}, cấp {jobTitle.rankOrder})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleAddStep}
                                    disabled={!addingJobTitleId}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-3.5 w-3.5" /> {t("addStepButton")}
                                </button>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!isDirty || isSaving}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSaving ? t("saving") : t("saveButton")}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}
        </div>
    );
});

export default DepartmentApprovalStepManager;
