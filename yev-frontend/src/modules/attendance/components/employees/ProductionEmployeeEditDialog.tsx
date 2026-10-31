"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import type { ProductionEmployeeListItemDto, ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { getApiErrorMessage } from "@/lib/apiError";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

interface ProductionEmployeeEditDialogProps {
    item: ProductionEmployeeListItemDto | null;
    onClose: () => void;
    onSaved: () => void;
}

const toOptions = (options: ProductionOptionDto[]): SelectOption[] =>
    options.map((o) => ({ value: o.id, label: o.nameVn ? `${o.code} - ${o.nameVn}` : o.code, searchText: o.code.toLowerCase() }));

// Quick single-row fix between Excel imports (the import is the main source and overwrites monthly).
export default function ProductionEmployeeEditDialog({ item, onClose, onSaved }: ProductionEmployeeEditDialogProps) {
    const t = useTranslations("Attendance.ProductionEmployeeList");
    const tCommon = useTranslations("Common");

    const [teamId, setTeamId] = useState<number | "">("");
    const [productionLineId, setProductionLineId] = useState<number | "">("");
    const [shiftTeamId, setShiftTeamId] = useState<number | "">("");
    const [isLeader, setIsLeader] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);

    useEffect(() => {
        ProductionEmployeeApi.getTeamOptions().then(setTeamOptions).catch((err) => console.error(err));
    }, []);

    useDialogReset(item !== null, item, (current) => {
        setTeamId(current?.teamId ?? "");
        setProductionLineId(current?.productionLineId ?? "");
        setShiftTeamId(current?.shiftTeamId ?? "");
        setIsLeader(current?.isLeader ?? false);
        ProductionEmployeeApi.getLineOptions(current?.teamId ?? undefined).then(setLineOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getShiftTeamOptions(current?.productionLineId ?? undefined, current?.teamId ?? undefined)
            .then(setShiftTeamOptions)
            .catch((err) => console.error(err));
    });

    if (!item) return null;

    const handleSelectTeam = (nextId: number | "") => {
        setTeamId(nextId);
        setProductionLineId("");
        setShiftTeamId("");
        ProductionEmployeeApi.getLineOptions(nextId === "" ? undefined : nextId)
            .then(setLineOptions)
            .catch((err) => console.error(err));
        ProductionEmployeeApi.getShiftTeamOptions(undefined, nextId === "" ? undefined : nextId)
            .then(setShiftTeamOptions)
            .catch((err) => console.error(err));
    };

    const handleSelectLine = (nextId: number | "") => {
        setProductionLineId(nextId);
        setShiftTeamId("");
        ProductionEmployeeApi.getShiftTeamOptions(nextId === "" ? undefined : nextId, teamId === "" ? undefined : teamId)
            .then(setShiftTeamOptions)
            .catch((err) => console.error(err));
    };

    const handleClose = () => {
        if (isSaving) return;
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSaving(true);
        try {
            await ProductionEmployeeApi.update(item.id, {
                productionLineId: productionLineId === "" ? null : productionLineId,
                teamId: teamId === "" ? null : teamId,
                shiftTeamId: shiftTeamId === "" ? null : shiftTeamId,
                isLeader,
            });
            toast.success(t("editSuccess"));
            onSaved();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("editError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
            <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">
                        {t("editDialogTitle")} — {item.fullName} ({item.employeeCode})
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("fieldTeam")}</span>
                            <SearchableSelect
                                options={toOptions(teamOptions)}
                                value={teamId}
                                onChange={handleSelectTeam}
                                placeholder={t("filterTeamPlaceholder")}
                                disabled={isSaving}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("fieldLine")}</span>
                            <SearchableSelect
                                options={toOptions(lineOptions)}
                                value={productionLineId}
                                onChange={handleSelectLine}
                                placeholder={t("filterBlockPlaceholder")}
                                disabled={isSaving}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("fieldShiftTeam")}</span>
                            <SearchableSelect
                                options={toOptions(shiftTeamOptions)}
                                value={shiftTeamId}
                                onChange={setShiftTeamId}
                                placeholder={t("filterShiftTeamPlaceholder")}
                                disabled={isSaving}
                            />
                        </label>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isLeader}
                            onChange={(event) => setIsLeader(event.target.checked)}
                            disabled={isSaving}
                            className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <span className="text-sm font-medium text-[#191c1e]">{t("fieldIsLeader")}</span>
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? t("saving") : t("editSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
