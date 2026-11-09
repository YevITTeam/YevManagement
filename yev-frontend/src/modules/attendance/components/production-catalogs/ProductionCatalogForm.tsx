"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
    ProductionCatalogItemDto,
    ProductionCatalogKind,
    SaveProductionCatalogItemDto,
} from "@/modules/attendance/types/production-catalog.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

interface ProductionCatalogFormProps {
    kind: ProductionCatalogKind;
    kindLabel: string;
    isOpen: boolean;
    mode: "create" | "edit";
    initial: ProductionCatalogItemDto | null;
    teamOptions: SelectOption[];
    loading: boolean;
    onClose: () => void;
    onSubmit: (values: SaveProductionCatalogItemDto) => void | Promise<void>;
}

const emptyValues = { code: "", nameVn: "", teamId: "" as number | "", congDoan: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function ProductionCatalogForm({ kind, kindLabel, isOpen, mode, initial, teamOptions, loading, onClose, onSubmit }: ProductionCatalogFormProps) {
    const t = useTranslations("Attendance.ProductionCatalog");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? { code: current.code, nameVn: current.nameVn ?? "", teamId: current.teamId ?? "", congDoan: current.congDoan ?? "" }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const isLine = kind === "Line";
    const canSubmit = values.code.trim() !== "" && (!isLine || values.teamId !== "");

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            code: values.code.trim(),
            nameVn: isLine ? null : values.nameVn.trim() || null,
            teamId: isLine && values.teamId !== "" ? values.teamId : null,
            congDoan: isLine ? values.congDoan.trim() || null : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="production-catalog-form-title"
                className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="production-catalog-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle", { kind: kindLabel }) : t("editTitle", { kind: kindLabel })}
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
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                        <label className="block w-32">
                            <span className={fieldLabelClassName}>{t("colCode")}<RequiredMark /></span>
                            <input
                                value={values.code}
                                onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
                                maxLength={isLine ? 50 : 20}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        {isLine ? (
                            <>
                                <div className="w-40">
                                    <span className={fieldLabelClassName}>{t("colTeam")}<RequiredMark /></span>
                                    <SearchableSelect
                                        options={teamOptions}
                                        value={values.teamId}
                                        onChange={(teamId) => setValues((current) => ({ ...current, teamId }))}
                                        placeholder={t("selectTeam")}
                                        disabled={loading}
                                    />
                                </div>
                                <label className="block w-32">
                                    <span className={fieldLabelClassName}>{t("colCongDoan")}</span>
                                    <input
                                        value={values.congDoan}
                                        onChange={(event) => setValues((current) => ({ ...current, congDoan: event.target.value }))}
                                        maxLength={50}
                                        disabled={loading}
                                        className={fieldClassName}
                                    />
                                </label>
                            </>
                        ) : (
                            <label className="block min-w-48 flex-1">
                                <span className={fieldLabelClassName}>{t("colName")}</span>
                                <input
                                    value={values.nameVn}
                                    onChange={(event) => setValues((current) => ({ ...current, nameVn: event.target.value }))}
                                    maxLength={100}
                                    disabled={loading}
                                    className={fieldClassName}
                                />
                            </label>
                        )}
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
                            disabled={loading || !canSubmit}
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
