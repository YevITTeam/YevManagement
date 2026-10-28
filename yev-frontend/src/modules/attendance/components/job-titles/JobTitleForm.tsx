"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import { useEnumLabels } from "@/modules/attendance/lib/useEnumLabels";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { StyledSelect } from "@/components/ui/StyledSelect";
import JobTitlePermissionSection, { type JobTitlePermissionSectionHandle } from "./JobTitlePermissionSection";

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

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function JobTitleForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: JobTitleFormProps) {
    const t = useTranslations("Attendance.JobTitle");
    const tCommon = useTranslations("Common");
    const enumLabels = useEnumLabels();
    const [values, setValues] = useState<JobTitleFormValues>(emptyValues);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const permissionRef = useRef<JobTitlePermissionSectionHandle>(null);

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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.name.trim()) return;
        setIsSubmitting(true);
        try {
            // Permission mapping is a separate API; save it first so a failure keeps the dialog open.
            const permissionsSaved = (await permissionRef.current?.save()) ?? true;
            if (!permissionsSaved) return;
            await onSubmit(values);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEdit = mode === "edit" && !!initial;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && !isSubmitting && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="job-title-form-title"
                className={`z-60 mx-4 flex max-h-[88vh] w-full flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl ${
                    isEdit ? "max-w-3xl" : "max-w-md"
                }`}
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-5 py-3">
                    <h3 id="job-title-form-title" className="text-base font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle") : t("editTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && !isSubmitting && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-3">
                        <div className={isEdit ? "grid gap-3 sm:grid-cols-[1fr_1.6fr_1.2fr]" : "space-y-3"}>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldCode")}<RequiredMark /></span>
                                <input
                                    value={values.code}
                                    onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
                                    placeholder={t("fieldCodePlaceholder")}
                                    disabled={loading || isSubmitting}
                                    autoFocus
                                    required
                                    className={fieldClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldName")}<RequiredMark /></span>
                                <input
                                    value={values.name}
                                    onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                                    placeholder={t("fieldNamePlaceholder")}
                                    disabled={loading || isSubmitting}
                                    required
                                    className={fieldClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldTerminalLevel")}</span>
                                <StyledSelect
                                    value={values.terminalLevel}
                                    onChange={(level) => setValues((current) => ({ ...current, terminalLevel: level }))}
                                    disabled={loading || isSubmitting}
                                    triggerClassName={`${fieldClassName} pr-8`}
                                    options={terminalLevelOptions.map((level) => ({ value: level, label: enumLabels.terminalLevel[level] }))}
                                />
                            </label>
                        </div>

                        {isEdit && initial && <JobTitlePermissionSection ref={permissionRef} jobTitleId={initial.id} />}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-[#e0e3e5] px-5 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading || isSubmitting}
                            className="h-9 cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-4 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isSubmitting}
                            className="h-9 cursor-pointer rounded-md bg-[#e3000f] px-4 text-sm! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading || isSubmitting ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
