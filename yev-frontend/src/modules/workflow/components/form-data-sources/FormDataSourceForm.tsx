"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormDataSourceDto } from "@/modules/workflow/types/form-data-source.dto";
import { DataSourceKind } from "@/modules/workflow/types/form-data-source.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface FormDataSourceFormValues {
    code: string;
    nameVn: string;
    nameJp: string | null;
    sourceKind: DataSourceKind;
    valueColumn: string;
    displayColumn: string;
    filterJson: string | null;
}

interface FormDataSourceFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: FormDataSourceDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: FormDataSourceFormValues) => void | Promise<void>;
}

const emptyValues: FormDataSourceFormValues = {
    code: "",
    nameVn: "",
    nameJp: "",
    sourceKind: DataSourceKind.Employees,
    valueColumn: "Id",
    displayColumn: "",
    filterJson: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function FormDataSourceForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: FormDataSourceFormProps) {
    const t = useTranslations("Workflow.FormDataSource");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<FormDataSourceFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      nameVn: current.nameVn,
                      nameJp: current.nameJp ?? "",
                      sourceKind: current.sourceKind,
                      valueColumn: current.valueColumn,
                      displayColumn: current.displayColumn,
                      filterJson: current.filterJson ?? "",
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.nameVn.trim() || !values.valueColumn.trim() || !values.displayColumn.trim()) return;
        onSubmit({
            ...values,
            nameJp: values.nameJp?.trim() ? values.nameJp.trim() : null,
            filterJson: values.filterJson?.trim() ? values.filterJson.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-data-source-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="form-data-source-form-title" className="text-lg font-semibold text-[#191c1e]">
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

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldSourceKind")}</span>
                        <select
                            value={values.sourceKind}
                            onChange={(event) => setValues((current) => ({ ...current, sourceKind: Number(event.target.value) as DataSourceKind }))}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        >
                            <option value={DataSourceKind.Employees}>{t("sourceKindEmployees")}</option>
                            <option value={DataSourceKind.OrgUnits}>{t("sourceKindOrgUnits")}</option>
                            <option value={DataSourceKind.JobTitles}>{t("sourceKindJobTitles")}</option>
                        </select>
                        <p className="mt-1 text-xs text-[#8a8f94]">{t("sourceKindSqlQueryNote")}</p>
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldValueColumn")}</span>
                        <input
                            value={values.valueColumn}
                            onChange={(event) => setValues((current) => ({ ...current, valueColumn: event.target.value }))}
                            placeholder={t("fieldValueColumnPlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldDisplayColumn")}</span>
                        <input
                            value={values.displayColumn}
                            onChange={(event) => setValues((current) => ({ ...current, displayColumn: event.target.value }))}
                            placeholder={t("fieldDisplayColumnPlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldFilterJson")}</span>
                        <input
                            value={values.filterJson ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, filterJson: event.target.value }))}
                            placeholder={t("fieldFilterJsonPlaceholder")}
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
