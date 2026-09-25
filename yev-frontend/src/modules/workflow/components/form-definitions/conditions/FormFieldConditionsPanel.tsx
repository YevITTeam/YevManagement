"use client";

import { useState } from "react";
import { Plus, Trash2, Save, GitBranch } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import type { FormFieldDto } from "@/modules/workflow/types/form-field.dto";
import { ConditionOperator, ConditionEffect, type ReplaceFormFieldConditionItemDto } from "@/modules/workflow/types/form-field-condition.dto";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";

interface FormFieldConditionsPanelProps {
    formDefinitionId: number;
}

const selectClassName =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

// Chỉ cấu hình (không kéo-thả) — Target/Source chọn từ field ĐÃ LƯU (workflow-module.md §3.2:
// TargetFieldId/SourceFieldId là FK trỏ FormFields.Id thật, không thể trỏ vào field chưa lưu ở tab
// "Ô nhập"). Không autosave, giống hệt pattern FormFieldDesigner.
export default function FormFieldConditionsPanel({ formDefinitionId }: FormFieldConditionsPanelProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [fields, setFields] = useState<FormFieldDto[]>([]);
    const [items, setItems] = useState<ReplaceFormFieldConditionItemDto[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [savedFields, conditions] = await Promise.all([
                FormDefinitionApi.getFields(formDefinitionId),
                FormDefinitionApi.getConditions(formDefinitionId),
            ]);
            return { savedFields, conditions };
        },
        [formDefinitionId],
        (result) => {
            setFields(result.savedFields);
            setItems(
                result.conditions.map((c) => ({
                    targetFieldId: c.targetFieldId,
                    sourceFieldId: c.sourceFieldId,
                    operator: c.operator,
                    compareValue: c.compareValue,
                    compareValue2: c.compareValue2,
                    effect: c.effect,
                    logicGroup: c.logicGroup,
                }))
            );
        },
        t("loadConditionsError"),
        (message) => toast.error(message)
    );

    const addRow = () => {
        if (fields.length < 2) return;
        setItems((current) => [
            ...current,
            {
                targetFieldId: fields[0].id,
                sourceFieldId: fields[1].id,
                operator: ConditionOperator.Equals,
                compareValue: "",
                compareValue2: null,
                effect: ConditionEffect.Show,
                logicGroup: 1,
            },
        ]);
    };

    const removeRow = (index: number) => setItems((current) => current.filter((_, i) => i !== index));

    const updateRow = (index: number, patch: Partial<ReplaceFormFieldConditionItemDto>) =>
        setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await FormDefinitionApi.replaceConditions(formDefinitionId, items);
            setItems(
                result.map((c) => ({
                    targetFieldId: c.targetFieldId,
                    sourceFieldId: c.sourceFieldId,
                    operator: c.operator,
                    compareValue: c.compareValue,
                    compareValue2: c.compareValue2,
                    effect: c.effect,
                    logicGroup: c.logicGroup,
                }))
            );
            toast.success(t("saveConditionsSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveConditionsError")));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    if (fields.length < 2) {
        return <div className="rounded-lg border border-[#f5d0a9] bg-[#fff8ee] px-4 py-3 text-sm text-[#8a5a00]">{t("needAtLeastTwoFields")}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={addRow}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <Plus className="h-3.5 w-3.5" /> {t("addCondition")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Save className="h-3.5 w-3.5" /> {isSaving ? t("saving") : t("saveChanges")}
                    </button>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#e0e3e5]">
                    <EmptyState icon={GitBranch} title={t("noConditions")} />
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item, index) => {
                        const needsCompareValue2 = item.operator === ConditionOperator.Between;
                        const needsCompareValue = item.operator !== ConditionOperator.IsEmpty && item.operator !== ConditionOperator.IsNotEmpty;

                        return (
                            <div key={index} className="rounded-lg border border-[#e0e3e5] bg-white p-3">
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                                    <label className="block">
                                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("conditionTarget")}</span>
                                        <select
                                            value={item.targetFieldId}
                                            onChange={(event) => updateRow(index, { targetFieldId: Number(event.target.value) })}
                                            className={selectClassName}
                                        >
                                            {fields.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.labelVn}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("conditionSource")}</span>
                                        <select
                                            value={item.sourceFieldId}
                                            onChange={(event) => updateRow(index, { sourceFieldId: Number(event.target.value) })}
                                            className={selectClassName}
                                        >
                                            {fields.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.labelVn}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("conditionOperator")}</span>
                                        <select
                                            value={item.operator}
                                            onChange={(event) => updateRow(index, { operator: Number(event.target.value) as ConditionOperator })}
                                            className={selectClassName}
                                        >
                                            <option value={ConditionOperator.Equals}>{t("operatorEquals")}</option>
                                            <option value={ConditionOperator.NotEquals}>{t("operatorNotEquals")}</option>
                                            <option value={ConditionOperator.Contains}>{t("operatorContains")}</option>
                                            <option value={ConditionOperator.GreaterThan}>{t("operatorGreaterThan")}</option>
                                            <option value={ConditionOperator.LessThan}>{t("operatorLessThan")}</option>
                                            <option value={ConditionOperator.Between}>{t("operatorBetween")}</option>
                                            <option value={ConditionOperator.IsEmpty}>{t("operatorIsEmpty")}</option>
                                            <option value={ConditionOperator.IsNotEmpty}>{t("operatorIsNotEmpty")}</option>
                                        </select>
                                    </label>

                                    {needsCompareValue && (
                                        <label className="block">
                                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">
                                                {t("conditionCompareValue")}
                                            </span>
                                            <input
                                                value={item.compareValue ?? ""}
                                                onChange={(event) => updateRow(index, { compareValue: event.target.value })}
                                                className={selectClassName}
                                            />
                                        </label>
                                    )}

                                    {needsCompareValue2 && (
                                        <label className="block">
                                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">
                                                {t("conditionCompareValue2")}
                                            </span>
                                            <input
                                                value={item.compareValue2 ?? ""}
                                                onChange={(event) => updateRow(index, { compareValue2: event.target.value })}
                                                className={selectClassName}
                                            />
                                        </label>
                                    )}

                                    <label className="block">
                                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("conditionEffect")}</span>
                                        <select
                                            value={item.effect}
                                            onChange={(event) => updateRow(index, { effect: Number(event.target.value) as ConditionEffect })}
                                            className={selectClassName}
                                        >
                                            <option value={ConditionEffect.Show}>{t("effectShow")}</option>
                                            <option value={ConditionEffect.Hide}>{t("effectHide")}</option>
                                            <option value={ConditionEffect.Require}>{t("effectRequire")}</option>
                                            <option value={ConditionEffect.ReadOnly}>{t("effectReadOnly")}</option>
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("conditionLogicGroup")}</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={item.logicGroup}
                                            onChange={(event) => updateRow(index, { logicGroup: Number(event.target.value) })}
                                            className={selectClassName}
                                        />
                                    </label>
                                </div>

                                <div className="mt-2 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => removeRow(index)}
                                        className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#930006] hover:text-[#e3000f]"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> {t("removeCondition")}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
