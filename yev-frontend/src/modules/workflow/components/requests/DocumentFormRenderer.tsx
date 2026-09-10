"use client";

import { useMemo } from "react";
import parse, { Element, type HTMLReactParserOptions } from "html-react-parser";
import { useTranslations } from "next-intl";
import type { FormFieldDto } from "@/modules/workflow/types/form-field.dto";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";
import type { FormFieldConditionDto } from "@/modules/workflow/types/form-field-condition.dto";
import type { JsonValue } from "@/modules/workflow/types/workflow-request.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { parseOptions, inputClassName, evaluateFlags, toDateTimeLocalValue } from "./DynamicFormRenderer";

interface DocumentFormRendererProps {
    layoutHtml: string;
    fields: FormFieldDto[];
    conditions: FormFieldConditionDto[];
    value: Record<string, JsonValue>;
    onChange: (next: Record<string, JsonValue>) => void;
    disabled?: boolean;
    employeeOptions: SelectOption[];
    orgUnitOptions: SelectOption[];
}

const wrapperClassName = "mx-1 inline-block align-middle";

// Chế độ tài liệu (workflow-module.md §1.5) — field đặt ngay trong layout .docx đã nhập, vị trí lấy
// từ <span data-field-key> thay vì SortOrder+ColumnSpan. Input control TÁI DÙNG parseOptions/
// inputClassName/evaluateFlags/toDateTimeLocalValue từ DynamicFormRenderer.tsx (chế độ lưới) để 2
// chế độ luôn khớp behavior — chỉ khác chỗ không bọc label/help-text vì nhãn đã là chữ có sẵn trong
// văn bản gốc.
export default function DocumentFormRenderer({
    layoutHtml,
    fields,
    conditions,
    value,
    onChange,
    disabled,
    employeeOptions,
    orgUnitOptions,
}: DocumentFormRendererProps) {
    const t = useTranslations("Workflow.WorkflowRequest");
    const fieldsByKey = useMemo(() => new Map(fields.map((f) => [f.fieldKey, f])), [fields]);
    const flags = useMemo(() => evaluateFlags(fields, conditions, value), [fields, conditions, value]);

    const setValue = (fieldKey: string, v: JsonValue) => onChange({ ...value, [fieldKey]: v });

    function renderControl(field: FormFieldDto, raw: JsonValue, isDisabled: boolean) {
        switch (field.dataType) {
            case FieldDataType.Text:
                return (
                    <span className={`${wrapperClassName} min-w-[10rem] max-w-full`}>
                        <input
                            type="text"
                            value={typeof raw === "string" ? raw : ""}
                            onChange={(e) => setValue(field.fieldKey, e.target.value)}
                            placeholder={field.placeholder ?? undefined}
                            maxLength={field.maxLength ?? undefined}
                            disabled={isDisabled}
                            className={inputClassName}
                        />
                    </span>
                );

            case FieldDataType.TextArea:
                return (
                    <span className={`${wrapperClassName} w-full min-w-[16rem]`}>
                        <textarea
                            value={typeof raw === "string" ? raw : ""}
                            onChange={(e) => setValue(field.fieldKey, e.target.value)}
                            placeholder={field.placeholder ?? undefined}
                            maxLength={field.maxLength ?? undefined}
                            disabled={isDisabled}
                            rows={2}
                            className={`${inputClassName} h-auto resize-y py-2`}
                        />
                    </span>
                );

            case FieldDataType.Number:
            case FieldDataType.Decimal:
                return (
                    <span className={`${wrapperClassName} min-w-[6rem] max-w-[10rem]`}>
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
                    </span>
                );

            case FieldDataType.Date:
                return (
                    <span className={`${wrapperClassName} min-w-[9rem]`}>
                        <input
                            type="date"
                            value={typeof raw === "string" ? raw : ""}
                            onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : e.target.value)}
                            disabled={isDisabled}
                            className={inputClassName}
                        />
                    </span>
                );

            case FieldDataType.DateTime:
                return (
                    <span className={`${wrapperClassName} min-w-[12rem]`}>
                        <input
                            type="datetime-local"
                            value={toDateTimeLocalValue(typeof raw === "string" ? raw : null)}
                            onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : new Date(e.target.value).toISOString())}
                            disabled={isDisabled}
                            className={inputClassName}
                        />
                    </span>
                );

            case FieldDataType.Time:
                return (
                    <span className={`${wrapperClassName} min-w-[8rem]`}>
                        <input
                            type="time"
                            value={typeof raw === "string" ? raw : ""}
                            onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : e.target.value)}
                            disabled={isDisabled}
                            className={inputClassName}
                        />
                    </span>
                );

            case FieldDataType.Dropdown: {
                const opts = parseOptions(field.optionsJson);
                if (opts.length === 0 && field.formDataSourceId) {
                    return <span className="text-xs italic text-[#8a8f94]">{t("dynamicSourceNotSupported")}</span>;
                }
                return (
                    <span className={`${wrapperClassName} min-w-[10rem]`}>
                        <select
                            value={typeof raw === "string" ? raw : ""}
                            onChange={(e) => setValue(field.fieldKey, e.target.value === "" ? null : e.target.value)}
                            disabled={isDisabled}
                            className={inputClassName}
                        >
                            <option value="">{t("selectPlaceholder")}</option>
                            {opts.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </span>
                );
            }

            case FieldDataType.Radio: {
                const opts = parseOptions(field.optionsJson);
                if (opts.length === 0) return <span className="text-xs italic text-[#8a8f94]">{t("dynamicSourceNotSupported")}</span>;
                return (
                    <span className={`${wrapperClassName} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                        {opts.map((o) => (
                            <label key={o.value} className="flex cursor-pointer items-center gap-1 text-sm text-[#191c1e]">
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
                    </span>
                );
            }

            case FieldDataType.MultiSelect: {
                const opts = parseOptions(field.optionsJson);
                const selected = Array.isArray(raw) ? (raw as JsonValue[]).map(String) : [];
                if (opts.length === 0) return <span className="text-xs italic text-[#8a8f94]">{t("dynamicSourceNotSupported")}</span>;
                return (
                    <span className={`${wrapperClassName} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                        {opts.map((o) => (
                            <label key={o.value} className="flex cursor-pointer items-center gap-1 text-sm text-[#191c1e]">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(o.value)}
                                    onChange={(e) =>
                                        setValue(field.fieldKey, e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))
                                    }
                                    disabled={isDisabled}
                                />
                                {o.label}
                            </label>
                        ))}
                    </span>
                );
            }

            case FieldDataType.Checkbox:
                return (
                    <span className="mx-1 inline-flex align-middle">
                        <input
                            type="checkbox"
                            checked={raw === true}
                            onChange={(e) => setValue(field.fieldKey, e.target.checked)}
                            disabled={isDisabled}
                            className="h-4 w-4"
                        />
                    </span>
                );

            case FieldDataType.Employee:
                return (
                    <span className={`${wrapperClassName} min-w-[14rem]`}>
                        <SearchableSelect
                            options={employeeOptions}
                            value={raw && typeof raw === "object" && "id" in raw ? (raw.id as number) : ""}
                            onChange={(v) => setValue(field.fieldKey, v === "" ? null : { id: v })}
                            placeholder={t("selectPlaceholder")}
                            disabled={isDisabled}
                        />
                    </span>
                );

            case FieldDataType.OrgUnit:
                return (
                    <span className={`${wrapperClassName} min-w-[14rem]`}>
                        <SearchableSelect
                            options={orgUnitOptions}
                            value={raw && typeof raw === "object" && "id" in raw ? (raw.id as number) : ""}
                            onChange={(v) => setValue(field.fieldKey, v === "" ? null : { id: v })}
                            placeholder={t("selectPlaceholder")}
                            disabled={isDisabled}
                        />
                    </span>
                );

            default:
                return null;
        }
    }

    const parserOptions: HTMLReactParserOptions = {
        replace: (domNode) => {
            if (!(domNode instanceof Element) || domNode.name !== "span") return undefined;
            const fieldKey = domNode.attribs?.["data-field-key"];
            if (!fieldKey) return undefined;
            const field = fieldsByKey.get(fieldKey);
            if (!field || field.dataType === FieldDataType.Label) return undefined;

            const flag = flags.get(field.id) ?? { visible: field.defaultVisible, required: field.isRequired, readOnly: field.isReadOnly };
            if (!flag.visible) return <span />;

            const isDisabled = disabled || flag.readOnly;
            const raw = value[field.fieldKey] ?? null;
            return renderControl(field, raw, isDisabled);
        },
    };

    return <div className="workflow-document-canvas text-sm text-[#191c1e]">{parse(layoutHtml, parserOptions)}</div>;
}
