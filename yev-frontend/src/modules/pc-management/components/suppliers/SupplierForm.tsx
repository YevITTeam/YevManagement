"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SupplierDto } from "@/modules/pc-management/types/supplier.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";

export interface SupplierFormValues {
    supplierCode: string;
    supplierName: string;
}

interface SupplierFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: SupplierDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: SupplierFormValues) => void | Promise<void>;
}

const emptyValues: SupplierFormValues = { supplierCode: "", supplierName: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function SupplierForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: SupplierFormProps) {
    const t = useTranslations("Asset.Supplier");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<SupplierFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(current ? { supplierCode: current.supplierCode, supplierName: current.supplierName } : emptyValues);
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof SupplierFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.supplierCode.trim() || !values.supplierName.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="device-type-form-title"
                className="z-60 mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
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
                            value={values.supplierCode}
                            onChange={(event) => handleChange("supplierCode", event.target.value)}
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
                            value={values.supplierName}
                            onChange={(event) => handleChange("supplierName", event.target.value)}
                            placeholder={t("fieldNamePlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}    
