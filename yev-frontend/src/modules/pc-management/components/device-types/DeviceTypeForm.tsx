"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { StyledSelect } from "@/components/ui/StyledSelect";

export interface DeviceTypeFormValues {
    typeCode: string;
    typeName: string;
    serverCheckCategory: number | null;
    requiresQrScan: boolean;
    includedInInventory: boolean;
}

// Khớp Asset.Domain.Enums.ServerCheckCategory bên BE.
const SERVER_CHECK_CATEGORY_OPTIONS = [
    { value: 0, labelKey: "serverCheckCategoryServer" },
    { value: 1, labelKey: "serverCheckCategoryNetwork" },
    { value: 2, labelKey: "serverCheckCategoryUps" },
] as const;

interface DeviceTypeFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: DeviceTypeDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: DeviceTypeFormValues) => void | Promise<void>;
}

const emptyValues: DeviceTypeFormValues = { typeCode: "", typeName: "", serverCheckCategory: null, requiresQrScan: false, includedInInventory: true };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function DeviceTypeForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: DeviceTypeFormProps) {
    const t = useTranslations("Asset.DeviceType");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<DeviceTypeFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                    typeCode: current.typeCode,
                    typeName: current.typeName,
                    serverCheckCategory: current.serverCheckCategory ?? null,
                    requiresQrScan: current.requiresQrScan ?? false,
                    includedInInventory: current.includedInInventory ?? true,
                }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = (field: "typeCode" | "typeName", value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.typeCode.trim() || !values.typeName.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="device-type-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="device-type-form-title" className="text-lg font-semibold text-[#191c1e]">
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
                        <span className={fieldLabelClassName}>{t("fieldCode")}<RequiredMark /></span>
                        <input
                            value={values.typeCode}
                            onChange={(event) => handleChange("typeCode", event.target.value)}
                            placeholder={t("fieldCodePlaceholder")}
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldName")}<RequiredMark /></span>
                        <input
                            value={values.typeName}
                            onChange={(event) => handleChange("typeName", event.target.value)}
                            placeholder={t("fieldNamePlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldServerCheckCategory")}</span>
                        <StyledSelect
                            value={values.serverCheckCategory ?? ""}
                            onChange={(v) => setValues((current) => ({ ...current, serverCheckCategory: v === "" ? null : v }))}
                            disabled={loading}
                            triggerClassName={`${fieldClassName} pr-9`}
                            options={[
                                { value: "" as const, label: t("serverCheckCategoryNone") },
                                ...SERVER_CHECK_CATEGORY_OPTIONS.map((option) => ({ value: option.value as number, label: t(option.labelKey) })),
                            ]}
                        />
                    </label>

                    {values.serverCheckCategory !== null && (
                        <label className="flex cursor-pointer items-start gap-2">
                            <input
                                type="checkbox"
                                checked={values.requiresQrScan}
                                onChange={(event) => setValues((current) => ({ ...current, requiresQrScan: event.target.checked }))}
                                disabled={loading}
                                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#e3000f]"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-[#191c1e]">{t("fieldRequiresQrScan")}</span>
                                <span className="block text-xs text-[#8a8f94]">{t("fieldRequiresQrScanHint")}</span>
                            </span>
                        </label>
                    )}

                    <label className="flex cursor-pointer items-start gap-2">
                        <input
                            type="checkbox"
                            checked={values.includedInInventory}
                            onChange={(event) => setValues((current) => ({ ...current, includedInInventory: event.target.checked }))}
                            disabled={loading}
                            className="mt-0.5 h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-[#191c1e]">{t("fieldIncludedInInventory")}</span>
                            <span className="block text-xs text-[#8a8f94]">{t("fieldIncludedInInventoryHint")}</span>
                        </span>
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
