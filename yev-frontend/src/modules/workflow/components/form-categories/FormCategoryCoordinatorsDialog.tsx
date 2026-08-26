"use client";

import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { FormCategoryApi } from "@/modules/workflow/api/form-category.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import type { FormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface FormCategoryCoordinatorsDialogProps {
    formCategory: FormCategoryDto;
    onClose: () => void;
}

interface EmployeeOption {
    id: number;
    employeeCode: string;
    fullName: string;
}

// Thay NGUYÊN danh sách người phụ trách thiết kế của 1 FormCategory — mirror pattern
// PUT /Workflow/FormCategory/{id}/coordinators (workflow-module.md §3.2): tick chọn xong bấm Lưu là
// gửi lại toàn bộ mảng EmployeeId, không có Create/Update/Delete từng dòng.
export default function FormCategoryCoordinatorsDialog({ formCategory, onClose }: FormCategoryCoordinatorsDialogProps) {
    const t = useTranslations("Workflow.FormCategory");
    const tCommon = useTranslations("Common");

    const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [keyword, setKeyword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [coordinators, employees] = await Promise.all([
                FormCategoryApi.getCoordinators(formCategory.id),
                // Employee module chưa có endpoint "all" phẳng (chỉ grid-list) — lấy 1 trang lớn đủ
                // dùng cho danh sách chọn của 1 màn cấu hình admin, không cần phân trang thật ở đây.
                EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
            ]);
            return { coordinators, employees: employees.data };
        },
        [formCategory.id],
        (result) => {
            setSelectedIds(new Set(result.coordinators.map((x) => x.employeeId)));
            setAllEmployees(
                result.employees
                    .filter((x) => x.isActive)
                    .map((x) => ({ id: x.id, employeeCode: x.employeeCode, fullName: x.fullName }))
            );
        },
        t("coordinatorsLoadError"),
        (message) => toast.error(message)
    );

    const filteredEmployees = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return allEmployees;
        return allEmployees.filter((x) => `${x.employeeCode} ${x.fullName}`.toLowerCase().includes(q));
    }, [allEmployees, keyword]);

    const toggle = (id: number) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await FormCategoryApi.replaceCoordinators(formCategory.id, Array.from(selectedIds));
            toast.success(t("coordinatorsSaveSuccess"));
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("coordinatorsSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-category-coordinators-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <div>
                        <h3 id="form-category-coordinators-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("coordinatorsTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-[#5e3f3a]">{formCategory.nameVn}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSaving && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="py-10 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : error ? (
                    <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                ) : (
                    <>
                        <div className="relative mb-3">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8f94]" />
                            <input
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                                placeholder={t("coordinatorsSearchPlaceholder")}
                                className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            />
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#e0e3e5]">
                            {filteredEmployees.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-[#5e3f3a]">{t("coordinatorsNoData")}</div>
                            ) : (
                                filteredEmployees.map((employee) => (
                                    <label
                                        key={employee.id}
                                        className="flex cursor-pointer items-center gap-3 border-b border-[#f1f5f9] px-4 py-2.5 text-sm last:border-b-0 hover:bg-[#f8fafc]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(employee.id)}
                                            onChange={() => toggle(employee.id)}
                                            disabled={isSaving}
                                            className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                                        />
                                        <span className="text-[#191c1e]">{employee.fullName}</span>
                                        <span className="text-xs text-[#8a8f94]">({employee.employeeCode})</span>
                                    </label>
                                ))
                            )}
                        </div>

                        <p className="mt-3 text-xs text-[#5e3f3a]">{t("coordinatorsSelectedCount", { count: selectedIds.size })}</p>

                        <div className="mt-4 flex justify-end gap-3 border-t border-[#e0e3e5] pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {tCommon("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? tCommon("processing") : tCommon("save")}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
