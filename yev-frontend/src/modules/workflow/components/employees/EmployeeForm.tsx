"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EmployeeDto } from "@/modules/workflow/types/employee.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

export interface EmployeeFormValues {
    employeeCode: string;
    fullName: string;
    fullNameJp: string | null;
    email: string | null;
    position: string | null;
    userId: number | null;
    isActive: boolean;
}

interface EmployeeFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: EmployeeDto | null;
    loading?: boolean;
    userOptions: SelectOption[];
    isLoadingUsers?: boolean;
    onClose: () => void;
    onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
}

const emptyValues: EmployeeFormValues = {
    employeeCode: "",
    fullName: "",
    fullNameJp: "",
    email: "",
    position: "",
    userId: null,
    isActive: true,
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function EmployeeForm({
    isOpen,
    mode,
    initial,
    loading = false,
    userOptions,
    isLoadingUsers = false,
    onClose,
    onSubmit,
}: EmployeeFormProps) {
    const t = useTranslations("Workflow.Employee");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<EmployeeFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      employeeCode: current.employeeCode,
                      fullName: current.fullName,
                      fullNameJp: current.fullNameJp ?? "",
                      email: current.email ?? "",
                      position: current.position ?? "",
                      userId: current.userId,
                      isActive: current.isActive,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.employeeCode.trim() || !values.fullName.trim()) return;
        onSubmit({
            ...values,
            fullNameJp: values.fullNameJp?.trim() ? values.fullNameJp.trim() : null,
            email: values.email?.trim() ? values.email.trim() : null,
            position: values.position?.trim() ? values.position.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="employee-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="employee-form-title" className="text-lg font-semibold text-[#191c1e]">
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

                <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldEmployeeCode")}</span>
                        <input
                            value={values.employeeCode}
                            onChange={(event) => setValues((current) => ({ ...current, employeeCode: event.target.value }))}
                            placeholder={t("fieldEmployeeCodePlaceholder")}
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldFullName")}</span>
                        <input
                            value={values.fullName}
                            onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))}
                            placeholder={t("fieldFullNamePlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldFullNameJp")}</span>
                        <input
                            value={values.fullNameJp ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, fullNameJp: event.target.value }))}
                            disabled={loading}
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldEmail")}</span>
                        <input
                            type="email"
                            value={values.email ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                            disabled={loading}
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldPosition")}</span>
                        <input
                            value={values.position ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, position: event.target.value }))}
                            placeholder={t("fieldPositionPlaceholder")}
                            disabled={loading}
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldUserId")}</span>
                        <SearchableSelect
                            options={userOptions}
                            value={values.userId ?? ""}
                            onChange={(v) => setValues((current) => ({ ...current, userId: v === "" ? null : v }))}
                            placeholder={isLoadingUsers ? tCommon("loading") : t("fieldUserIdPlaceholder")}
                            disabled={loading || isLoadingUsers}
                        />
                        <span className="mt-1 block text-xs text-[#8a8f94]">{t("fieldUserIdHint")}</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={values.isActive}
                            onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))}
                            disabled={loading}
                            className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                        />
                        <span className="text-sm text-[#191c1e]">{t("fieldIsActive")}</span>
                    </label>

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
