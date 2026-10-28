"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";

export interface WorkshopFormValues {
    workshopCode: string;
    workshopNameVn: string;
    workshopNameJp: string | null;
}

interface WorkshopFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: WorkshopDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: WorkshopFormValues) => void | Promise<void>;
}

const emptyValues: WorkshopFormValues = { workshopCode: "", workshopNameVn: "", workshopNameJp: null };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function WorkshopForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: WorkshopFormProps) {
    const t = useTranslations("Attendance.Workshop");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<WorkshopFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      workshopCode: current.workshopCode,
                      workshopNameVn: current.workshopNameVn,
                      workshopNameJp: current.workshopNameJp,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof WorkshopFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.workshopCode.trim() || !values.workshopNameVn.trim()) return;
        onSubmit({
            ...values,
            workshopNameJp: values.workshopNameJp?.trim() ? values.workshopNameJp.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="workshop-form-title"
                className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="workshop-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                                value={values.workshopCode}
                                onChange={(event) => handleChange("workshopCode", event.target.value)}
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
                                value={values.workshopNameVn}
                                onChange={(event) => handleChange("workshopNameVn", event.target.value)}
                                placeholder={t("fieldNameVnPlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldNameJp")}</span>
                            <input
                                value={values.workshopNameJp ?? ""}
                                onChange={(event) => handleChange("workshopNameJp", event.target.value)}
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
