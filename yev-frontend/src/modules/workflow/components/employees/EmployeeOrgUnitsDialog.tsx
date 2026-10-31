"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import { JobTitleApi } from "@/modules/workflow/api/job-title.api";
import type { EmployeeDto } from "@/modules/workflow/types/employee.dto";
import type { OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import type { JobTitleDto } from "@/modules/workflow/types/job-title.dto";
import type { ReplaceEmployeeOrgUnitItemDto } from "@/modules/workflow/types/employee-org-unit.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { randomClientId } from "@/lib/uuid";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface EmployeeOrgUnitsDialogProps {
    employee: EmployeeDto;
    onClose: () => void;
}

// clientId is local-only (React key), stripped before sending to the API.
type EditableRow = ReplaceEmployeeOrgUnitItemDto & { clientId: string };

interface FlatUnit {
    id: number;
    label: string;
}

function flattenUnits(nodes: OrgUnitTreeDto[], depth = 0): FlatUnit[] {
    const result: FlatUnit[] = [];
    for (const node of nodes) {
        result.push({ id: node.id, label: `${"— ".repeat(depth)}${node.code} · ${node.nameVn}` });
        result.push(...flattenUnits(node.children, depth + 1));
    }
    return result;
}

// PUT replaces the whole list (rows have no ids), so Save resends the full array.
export default function EmployeeOrgUnitsDialog({ employee, onClose }: EmployeeOrgUnitsDialogProps) {
    const t = useTranslations("Workflow.Employee");
    const tCommon = useTranslations("Common");

    const [items, setItems] = useState<EditableRow[]>([]);
    const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [assigned, tree, titles] = await Promise.all([
                EmployeeApi.getEmployeeOrgUnits(employee.id),
                OrgUnitApi.getOrgUnitTree(),
                JobTitleApi.getAllJobTitles(),
            ]);
            return { assigned, flat: flattenUnits(tree), titles };
        },
        [employee.id],
        (result) => {
            setItems(
                result.assigned.map((x) => ({
                    clientId: randomClientId(),
                    orgUnitId: x.orgUnitId,
                    jobTitleId: x.jobTitleId,
                    isPrimary: x.isPrimary,
                    validFrom: x.validFrom,
                    validTo: x.validTo,
                }))
            );
            setFlatUnits(result.flat);
            setJobTitles(result.titles);
        },
        t("orgUnitsLoadError"),
        (message) => toast.error(message)
    );

    const addRow = () => {
        if (flatUnits.length === 0) return;
        setItems((current) => [
            ...current,
            { clientId: randomClientId(), orgUnitId: flatUnits[0].id, jobTitleId: null, isPrimary: current.length === 0, validFrom: null, validTo: null },
        ]);
    };

    const removeRow = (clientId: string) => {
        setItems((current) => current.filter((item) => item.clientId !== clientId));
    };

    const updateRow = (clientId: string, patch: Partial<ReplaceEmployeeOrgUnitItemDto>) => {
        setItems((current) =>
            current.map((item) => {
                if (item.clientId !== clientId) {
                    // BE allows at most one IsPrimary row, so marking one unticks the others.
                    return patch.isPrimary ? { ...item, isPrimary: false } : item;
                }
                return { ...item, ...patch };
            })
        );
    };

    const findDuplicateRowError = (): string | null => {
        const seen = new Set<string>();
        for (const item of items) {
            const key = `${item.orgUnitId}:${item.jobTitleId ?? "none"}`;
            if (seen.has(key)) return t("orgUnitsDuplicateRow");
            seen.add(key);
        }
        return null;
    };

    const handleSave = async () => {
        const duplicateError = findDuplicateRowError();
        if (duplicateError) {
            toast.error(duplicateError);
            return;
        }
        setIsSaving(true);
        try {
            const payload: ReplaceEmployeeOrgUnitItemDto[] = items.map((item) => ({
                orgUnitId: item.orgUnitId,
                jobTitleId: item.jobTitleId,
                isPrimary: item.isPrimary,
                validFrom: item.validFrom,
                validTo: item.validTo,
            }));
            await EmployeeApi.replaceEmployeeOrgUnits(employee.id, payload);
            toast.success(t("orgUnitsSaveSuccess"));
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("orgUnitsSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    const fieldClassName =
        "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="employee-org-units-title"
                className="z-60 mx-4 w-full max-w-3xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <div>
                        <h3 id="employee-org-units-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("orgUnitsTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-[#5e3f3a]">
                            {employee.fullName} ({employee.employeeCode})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSaving && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="py-10 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : error ? (
                    <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="py-2 pr-3">{t("orgUnitsColOrgUnit")}</th>
                                        <th className="py-2 pr-3">{t("orgUnitsColJobTitle")}</th>
                                        <th className="py-2 pr-3 text-center">{t("orgUnitsColPrimary")}</th>
                                        <th className="py-2 pr-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-sm text-[#5e3f3a]">
                                                {t("orgUnitsNoData")}
                                            </td>
                                        </tr>
                                    )}
                                    {items.map((item) => (
                                        <tr key={item.clientId} className="border-b border-[#f1f5f9]">
                                            <td className="py-2 pr-3">
                                                <select
                                                    value={item.orgUnitId}
                                                    onChange={(event) => updateRow(item.clientId, { orgUnitId: Number(event.target.value) })}
                                                    disabled={isSaving}
                                                    className={fieldClassName}
                                                >
                                                    {flatUnits.map((unit) => (
                                                        <option key={unit.id} value={unit.id}>
                                                            {unit.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 pr-3">
                                                <select
                                                    value={item.jobTitleId ?? 0}
                                                    onChange={(event) =>
                                                        updateRow(item.clientId, {
                                                            jobTitleId: Number(event.target.value) === 0 ? null : Number(event.target.value),
                                                        })
                                                    }
                                                    disabled={isSaving}
                                                    className={fieldClassName}
                                                >
                                                    <option value={0}>{t("orgUnitsNoJobTitle")}</option>
                                                    {jobTitles.map((jt) => (
                                                        <option key={jt.id} value={jt.id}>
                                                            {jt.nameVn}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 pr-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.isPrimary}
                                                    onChange={(event) => updateRow(item.clientId, { isPrimary: event.target.checked })}
                                                    disabled={isSaving}
                                                    className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                                                />
                                            </td>
                                            <td className="py-2 pr-1 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(item.clientId)}
                                                    disabled={isSaving}
                                                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#930006] hover:bg-[#fff4f2] disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            onClick={addRow}
                            disabled={isSaving || flatUnits.length === 0}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            <Plus className="h-3.5 w-3.5" /> {t("orgUnitsAddRow")}
                        </button>

                        <div className="flex justify-end gap-3 border-t border-[#e0e3e5] pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {tCommon("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? tCommon("processing") : tCommon("save")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
