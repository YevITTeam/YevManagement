"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";

export interface DepartmentFormValues {
    departmentCode: string;
    departmentNameVn: string;
    departmentNameJp: string | null;
}

interface DepartmentFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: DepartmentDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: DepartmentFormValues) => void | Promise<void>;
}

const emptyValues: DepartmentFormValues = { departmentCode: "", departmentNameVn: "", departmentNameJp: null };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function DepartmentForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: DepartmentFormProps) {
    const t = useTranslations("Attendance.Department");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<DepartmentFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      departmentCode: current.departmentCode,
                      departmentNameVn: current.departmentNameVn,
                      departmentNameJp: current.departmentNameJp,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof DepartmentFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.departmentCode.trim() || !values.departmentNameVn.trim()) return;
        onSubmit({
            ...values,
            departmentNameJp: values.departmentNameJp?.trim() ? values.departmentNameJp.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="department-form-title"
                className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="department-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle") : t("editTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldCode")}<RequiredMark /></span>
                            <input
                                value={values.departmentCode}
                                onChange={(event) => handleChange("departmentCode", event.target.value)}
                                placeholder={t("fieldCodePlaceholder")}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldNameVn")}<RequiredMark /></span>
                            <input
                                value={values.departmentNameVn}
                                onChange={(event) => handleChange("departmentNameVn", event.target.value)}
                                placeholder={t("fieldNameVnPlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldNameJp")}</span>
                            <input
                                value={values.departmentNameJp ?? ""}
                                onChange={(event) => handleChange("departmentNameJp", event.target.value)}
                                placeholder={t("fieldNameJpPlaceholder")}
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
