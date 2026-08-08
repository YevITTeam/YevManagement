"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Check, Plus, Star, Trash2, X } from "lucide-react";

import { DepartmentApprovalStepApi } from "@/modules/attendance/api/department-approval-step.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { DepartmentApprovalStepDto } from "@/modules/attendance/types/department-approval-step.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";

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

    // Nhân viên trong Phòng ban đang chọn — dùng để (a) hiện ai đang giữ mỗi Chức vụ ngay dưới từng
    // bước, (b) gán nhanh Chức vụ ngay tại màn này thay vì phải sang riêng màn "Nhân viên".
    const [departmentEmployees, setDepartmentEmployees] = useState<EmployeeDto[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [assigningEmployeeId, setAssigningEmployeeId] = useState<number | null>(null);
    // Lựa chọn đang gõ dở ở ô "+ Thêm người giữ" của từng bước, key = jobTitleId — reset về "" ngay
    // sau khi gán thành công để ô luôn sẵn sàng chọn tiếp người khác.
    const [addingHolderByJobTitle, setAddingHolderByJobTitle] = useState<Record<number, number | "">>({});

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

    const fetchDepartmentEmployees = (targetDepartmentId: number) => {
        setIsLoadingEmployees(true);
        EmployeeApi.getEmployeesByDepartment(targetDepartmentId)
            .then((data) => setDepartmentEmployees(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, t("loadEmployeesError")));
            })
            .finally(() => setIsLoadingEmployees(false));
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (typeof departmentId === "number") {
                fetchSteps(departmentId);
                fetchDepartmentEmployees(departmentId);
            }
        },
        openCreate: () => {},
    }));

    const handleSelectDepartment = (value: string) => {
        const nextId = value ? Number(value) : "";
        setDepartmentId(nextId);
        setSteps([]);
        setDepartmentEmployees([]);
        setAddingJobTitleId("");
        setIsDirty(false);
        if (typeof nextId === "number") {
            fetchSteps(nextId);
            fetchDepartmentEmployees(nextId);
        }
    };

    // Gán nhanh Chức vụ ngay tại màn này (docs §Cây chức vụ) — dùng lại PUT /api/Employee/{id} hiện có.
    // 2026-08-08: tự tính lại groupId/departmentId theo TerminalLevel của Chức vụ MỚI (không còn
    // pass-through nguyên giá trị cũ) — nếu không, gán 1 người đang có Bộ phận thật sang Trưởng phòng/
    // Trưởng Xưởng/Giám đốc (hoặc ngược lại) sẽ luôn bị BE từ chối 400 vì lẫn field tổ chức cũ.
    const handleAssignJobTitle = async (employee: EmployeeDto, jobTitleId: number | "") => {
        const nextJobTitleId = jobTitleId === "" ? null : jobTitleId;
        const nextJobTitle = jobTitles.find((jt) => jt.id === nextJobTitleId);
        const nextTerminalLevel = nextJobTitle?.terminalLevel ?? 0;

        let nextGroupId = employee.groupId;
        let nextDepartmentId = employee.departmentId;

        if (nextTerminalLevel === 1) {
            // DepartmentManager (Trưởng phòng) — gán đúng Phòng ban đang xem trên màn này, không thuộc Bộ phận nào.
            nextGroupId = null;
            nextDepartmentId = typeof departmentId === "number" ? departmentId : null;
        } else if (nextTerminalLevel === 2 || nextTerminalLevel === 3) {
            // WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc) — dùng chung toàn công ty.
            nextGroupId = null;
            nextDepartmentId = null;
        } else if (employee.groupId === null) {
            // Đang là Trưởng phòng/Trưởng Xưởng/Giám đốc (không có Bộ phận thật), muốn chuyển về Chức vụ
            // thường/bỏ hẳn Chức vụ — màn này không đủ thông tin để tự chọn đúng Bộ phận, phải sửa qua
            // form Nhân viên đầy đủ.
            toast.error(t("assignNeedsGroupError"));
            return;
        }

        setAssigningEmployeeId(employee.id);
        try {
            await EmployeeApi.updateEmployee(employee.id, {
                code: employee.code,
                firstName: employee.firstName,
                lastName: employee.lastName,
                userName: employee.userName,
                monthToDate: employee.monthToDate,
                yearToDate: employee.yearToDate,
                groupId: nextGroupId,
                departmentId: nextDepartmentId,
                jobTitleId: nextJobTitleId,
            });
            setDepartmentEmployees((current) =>
                current.map((e) =>
                    e.id === employee.id
                        ? { ...e, jobTitleId: nextJobTitleId, jobTitleName: nextJobTitle?.name ?? null, groupId: nextGroupId, departmentId: nextDepartmentId }
                        : e
                )
            );
            toast.success(t("assignSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("assignError")));
        } finally {
            setAssigningEmployeeId(null);
        }
    };

    // Ô "+ Thêm người giữ" ngay dưới mỗi bước — chọn 1 nhân viên trong Phòng ban (kể cả đang giữ Chức
    // vụ khác) để gán luôn Chức vụ của bước này, không cần mở bảng riêng.
    const handlePickHolder = async (jobTitleId: number, employeeId: number | "") => {
        setAddingHolderByJobTitle((current) => ({ ...current, [jobTitleId]: employeeId }));
        if (employeeId === "") return;
        const employee = departmentEmployees.find((e) => e.id === employeeId);
        if (!employee) return;
        await handleAssignJobTitle(employee, jobTitleId);
        setAddingHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
    };

    // Options cho SearchableSelect của ô "+ Thêm người giữ" — loại người đã giữ đúng Chức vụ này,
    // tìm được theo tên/mã NV/chức vụ hiện tại (đỡ phải cuộn danh sách dài khi Phòng ban đông người).
    const buildHolderOptions = (jobTitleId: number): SelectOption[] =>
        departmentEmployees
            .filter((e) => e.jobTitleId !== jobTitleId)
            .map((e) => ({
                value: e.id,
                label: `${e.lastName} ${e.firstName} (${e.code})${e.jobTitleName ? ` — ${e.jobTitleName}` : ""}`,
                searchText: [e.lastName, e.firstName, `${e.firstName} ${e.lastName}`, e.code, e.jobTitleName ?? ""]
                    .join(" ")
                    .toLowerCase(),
            }));

    const usedJobTitleIds = new Set(steps.map((s) => s.jobTitleId));
    // Tối đa 2 bước "trung gian" (terminalLevel=0, dưới cấp Trưởng phòng) — khớp đúng 2 ô "Người đề
    // nghị" cố định trên giấy in YEV-22-024 (2026-08-08, Giai đoạn 3.2, xem OtFormPrintView.tsx và
    // validate BE ở DepartmentApprovalStepService.ReplaceAsync). 3 Chức vụ cấp cuối (Trưởng phòng/
    // Trưởng xưởng/Tổng Giám Đốc, terminalLevel>0) không bị giới hạn này.
    const intermediateStepCount = steps.filter((s) => s.terminalLevel === 0).length;
    const intermediateLimitReached = intermediateStepCount >= 2;
    const availableJobTitles = jobTitles.filter(
        (jt) => !usedJobTitleIds.has(jt.id) && !(intermediateLimitReached && jt.terminalLevel === 0)
    );

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
                                            className="space-y-2 rounded-lg border border-[#e0e3e5] p-3"
                                        >
                                        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                                            <div className="flex w-[230px] shrink-0 items-center gap-2" title={`${step.jobTitleName} (${step.jobTitleCode}, cấp ${step.rankOrder})`}>
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                                                    {index + 1}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191c1e]">{step.jobTitleName}</span>
                                                <span className="shrink-0 whitespace-nowrap text-xs text-[#8a8f94]">({step.jobTitleCode}, cấp {step.rankOrder})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSignature(index)}
                                                title={t("toggleSignatureHint")}
                                                className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
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
                                                className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                    step.isResponsible
                                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                        : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                }`}
                                            >
                                                <Star size={11} fill={step.isResponsible ? "currentColor" : "none"} />
                                                {step.isResponsible ? t("isResponsibleYes") : t("isResponsibleNo")}
                                            </button>
                                            <div className="ml-auto flex shrink-0 items-center gap-1">
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
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5 pl-8">
                                            <span className="text-xs font-semibold text-[#8a8f94]">{t("holdersLabel")}</span>
                                            {isLoadingEmployees ? (
                                                <span className="text-xs text-[#8a8f94]">{t("loadingEmployees")}</span>
                                            ) : (
                                                <>
                                                    {(() => {
                                                        const holders = departmentEmployees.filter((e) => e.jobTitleId === step.jobTitleId);
                                                        return holders.length === 0 ? (
                                                            <span className="text-xs italic text-[#8a8f94]">{t("noHolders")}</span>
                                                        ) : (
                                                            holders.map((holder) => (
                                                                <span
                                                                    key={holder.id}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                                                                >
                                                                    {holder.lastName} {holder.firstName} ({holder.code})
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAssignJobTitle(holder, "")}
                                                                        disabled={assigningEmployeeId === holder.id}
                                                                        title={t("removeHolderHint")}
                                                                        aria-label={t("removeHolderHint")}
                                                                        className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                                                    >
                                                                        <X size={10} />
                                                                    </button>
                                                                </span>
                                                            ))
                                                        );
                                                    })()}
                                                    <div className="w-56 shrink-0">
                                                        <SearchableSelect
                                                            options={buildHolderOptions(step.jobTitleId)}
                                                            value={addingHolderByJobTitle[step.jobTitleId] ?? ""}
                                                            onChange={(v) => handlePickHolder(step.jobTitleId, v)}
                                                            placeholder={t("addHolderPlaceholder")}
                                                            disabled={assigningEmployeeId !== null}
                                                            triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                                                        />
                                                    </div>
                                                </>
                                            )}
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
                            {intermediateLimitReached && <p className="text-xs text-[#9a5b00]">{t("intermediateLimitHint")}</p>}

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
