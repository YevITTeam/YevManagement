"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormDefinitionDto } from "@/modules/workflow/types/form-definition.dto";
import { RouteConditionType } from "@/modules/workflow/types/form-definition.dto";
import type { FormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

// routeConditionType nằm trong values để dựng UI (hiện/ẩn 2 ô field key) và để Create gửi lên — nhưng
// Update KHÔNG gửi field này, vì bất biến sau khi tạo (workflow-module.md §3.2). List component tự
// lược field này ra khi gọi updateFormDefinition.
export interface FormDefinitionFormValues {
    code: string;
    nameVn: string;
    nameJp: string | null;
    formCategoryId: number;
    description: string | null;
    allowAttachment: boolean;
    requireAttachment: boolean;
    codePrefix: string;
    routeConditionType: RouteConditionType;
    routeNumericFieldKey: string | null;
    routeClassFieldKey: string | null;
}

interface FormDefinitionFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: FormDefinitionDto | null;
    formCategories: FormCategoryDto[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: FormDefinitionFormValues) => void | Promise<void>;
}

const emptyValues: FormDefinitionFormValues = {
    code: "",
    nameVn: "",
    nameJp: "",
    formCategoryId: 0,
    description: "",
    allowAttachment: false,
    requireAttachment: false,
    codePrefix: "",
    routeConditionType: RouteConditionType.None,
    routeNumericFieldKey: "",
    routeClassFieldKey: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function FormDefinitionForm({ isOpen, mode, initial, formCategories, loading = false, onClose, onSubmit }: FormDefinitionFormProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<FormDefinitionFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      nameVn: current.nameVn,
                      nameJp: current.nameJp ?? "",
                      formCategoryId: current.formCategoryId,
                      description: current.description ?? "",
                      allowAttachment: current.allowAttachment,
                      requireAttachment: current.requireAttachment,
                      codePrefix: current.codePrefix,
                      routeConditionType: current.routeConditionType,
                      routeNumericFieldKey: current.routeNumericFieldKey ?? "",
                      routeClassFieldKey: current.routeClassFieldKey ?? "",
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const formCategoryOptions: SelectOption[] = formCategories.map((c) => ({
        value: c.id,
        label: `${c.code} · ${c.nameVn}`,
        searchText: `${c.code} ${c.nameVn}`.toLowerCase(),
    }));

    const needsNumericKey = values.routeConditionType === RouteConditionType.NumericRange || values.routeConditionType === RouteConditionType.Both;
    const needsClassKey = values.routeConditionType === RouteConditionType.ClassValue || values.routeConditionType === RouteConditionType.Both;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.nameVn.trim() || !values.codePrefix.trim() || !values.formCategoryId) return;
        if (needsNumericKey && !values.routeNumericFieldKey?.trim()) return;
        if (needsClassKey && !values.routeClassFieldKey?.trim()) return;

        onSubmit({
            ...values,
            nameJp: values.nameJp?.trim() ? values.nameJp.trim() : null,
            description: values.description?.trim() ? values.description.trim() : null,
            routeNumericFieldKey: values.routeNumericFieldKey?.trim() ? values.routeNumericFieldKey.trim() : null,
            routeClassFieldKey: values.routeClassFieldKey?.trim() ? values.routeClassFieldKey.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-definition-form-title"
                className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="form-definition-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                    <div className="grid grid-cols-2 gap-4">
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
                            <span className={fieldLabelClassName}>{t("fieldCodePrefix")}</span>
                            <input
                                value={values.codePrefix}
                                onChange={(event) => setValues((current) => ({ ...current, codePrefix: event.target.value }))}
                                placeholder={t("fieldCodePrefixPlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    </div>

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
                        <span className={fieldLabelClassName}>{t("fieldFormCategory")}</span>
                        <SearchableSelect
                            options={formCategoryOptions}
                            value={values.formCategoryId || ""}
                            onChange={(v) => setValues((current) => ({ ...current, formCategoryId: v === "" ? 0 : v }))}
                            placeholder={t("fieldFormCategoryPlaceholder")}
                            disabled={loading}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldDescription")}</span>
                        <textarea
                            value={values.description ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                            placeholder={t("fieldDescriptionPlaceholder")}
                            disabled={loading}
                            rows={2}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="flex gap-6">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={values.allowAttachment}
                                onChange={(event) =>
                                    setValues((current) => ({
                                        ...current,
                                        allowAttachment: event.target.checked,
                                        requireAttachment: event.target.checked ? current.requireAttachment : false,
                                    }))
                                }
                                disabled={loading}
                                className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                            />
                            {t("fieldAllowAttachment")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={values.requireAttachment}
                                onChange={(event) => setValues((current) => ({ ...current, requireAttachment: event.target.checked }))}
                                disabled={loading || !values.allowAttachment}
                                className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f] disabled:opacity-50"
                            />
                            {t("fieldRequireAttachment")}
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldRouteConditionType")}</span>
                        <select
                            value={values.routeConditionType}
                            onChange={(event) =>
                                setValues((current) => ({ ...current, routeConditionType: Number(event.target.value) as RouteConditionType }))
                            }
                            disabled={loading || mode === "edit"}
                            className={fieldClassName}
                        >
                            <option value={RouteConditionType.None}>{t("routeConditionNone")}</option>
                            <option value={RouteConditionType.NumericRange}>{t("routeConditionNumericRange")}</option>
                            <option value={RouteConditionType.ClassValue}>{t("routeConditionClassValue")}</option>
                            <option value={RouteConditionType.Both}>{t("routeConditionBoth")}</option>
                        </select>
                        {mode === "edit" && <p className="mt-1 text-xs text-[#8a8f94]">{t("routeConditionImmutableNote")}</p>}
                    </label>

                    {needsNumericKey && (
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldRouteNumericFieldKey")}</span>
                            <input
                                value={values.routeNumericFieldKey ?? ""}
                                onChange={(event) => setValues((current) => ({ ...current, routeNumericFieldKey: event.target.value }))}
                                placeholder={t("fieldRouteFieldKeyPlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    )}

                    {needsClassKey && (
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldRouteClassFieldKey")}</span>
                            <input
                                value={values.routeClassFieldKey ?? ""}
                                onChange={(event) => setValues((current) => ({ ...current, routeClassFieldKey: event.target.value }))}
                                placeholder={t("fieldRouteFieldKeyPlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    )}

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
