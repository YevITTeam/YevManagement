"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApprovalDelegationDto } from "@/modules/attendance/types/approval-delegation.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface ApprovalDelegationFormValues {
    delegateEmployeeId: number | "";
    fromDate: string;
    toDate: string;
    reason: string;
}

interface ApprovalDelegationFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: ApprovalDelegationDto | null;
    employeeOptions: SelectOption[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: ApprovalDelegationFormValues) => void | Promise<void>;
}

const emptyValues: ApprovalDelegationFormValues = { delegateEmployeeId: "", fromDate: "", toDate: "", reason: "" };

const fieldLabelClassName = "mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const dateFieldClassName = fieldClassName.replace("w-full", "w-40");

export default function ApprovalDelegationForm({ isOpen, mode, initial, employeeOptions, loading = false, onClose, onSubmit }: ApprovalDelegationFormProps) {
    const t = useTranslations("Attendance.ApprovalDelegation");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<ApprovalDelegationFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? { delegateEmployeeId: current.delegateEmployeeId, fromDate: current.fromDate, toDate: current.toDate, reason: current.reason ?? "" }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (values.delegateEmployeeId === "" || !values.fromDate || !values.toDate) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">{mode === "create" ? t("add") : t("edit")}</h3>
                    <button onClick={onClose} className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]" aria-label={tCommon("close")}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("delegateLabel")}</span>
                        <SearchableSelect
                            options={employeeOptions}
                            value={values.delegateEmployeeId}
                            onChange={(v) => setValues((c) => ({ ...c, delegateEmployeeId: v }))}
                            placeholder={t("selectPlaceholder")}
                        />
                    </label>

                    <div>
                        <span className={fieldLabelClassName}>{t("periodLabel")}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <input
                                type="date"
                                required
                                aria-label={t("fromLabel")}
                                value={values.fromDate}
                                onChange={(e) => setValues((c) => ({ ...c, fromDate: e.target.value }))}
                                className={dateFieldClassName}
                            />
                            <span className="text-xs text-[#8a8f94]">&ndash;</span>
                            <input
                                type="date"
                                required
                                aria-label={t("toLabel")}
                                min={values.fromDate || undefined}
                                value={values.toDate}
                                onChange={(e) => setValues((c) => ({ ...c, toDate: e.target.value }))}
                                className={dateFieldClassName}
                            />
                        </div>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("reasonLabel")}</span>
                        <input
                            maxLength={500}
                            value={values.reason}
                            onChange={(e) => setValues((c) => ({ ...c, reason: e.target.value }))}
                            className={fieldClassName}
                        />
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
                            {loading ? tCommon("processing") : tCommon("save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
