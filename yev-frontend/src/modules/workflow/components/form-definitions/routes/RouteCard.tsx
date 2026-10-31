"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, ListTree } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { RouteConditionType } from "@/modules/workflow/types/form-definition.dto";
import { OrgUnitScope, ParticipantRole, ParticipantSource } from "@/modules/workflow/types/form-route.dto";
import { OrgLevelApi } from "@/modules/workflow/api/org-level.api";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import type { OrgUnitAncestorInfo } from "./FormApprovalRoutesPanel";
import { createDefaultParticipant, createDefaultStep, type EditableRoute, type EditableStep } from "./editableRoute";
import StepCard from "./StepCard";

interface RouteCardProps {
    route: EditableRoute;
    index: number;
    totalRoutes: number;
    routeConditionType: RouteConditionType;
    orgUnitOptions: SelectOption[];
    orgUnitsById: Map<number, OrgUnitAncestorInfo>;
    employeeOptions: SelectOption[];
    jobTitleOptions: SelectOption[];
    onChange: (patch: Partial<EditableRoute>) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
}

const fieldClassName =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const labelClassName = "mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]";

export default function RouteCard({
    route,
    index,
    totalRoutes,
    routeConditionType,
    orgUnitOptions,
    orgUnitsById,
    employeeOptions,
    jobTitleOptions,
    onChange,
    onMoveUp,
    onMoveDown,
    onRemove,
}: RouteCardProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [autoFillFromId, setAutoFillFromId] = useState<number | "">("");
    const [autoFillToId, setAutoFillToId] = useState<number | "">("");
    const [isAutoFilling, setIsAutoFilling] = useState(false);

    const showNumericRange = routeConditionType === RouteConditionType.NumericRange || routeConditionType === RouteConditionType.Both;
    const showClassValue = routeConditionType === RouteConditionType.ClassValue || routeConditionType === RouteConditionType.Both;

    const addStep = () => onChange({ steps: [...route.steps, createDefaultStep(t("stepDefaultName", { order: route.steps.length + 1 }))] });

    // Helper only, BE still validates: adds a Fixed step per ancestor unit from "from" to "to" via orgUnitsById,
    // defaulting to each level's first suggested job title; the user can still edit before saving.
    const autoFillChain = async () => {
        if (autoFillFromId === "" || autoFillToId === "") return;

        const chain: number[] = [];
        let cursor: number | null = autoFillFromId;
        while (cursor !== null) {
            chain.push(cursor);
            cursor = orgUnitsById.get(cursor)?.parentId ?? null;
        }
        const toPos = chain.indexOf(autoFillToId);
        if (toPos === -1) {
            toast.error(t("autoFillNotAncestor"));
            return;
        }
        const requiredChain = chain.slice(0, toPos + 1);

        const existingOrgUnitIds = new Set(
            route.steps.filter((s) => s.orgUnitScope === OrgUnitScope.Fixed && s.orgUnitId !== null).map((s) => s.orgUnitId)
        );

        setIsAutoFilling(true);
        try {
            const newSteps: EditableStep[] = [];
            for (const unitId of requiredChain) {
                if (existingOrgUnitIds.has(unitId)) continue;
                const unit = orgUnitsById.get(unitId);
                if (!unit) continue;

                const suggestions = await OrgLevelApi.getJobTitleSuggestions(unit.orgLevelId);
                const step = createDefaultStep(unit.nameVn);
                step.orgUnitScope = OrgUnitScope.Fixed;
                step.orgUnitId = unitId;
                step.participants = [
                    {
                        ...createDefaultParticipant(),
                        participantSource: ParticipantSource.JobTitle,
                        jobTitleId: suggestions[0]?.jobTitleId ?? null,
                        participantRole: ParticipantRole.Approver,
                    },
                ];
                newSteps.push(step);
            }

            if (newSteps.length === 0) {
                toast.info(t("autoFillChainNoneToAdd"));
            } else {
                onChange({ steps: [...route.steps, ...newSteps] });
                toast.success(t("autoFillChainSuccess", { count: newSteps.length }));
            }
        } finally {
            setIsAutoFilling(false);
        }
    };
    const updateStep = (clientId: string, patch: Partial<EditableRoute["steps"][number]>) =>
        onChange({ steps: route.steps.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)) });
    const removeStep = (clientId: string) => onChange({ steps: route.steps.filter((s) => s.clientId !== clientId) });
    const moveStep = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= route.steps.length) return;
        const next = [...route.steps];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onChange({ steps: next });
    };

    return (
        <div className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <span className="mt-1.5 shrink-0 rounded-full bg-[#f2f4f6] px-2.5 py-1 text-xs font-semibold text-[#191c1e]">
                    {t("routeOrderLabel", { order: index + 1 })}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={onMoveUp} disabled={index === 0} className="cursor-pointer p-1 text-[#5e3f3a] hover:text-[#191c1e] disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={onMoveDown} disabled={index === totalRoutes - 1} className="cursor-pointer p-1 text-[#5e3f3a] hover:text-[#191c1e] disabled:opacity-30">
                        <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={onRemove} className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] px-2 py-1 text-xs font-semibold text-[#930006] hover:bg-[#fff4f2]">
                        <Trash2 className="h-3.5 w-3.5" /> {t("removeRoute")}
                    </button>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="col-span-2 block">
                    <span className={labelClassName}>{t("routeNameVn")}</span>
                    <input value={route.nameVn} onChange={(e) => onChange({ nameVn: e.target.value })} className={fieldClassName} />
                </label>
                <label className="col-span-2 block">
                    <span className={labelClassName}>{t("fieldNameJp")}</span>
                    <input value={route.nameJp ?? ""} onChange={(e) => onChange({ nameJp: e.target.value || null })} className={fieldClassName} />
                </label>

                {showNumericRange && !route.isDefault && (
                    <>
                        <label className="block">
                            <span className={labelClassName}>{t("routeMinValue")}</span>
                            <input
                                type="number"
                                value={route.minValue ?? ""}
                                onChange={(e) => onChange({ minValue: e.target.value === "" ? null : Number(e.target.value) })}
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={labelClassName}>{t("routeMaxValue")}</span>
                            <input
                                type="number"
                                value={route.maxValue ?? ""}
                                onChange={(e) => onChange({ maxValue: e.target.value === "" ? null : Number(e.target.value) })}
                                className={fieldClassName}
                            />
                        </label>
                    </>
                )}
                {showClassValue && !route.isDefault && (
                    <label className="col-span-2 block">
                        <span className={labelClassName}>{t("routeClassValue")}</span>
                        <input value={route.classValue ?? ""} onChange={(e) => onChange({ classValue: e.target.value || null })} className={fieldClassName} />
                    </label>
                )}

                <label className="flex items-center gap-1.5 pt-5">
                    <input type="checkbox" checked={route.isDefault} onChange={(e) => onChange({ isDefault: e.target.checked })} className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f]" />
                    <span className="text-xs font-semibold text-[#5e3f3a]">{t("routeIsDefault")}</span>
                </label>
            </div>

            <div className="mt-3 border-t border-[#e0e3e5] pt-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-[#8a8f94]">{t("stepsTitle")}</span>
                    <button type="button" onClick={addStep} className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1 text-xs font-semibold text-[#191c1e] hover:bg-[#f2f4f6]">
                        <Plus className="h-3.5 w-3.5" /> {t("addStep")}
                    </button>
                </div>

                <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-[#e0e3e5] bg-[#f8fafc] p-2.5">
                    <div className="min-w-[180px] flex-1">
                        <span className={labelClassName}>{t("autoFillChainFromLabel")}</span>
                        <SearchableSelect
                            options={orgUnitOptions}
                            value={autoFillFromId}
                            onChange={(v) => setAutoFillFromId(v === "" ? "" : Number(v))}
                            placeholder={t("stepOrgUnitPlaceholder")}
                            triggerClassName={fieldClassName}
                        />
                    </div>
                    <div className="min-w-[180px] flex-1">
                        <span className={labelClassName}>{t("autoFillChainToLabel")}</span>
                        <SearchableSelect
                            options={orgUnitOptions}
                            value={autoFillToId}
                            onChange={(v) => setAutoFillToId(v === "" ? "" : Number(v))}
                            placeholder={t("stepOrgUnitPlaceholder")}
                            triggerClassName={fieldClassName}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={autoFillChain}
                        disabled={autoFillFromId === "" || autoFillToId === "" || isAutoFilling}
                        className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ListTree className="h-3.5 w-3.5" /> {isAutoFilling ? t("saving") : t("autoFillChainButton")}
                    </button>
                </div>

                {route.steps.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#e0e3e5] px-4 py-6 text-center text-sm text-[#8a8f94]">{t("noSteps")}</div>
                ) : (
                    <div className="space-y-2">
                        {route.steps.map((step, stepIndex) => (
                            <StepCard
                                key={step.clientId}
                                step={step}
                                index={stepIndex}
                                totalSteps={route.steps.length}
                                orgUnitOptions={orgUnitOptions}
                                employeeOptions={employeeOptions}
                                jobTitleOptions={jobTitleOptions}
                                onChange={(patch) => updateStep(step.clientId, patch)}
                                onMoveUp={() => moveStep(stepIndex, stepIndex - 1)}
                                onMoveDown={() => moveStep(stepIndex, stepIndex + 1)}
                                onRemove={() => removeStep(step.clientId)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
