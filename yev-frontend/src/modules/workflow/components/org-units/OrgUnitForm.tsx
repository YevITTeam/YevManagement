"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OrgUnitDto } from "@/modules/workflow/types/org-unit.dto";
import type { OrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface OrgUnitFormValues {
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgLevelId: number;
    parentId: number | null;
    sortOrder: number;
}

// Item phẳng cho select "Đơn vị cha" — label đã thụt lề sẵn theo độ sâu trong cây.
export interface FlatOrgUnitOption {
    id: number;
    label: string;
}

interface OrgUnitFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: OrgUnitDto | null;
    defaultParentId?: number | null;
    orgLevels: OrgLevelDto[];
    parentOptions: FlatOrgUnitOption[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: OrgUnitFormValues) => void | Promise<void>;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function OrgUnitForm({
    isOpen,
    mode,
    initial,
    defaultParentId = null,
    orgLevels,
    parentOptions,
    loading = false,
    onClose,
    onSubmit,
}: OrgUnitFormProps) {
    const t = useTranslations("Workflow.OrgUnit");
    const tCommon = useTranslations("Common");

    const emptyValues: OrgUnitFormValues = {
        code: "",
        nameVn: "",
        nameJp: "",
        orgLevelId: orgLevels[0]?.id ?? 0,
        parentId: defaultParentId,
        sortOrder: 0,
    };

    const [values, setValues] = useState<OrgUnitFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      nameVn: current.nameVn,
                      nameJp: current.nameJp ?? "",
                      orgLevelId: current.orgLevelId,
                      parentId: current.parentId,
                      sortOrder: current.sortOrder,
                  }
                : { ...emptyValues, parentId: defaultParentId }
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.nameVn.trim() || !values.orgLevelId) return;
        onSubmit({ ...values, nameJp: values.nameJp?.trim() ? values.nameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="org-unit-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="org-unit-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                        <span className={fieldLabelClassName}>{t("fieldOrgLevel")}</span>
                        <select
                            value={values.orgLevelId}
                            onChange={(event) => setValues((current) => ({ ...current, orgLevelId: Number(event.target.value) }))}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        >
                            <option value={0} disabled>
                                {t("fieldOrgLevelPlaceholder")}
                            </option>
                            {orgLevels.map((level) => (
                                <option key={level.id} value={level.id}>
                                    {level.levelNumber} — {level.nameVn}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldParent")}</span>
                        <select
                            value={values.parentId ?? 0}
                            onChange={(event) =>
                                setValues((current) => ({
                                    ...current,
                                    parentId: Number(event.target.value) === 0 ? null : Number(event.target.value),
                                }))
                            }
                            disabled={loading}
                            className={fieldClassName}
                        >
                            <option value={0}>{t("fieldParentNone")}</option>
                            {parentOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
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
