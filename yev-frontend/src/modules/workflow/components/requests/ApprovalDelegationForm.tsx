"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApprovalDelegationDto } from "@/modules/workflow/types/approval-delegation.dto";
import type { AvailableFormDto } from "@/modules/workflow/types/workflow-request.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface ApprovalDelegationFormValues {
    delegateEmployeeId: number | "";
    formDefinitionId: number | "";
    fromDate: string;
    toDate: string;
    reason: string;
}

interface ApprovalDelegationFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: ApprovalDelegationDto | null;
    employeeOptions: SelectOption[];
    forms: AvailableFormDto[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: ApprovalDelegationFormValues) => void | Promise<void>;
}

const emptyValues: ApprovalDelegationFormValues = { delegateEmployeeId: "", formDefinitionId: "", fromDate: "", toDate: "", reason: "" };

function toDateInputValue(iso: string): string {
    return iso.slice(0, 10);
}

const fieldLabelClassName = "mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]";
const fieldClassName = "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

export default function ApprovalDelegationForm({ isOpen, mode, initial, employeeOptions, forms, loading = false, onClose, onSubmit }: ApprovalDelegationFormProps) {
    const t = useTranslations("Workflow.WorkflowRequest");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<ApprovalDelegationFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      delegateEmployeeId: current.delegateEmployeeId,
                      formDefinitionId: current.formDefinitionId ?? "",
                      fromDate: toDateInputValue(current.fromDate),
                      toDate: toDateInputValue(current.toDate),
                      reason: current.reason ?? "",
                  }
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
                    <h3 className="text-lg font-semibold text-[#191c1e]">{mode === "create" ? t("addDelegation") : t("editDelegation")}</h3>
                    <button onClick={onClose} className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]" aria-label={tCommon("close")}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("delegateEmployeeLabel")}</span>
                        <SearchableSelect
                            options={employeeOptions}
                            value={values.delegateEmployeeId}
                            onChange={(v) => setValues((c) => ({ ...c, delegateEmployeeId: v }))}
                            placeholder={t("selectPlaceholder")}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("delegationFormLabel")}</span>
                        <select
                            value={values.formDefinitionId}
                            onChange={(e) => setValues((c) => ({ ...c, formDefinitionId: e.target.value === "" ? "" : Number(e.target.value) }))}
                            className={fieldClassName}
                        >
                            <option value="">{t("allFormTypes")}</option>
                            {forms.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.nameVn}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fromDateLabel")}</span>
                            <input
                                type="date"
                                required
                                value={values.fromDate}
                                onChange={(e) => setValues((c) => ({ ...c, fromDate: e.target.value }))}
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("toDateLabel")}</span>
                            <input
                                type="date"
                                required
                                value={values.toDate}
                                onChange={(e) => setValues((c) => ({ ...c, toDate: e.target.value }))}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("reasonLabel")}</span>
                        <input value={values.reason} onChange={(e) => setValues((c) => ({ ...c, reason: e.target.value }))} className={fieldClassName} />
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
