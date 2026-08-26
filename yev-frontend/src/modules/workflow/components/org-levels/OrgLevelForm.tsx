"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface OrgLevelFormValues {
    levelNumber: number;
    nameVn: string;
    nameJp: string | null;
}

interface OrgLevelFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: OrgLevelDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: OrgLevelFormValues) => void | Promise<void>;
}

const emptyValues: OrgLevelFormValues = { levelNumber: 1, nameVn: "", nameJp: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function OrgLevelForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: OrgLevelFormProps) {
    const t = useTranslations("Workflow.OrgLevel");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<OrgLevelFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? { levelNumber: current.levelNumber, nameVn: current.nameVn, nameJp: current.nameJp ?? "" }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.nameVn.trim()) return;
        onSubmit({ ...values, nameJp: values.nameJp?.trim() ? values.nameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="org-level-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="org-level-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                        <span className={fieldLabelClassName}>{t("fieldLevelNumber")}</span>
                        <input
                            type="number"
                            value={values.levelNumber}
                            onChange={(event) => setValues((current) => ({ ...current, levelNumber: Number(event.target.value) }))}
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldNameVn")}</span>
                        <input
                            value={values.nameVn}
                            onChange={(event) => setValues((current) => ({ ...current, nameVn: event.target.value }))}
                            placeholder={t("fieldNameVnPlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldNameJp")}</span>
                        <input
                            value={values.nameJp ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, nameJp: event.target.value }))}
                            placeholder={t("fieldNameJpPlaceholder")}
                            disabled={loading}
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
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
