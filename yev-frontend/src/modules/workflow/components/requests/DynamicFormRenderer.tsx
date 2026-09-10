"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { FormFieldDto } from "@/modules/workflow/types/form-field.dto";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";
import type { FormFieldConditionDto } from "@/modules/workflow/types/form-field-condition.dto";
import { ConditionOperator, ConditionEffect } from "@/modules/workflow/types/form-field-condition.dto";
import type { JsonValue } from "@/modules/workflow/types/workflow-request.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

interface DynamicFormRendererProps {
    fields: FormFieldDto[];
    conditions: FormFieldConditionDto[];
    value: Record<string, JsonValue>;
    onChange: (next: Record<string, JsonValue>) => void;
    disabled?: boolean;
    employeeOptions: SelectOption[];
    orgUnitOptions: SelectOption[];
}

interface OptionRow {
    value: string;
    label: string;
}

export function parseOptions(json: string | null): OptionRow[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            return parsed.map((x) => ({ value: String(x.value ?? ""), label: String(x.label ?? "") }));
        }
    } catch {
        // OptionsJson hỏng — coi như rỗng, không chặn render cả form.
    }
    return [];
}

export const COLUMN_SPAN_CLASS: Record<number, string> = {
    1: "col-span-3 md:col-span-1",
    2: "col-span-3 md:col-span-2",
    3: "col-span-3",
};

export const inputClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#8a8f94]";

