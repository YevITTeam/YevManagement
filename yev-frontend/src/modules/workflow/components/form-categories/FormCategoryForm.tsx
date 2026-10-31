"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import type { OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

export interface FormCategoryFormValues {
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgUnitId: number | null;
    sortOrder: number;
}

interface FormCategoryFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: FormCategoryDto | null;
    orgUnitTree: OrgUnitTreeDto[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: FormCategoryFormValues) => void | Promise<void>;
}

const emptyValues: FormCategoryFormValues = { code: "", nameVn: "", nameJp: "", orgUnitId: null, sortOrder: 0 };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Parent options indented by tree depth, same as flattenTree() in OrgUnitList.tsx.
function flattenOrgUnits(nodes: OrgUnitTreeDto[], depth = 0): SelectOption[] {
    const result: SelectOption[] = [];
    for (const node of nodes) {
        const label = `${"— ".repeat(depth)}${node.code} · ${node.nameVn}`;
        result.push({ value: node.id, label, searchText: `${node.code} ${node.nameVn}`.toLowerCase() });
        result.push(...flattenOrgUnits(node.children, depth + 1));
    }
    return result;
}

export default function FormCategoryForm({ isOpen, mode, initial, orgUnitTree, loading = false, onClose, onSubmit }: FormCategoryFormProps) {
    const t = useTranslations("Workflow.FormCategory");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<FormCategoryFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? { code: current.code, nameVn: current.nameVn, nameJp: current.nameJp ?? "", orgUnitId: current.orgUnitId, sortOrder: current.sortOrder }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const orgUnitOptions = flattenOrgUnits(orgUnitTree);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.nameVn.trim()) return;
        onSubmit({ ...values, nameJp: values.nameJp?.trim() ? values.nameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-category-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="form-category-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                        <span className={fieldLabelClassName}>{t("fieldOrgUnit")}</span>
                        <SearchableSelect
                            options={orgUnitOptions}
                            value={values.orgUnitId ?? ""}
                            onChange={(v) => setValues((current) => ({ ...current, orgUnitId: v === "" ? null : v }))}
                            placeholder={t("fieldOrgUnitPlaceholder")}
                            disabled={loading}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldSortOrder")}</span>
                        <input
                            type="number"
                            value={values.sortOrder}
                            onChange={(event) => setValues((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
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
