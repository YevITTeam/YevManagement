"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import { jobTitleTerminalLevelLabels } from "@/modules/attendance/types/enums";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface JobTitleFormValues {
    code: string;
    name: string;
    terminalLevel: number;
}

interface JobTitleFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: JobTitleDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: JobTitleFormValues) => void | Promise<void>;
}

const terminalLevelOptions = [0, 1, 2, 3];

const emptyValues: JobTitleFormValues = { code: "", name: "", terminalLevel: 0 };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function JobTitleForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: JobTitleFormProps) {
    const t = useTranslations("Attendance.JobTitle");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<JobTitleFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      name: current.name,
                      terminalLevel: current.terminalLevel,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.name.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="job-title-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="job-title-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldCode")}</span>
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
                        <span className={fieldLabelClassName}>{t("fieldName")}</span>
                        <input
                            value={values.name}
                            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                            placeholder={t("fieldNamePlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    {mode === "create" && (
                        <p className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                            {t("rankOrderAutoAppendHint")}
                        </p>
                    )}

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldTerminalLevel")}</span>
                        <select
                            value={values.terminalLevel}
                            onChange={(event) => setValues((current) => ({ ...current, terminalLevel: Number(event.target.value) }))}
                            disabled={loading}
                            className={fieldClassName}
                        >
                            {terminalLevelOptions.map((level) => (
                                <option key={level} value={level}>
                                    {jobTitleTerminalLevelLabels[level]}
                                </option>
                            ))}
                        </select>
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