export function toDateTimeLocalValue(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Đánh giá điều kiện client-side (workflow-module.md §5.3) — CHỈ để UX, BE luôn đánh giá lại lúc nộp
// (WorkflowRequestService.EvaluateConditions/ValidateAndNormalizeDataJsonAsync), không tin FE. Mirror
// đúng thuật toán BE: gom theo TargetFieldId rồi theo Effect, trong 1 Effect gom tiếp theo LogicGroup
// (AND trong group, OR giữa group), Show/Hide/Require/ReadOnly đánh giá ĐỘC LẬP nhau.
export interface FieldFlags {
    visible: boolean;
    required: boolean;
    readOnly: boolean;
}

function evaluateSingleCondition(condition: FormFieldConditionDto, fieldsByKey: Map<number, FormFieldDto>, data: Record<string, JsonValue>): boolean {
    const sourceField = fieldsByKey.get(condition.sourceFieldId);
    if (!sourceField) return false;

    const raw = data[sourceField.fieldKey];
    const hasValue = raw !== null && raw !== undefined;

    if (condition.operator === ConditionOperator.IsEmpty) return !hasValue || raw === "";
    if (condition.operator === ConditionOperator.IsNotEmpty) return hasValue && raw !== "";
    if (!hasValue) return false;

    if (sourceField.dataType === FieldDataType.Number || sourceField.dataType === FieldDataType.Decimal) {
        if (typeof raw !== "number") return false;
        const cv = condition.compareValue !== null ? Number(condition.compareValue) : NaN;
        const cv2 = condition.compareValue2 !== null ? Number(condition.compareValue2) : NaN;
        switch (condition.operator) {
            case ConditionOperator.Equals:
                return !Number.isNaN(cv) && raw === cv;
            case ConditionOperator.NotEquals:
                return !(!Number.isNaN(cv) && raw === cv);
            case ConditionOperator.GreaterThan:
                return !Number.isNaN(cv) && raw > cv;
            case ConditionOperator.LessThan:
                return !Number.isNaN(cv) && raw < cv;
            case ConditionOperator.Between:
                return !Number.isNaN(cv) && !Number.isNaN(cv2) && raw >= cv && raw <= cv2;
            default:
                return false;
        }
    }

    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    switch (condition.operator) {
        case ConditionOperator.Equals:
            return str === condition.compareValue;
        case ConditionOperator.NotEquals:
            return str !== condition.compareValue;
        case ConditionOperator.Contains:
            return condition.compareValue !== null && str.includes(condition.compareValue);
        case ConditionOperator.GreaterThan:
            return condition.compareValue !== null && str > condition.compareValue;
        case ConditionOperator.LessThan:
            return condition.compareValue !== null && str < condition.compareValue;
        case ConditionOperator.Between:
            return condition.compareValue !== null && condition.compareValue2 !== null && str >= condition.compareValue && str <= condition.compareValue2;
        default:
            return false;
    }
}

// Exported để DocumentFormRenderer.tsx (chế độ tài liệu, workflow-module.md §1.5) dùng chung đúng 1
// thuật toán — không chép lại, tránh lệch dần với BE.
export function evaluateFlags(fields: FormFieldDto[], conditions: FormFieldConditionDto[], data: Record<string, JsonValue>): Map<number, FieldFlags> {
    const fieldsById = new Map(fields.map((f) => [f.id, f]));
    const result = new Map<number, FieldFlags>();

    const effectActive = (targetConditions: FormFieldConditionDto[], effect: ConditionEffect) => {
        const relevant = targetConditions.filter((c) => c.effect === effect);
        if (relevant.length === 0) return false;
        const byGroup = new Map<number, FormFieldConditionDto[]>();
        for (const c of relevant) {
            const list = byGroup.get(c.logicGroup) ?? [];
            list.push(c);
            byGroup.set(c.logicGroup, list);
        }
        return Array.from(byGroup.values()).some((group) => group.every((c) => evaluateSingleCondition(c, fieldsById, data)));
    };

    for (const field of fields) {
        const targetConditions = conditions.filter((c) => c.targetFieldId === field.id);
        const showActive = effectActive(targetConditions, ConditionEffect.Show);
        const hideActive = effectActive(targetConditions, ConditionEffect.Hide);
        const requireActive = effectActive(targetConditions, ConditionEffect.Require);
        const readOnlyActive = effectActive(targetConditions, ConditionEffect.ReadOnly);

        result.set(field.id, {
            visible: field.defaultVisible ? !hideActive : showActive,
            required: field.isRequired || requireActive,
            readOnly: field.isReadOnly || readOnlyActive,
        });
    }

    return result;
}

// Dựng màn điền đơn động theo FormFields sống (Draft, trước khi FormSchemaJson tồn tại) — dùng chung
// cho mọi loại đơn, đúng tinh thần cốt lõi của module (workflow-module.md §0: "không cần lập trình
// viên cho từng loại đơn mới"). 14 FieldDataType, quy ước JSON theo §5.8.
export default function DynamicFormRenderer({ fields, conditions, value, onChange, disabled, employeeOptions, orgUnitOptions }: DynamicFormRendererProps) {
    const t = useTranslations("Workflow.WorkflowRequest");
    const sortedFields = useMemo(() => [...fields].sort((a, b) => a.sortOrder - b.sortOrder), [fields]);
    const flags = useMemo(() => evaluateFlags(fields, conditions, value), [fields, conditions, value]);

    const setValue = (fieldKey: string, v: JsonValue) => onChange({ ...value, [fieldKey]: v });

    return (
        <div className="grid grid-cols-3 gap-4">
            {sortedFields.map((field) => {
                const flag = flags.get(field.id) ?? { visible: field.defaultVisible, required: field.isRequired, readOnly: field.isReadOnly };
                if (!flag.visible) return null;

                if (field.dataType === FieldDataType.Label) {
                    return (
                        <div key={field.fieldKey} className={COLUMN_SPAN_CLASS[field.columnSpan] ?? COLUMN_SPAN_CLASS[1]}>
                            <p className="text-sm font-semibold text-[#191c1e]">{field.labelVn}</p>
                            {field.helpTextVn && <p className="mt-0.5 text-xs text-[#8a8f94]">{field.helpTextVn}</p>}
                        </div>
                    );
                }

                const isDisabled = disabled || flag.readOnly;
                const raw = value[field.fieldKey] ?? null;

                return (
                    <label key={field.fieldKey} className={COLUMN_SPAN_CLASS[field.columnSpan] ?? COLUMN_SPAN_CLASS[1]}>
                        <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-[#8a8f94]">
                            {field.labelVn}
                            {flag.required && <span className="text-[#e3000f]">*</span>}
                        </span>

                        {field.dataType === FieldDataType.Text && (
                            <input
                                type="text"
                                value={typeof raw === "string" ? raw : ""}
                                onChange={(e) => setValue(field.fieldKey, e.target.value)}
                                placeholder={field.placeholder ?? undefined}
                                maxLength={field.maxLength ?? undefined}
                                disabled={isDisabled}
                                className={inputClassName}
                            />
                        )}

                        {field.dataType === FieldDataType.TextArea && (
                            <textarea
                                value={typeof raw === "string" ? raw : ""}
                                onChange={(e) => setValue(field.fieldKey, e.target.value)}
                                placeholder={field.placeholder ?? undefined}
                                maxLength={field.maxLength ?? undefined}
                                disabled={isDisabled}
                                rows={3}
                                className={`${inputClassName} h-auto resize-y py-2`}
                            />
                        )}

                        {(field.dataType === FieldDataType.Number || field.dataType === FieldDataType.Decimal) && (
                            <input
                                type="number"
                                step={field.dataType === FieldDataType.Decimal ? "any" : "1"}
                                value={typeof raw === "number" ? raw : ""}
                                min={field.minValue ?? undefined}
                                max={field.maxValue ?? undefined}
                                onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : Number(e.target.value))}
                                placeholder={field.placeholder ?? undefined}
                                disabled={isDisabled}
                                className={inputClassName}
                            />
                        )}

                        {field.dataType === FieldDataType.Date && (
                            <input
                                type="date"
                                value={typeof raw === "string" ? raw : ""}
                                onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : e.target.value)}
                                disabled={isDisabled}
                                className={inputClassName}
                            />
                        )}

                        {field.dataType === FieldDataType.DateTime && (
                            <input
                                type="datetime-local"
                                value={toDateTimeLocalValue(typeof raw === "string" ? raw : null)}
                                onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : new Date(e.target.value).toISOString())}
                                disabled={isDisabled}
                                className={inputClassName}
                            />
                        )}

                        {field.dataType === FieldDataType.Time && (
                            <input
                                type="time"
                                value={typeof raw === "string" ? raw : ""}
                                onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : e.target.value)}
                                disabled={isDisabled}
                                className={inputClassName}
                            />
                        )}

                        {field.dataType === FieldDataType.Dropdown &&
                            (() => {
                                const options = parseOptions(field.optionsJson);
                                if (options.length === 0 && field.formDataSourceId) {
                                    return <p className="py-2 text-xs italic text-[#8a8f94]">{t("dynamicSourceNotSupported")}</p>;
                                }
                                return (
                                    <select
                                        value={typeof raw === "string" ? raw : ""}
                                        onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : e.target.value)}
                                        disabled={isDisabled}
                                        className={inputClassName}
                                    >
                                        <option value="">{t("selectPlaceholder")}</option>
                                        {options.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                );
                            })()}

                        {field.dataType === FieldDataType.Radio &&
                            (() => {
                                const options = parseOptions(field.optionsJson);
                                if (options.length === 0) return <p className="py-2 text-xs italic text-[#8a8f94]">{t("dynamicSourceNotSupported")}</p>;
                                return (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                                        {options.map((o) => (
                                            <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-[#191c1e]">
                                                <input
                                                    type="radio"
                                                    name={field.fieldKey}
                                                    checked={raw === o.value}
                                                    onChange={() => setValue(field.fieldKey, o.value)}
                                                    disabled={isDisabled}
                                                />
                                                {o.label}
                                            </label>
                                        ))}
                                    </div>
                                );
                            })()}

                        {field.dataType === FieldDataType.MultiSelect &&
                            (() => {
                                const options = parseOptions(field.optionsJson);
                                const selected = Array.isArray(raw) ? (raw as JsonValue[]).map(String) : [];
                                if (options.length === 0) return <p className="py-2 text-xs italic text-[#8a8f94]">{t("dynamicSourceNotSupported")}</p>;
                                return (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                                        {options.map((o) => (
                                            <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-[#191c1e]">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(o.value)}
                                                    onChange={(e) =>
                                                        setValue(
                                                            field.fieldKey,
                                                            e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value)
                                                        )
                                                    }
                                                    disabled={isDisabled}
                                                />
                                                {o.label}
                                            </label>
                                        ))}
                                    </div>
                                );
                            })()}

                        {field.dataType === FieldDataType.Checkbox && (
                            <div className="pt-1.5">
                                <input
                                    type="checkbox"
                                    checked={raw === true}
                                    onChange={(e) => setValue(field.fieldKey, e.target.checked)}
                                    disabled={isDisabled}
                                    className="h-4 w-4"
                                />
                            </div>
                        )}

                        {field.dataType === FieldDataType.Employee && (
                            <SearchableSelect
                                options={employeeOptions}
                                value={raw && typeof raw === "object" && "id" in raw ? (raw.id as number) : ""}
                                onChange={(v) => setValue(field.fieldKey, v === "" ? null : { id: v })}
                                placeholder={t("selectPlaceholder")}
                                disabled={isDisabled}
                            />
                        )}

                        {field.dataType === FieldDataType.OrgUnit && (
                            <SearchableSelect
                                options={orgUnitOptions}
                                value={raw && typeof raw === "object" && "id" in raw ? (raw.id as number) : ""}
                                onChange={(v) => setValue(field.fieldKey, v === "" ? null : { id: v })}
                                placeholder={t("selectPlaceholder")}
                                disabled={isDisabled}
                            />
                        )}

                        {field.helpTextVn && <p className="mt-1 text-xs text-[#8a8f94]">{field.helpTextVn}</p>}
                    </label>
                );
            })}
        </div>
    );
}
