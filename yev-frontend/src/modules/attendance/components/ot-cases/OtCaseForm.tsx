"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { approvalLevelLabels } from "@/modules/attendance/types/enums";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { StyledSelect } from "@/components/ui/StyledSelect";

export interface OtCaseFormValues {
    code: string;
    description: string | null;
    requireSignature: boolean;
    requiredApprovalLevel: number;
}

interface OtCaseFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: OtCaseDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: OtCaseFormValues) => void | Promise<void>;
}

// Chỉ 1/2/3 — 0=Submitter không dùng làm cấp cuối (docs/attendance-api-fe.md §3.4).
const approvalLevelOptions = [1, 2, 3];

const emptyValues: OtCaseFormValues = { code: "", description: null, requireSignature: false, requiredApprovalLevel: 1 };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function OtCaseForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: OtCaseFormProps) {
    const t = useTranslations("Attendance.OtCase");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<OtCaseFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      description: current.description,
                      requireSignature: current.requireSignature,
                      requiredApprovalLevel: current.requiredApprovalLevel,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.requiredApprovalLevel) return;
        onSubmit({ ...values, description: values.description?.trim() ? values.description.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ot-case-form-title"
                className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="ot-case-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                                value={values.code}
                                onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
                                placeholder={t("fieldCodePlaceholder")}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDescription")}</span>
                            <input
                                value={values.description ?? ""}
                                onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                                placeholder={t("fieldDescriptionPlaceholder")}
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldRequiredLevel")}<RequiredMark /></span>
                            <StyledSelect
                                value={values.requiredApprovalLevel}
                                onChange={(level) => setValues((current) => ({ ...current, requiredApprovalLevel: level }))}
                                disabled={loading}
                                triggerClassName={`${fieldClassName} pr-9`}
                                options={approvalLevelOptions.map((level) => ({ value: level, label: approvalLevelLabels[level] }))}
                            />
                        </label>
                    </div>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={values.requireSignature}
                            onChange={(event) => setValues((current) => ({ ...current, requireSignature: event.target.checked }))}
                            disabled={loading}
                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                        <span className="text-sm text-[#191c1e]">{t("fieldRequireSignature")}</span>
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
