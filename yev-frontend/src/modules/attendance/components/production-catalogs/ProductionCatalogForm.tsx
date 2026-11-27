"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
    ProductionCatalogItemDto,
    ProductionCatalogKind,
    SaveProductionCatalogItemDto,
} from "@/modules/attendance/types/production-catalog.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";

interface ProductionCatalogFormProps {
    kind: ProductionCatalogKind;
    kindLabel: string;
    isOpen: boolean;
    mode: "create" | "edit";
    initial: ProductionCatalogItemDto | null;
    workshopOptions: SelectOption[];
    // All teams; the form narrows them to the chosen workshop.
    teams: ProductionCatalogItemDto[];
    loading: boolean;
    onClose: () => void;
    onSubmit: (values: SaveProductionCatalogItemDto) => void | Promise<void>;
}

const emptyValues = {
    code: "",
    nameVn: "",
    workshopId: "" as number | "",
    teamId: "" as number | "",
    congDoan: "",
    cdMae: "",
    sortCode: "",
    staffKind: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function ProductionCatalogForm({
    kind,
    kindLabel,
    isOpen,
    mode,
    initial,
    workshopOptions,
    teams,
    loading,
    onClose,
    onSubmit,
}: ProductionCatalogFormProps) {
    const t = useTranslations("Attendance.ProductionCatalog");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      nameVn: current.nameVn ?? "",
                      workshopId: current.workshopId ?? "",
                      teamId: current.teamId ?? "",
                      congDoan: current.congDoan ?? "",
                      cdMae: current.cdMae ?? "",
                      sortCode: current.sortCode ?? "",
                      staffKind: current.staffKind ?? "",
                  }
                : { ...emptyValues, workshopId: workshopOptions.length === 1 ? Number(workshopOptions[0].value) : "" }
        );
    });

    if (!isOpen) return null;

    const isLine = kind === "Line";
    const isTask = kind === "Task";
    const hasWorkshop = kind !== "ShiftTeam";
    const canSubmit =
        values.code.trim() !== "" &&
        (!hasWorkshop || values.workshopId !== "") &&
        (!isTask || values.staffKind !== "");
    const teamOptions: SelectOption[] = teams
        .filter((team) => team.workshopId === values.workshopId)
        .map((team) => ({ value: team.id, label: team.code, searchText: team.code.toLowerCase() }));

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            code: values.code.trim(),
            nameVn: isLine || isTask ? null : values.nameVn.trim() || null,
            workshopId: hasWorkshop && values.workshopId !== "" ? values.workshopId : null,
            teamId: isLine && values.teamId !== "" ? values.teamId : null,
            congDoan: isLine ? values.congDoan.trim() || null : null,
            cdMae: isLine ? values.cdMae.trim() || null : null,
            sortCode: isLine ? values.sortCode.trim() || null : null,
            staffKind: isTask ? values.staffKind : null,
        });
    };

    const textField = (key: "congDoan" | "cdMae" | "sortCode", label: string) => (
        <label className="block w-28">
            <span className={fieldLabelClassName}>{label}</span>
            <input
                value={values[key]}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                maxLength={50}
                disabled={loading}
                className={fieldClassName}
            />
        </label>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="production-catalog-form-title"
                className="z-60 mx-4 w-full max-w-xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
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
                        {hasWorkshop && (
                            <div className="w-36">
                                <span className={fieldLabelClassName}>{t("colWorkshop")}<RequiredMark /></span>
                                <SearchableSelect
                                    options={workshopOptions}
                                    value={values.workshopId}
                                    onChange={(workshopId) => setValues((current) => ({ ...current, workshopId, teamId: "" }))}
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <label className="block w-32">
                            <span className={fieldLabelClassName}>{t("colCode")}<RequiredMark /></span>
                            <input
                                value={values.code}
                                onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
                                maxLength={isLine || isTask ? 50 : 20}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        {isLine ? (
                            <>
                                <div className="w-32">
                                    <span className={fieldLabelClassName}>{t("colTeam")}</span>
                                    <SearchableSelect
                                        options={teamOptions}
                                        value={values.teamId}
                                        onChange={(teamId) => setValues((current) => ({ ...current, teamId }))}
                                        disabled={loading || values.workshopId === ""}
                                    />
                                </div>
                                {textField("congDoan", t("colCongDoan"))}
                                {textField("cdMae", t("colCdMae"))}
                                {textField("sortCode", t("colSortCode"))}
                            </>
                        ) : isTask ? (
                            <div className="w-24">
                                <span className={fieldLabelClassName}>TT/GT<RequiredMark /></span>
                                <StyledSelect
                                    options={["TT", "GT"].map((k) => ({ value: k, label: k }))}
                                    value={values.staffKind}
                                    onChange={(staffKind) => setValues((current) => ({ ...current, staffKind }))}
                                    disabled={loading}
                                    triggerClassName={`${fieldClassName} pr-8 text-left`}
                                    ariaLabel="TT/GT"
                                />
                            </div>
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
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {tCommon("save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
