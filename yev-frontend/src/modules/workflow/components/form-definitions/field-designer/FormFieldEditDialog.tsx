"use client";

import { useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EditableField } from "./editableField";
import { FIELD_TYPES_WITH_OPTIONS, FIELD_TYPES_WITH_MINMAX, FIELD_TYPES_WITH_MAXLENGTH } from "./fieldTypeMeta";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { FormDataSourceApi } from "@/modules/workflow/api/form-data-source.api";
import type { FormDataSourceDto } from "@/modules/workflow/types/form-data-source.dto";
import { toast } from "react-toastify";

interface OptionRow {
    value: string;
    label: string;
}

interface FormFieldEditDialogProps {
    field: EditableField;
    // fieldKey (lowercased) of every OTHER field on this form — used to reject a rename that would
    // collide with another field's key.
    existingFieldKeys: string[];
    onClose: () => void;
    onSave: (updated: EditableField) => void;
    // true ở chế độ tài liệu (workflow-module.md §1.5) — ColumnSpan không có tác dụng khi vị trí field
    // đã nằm sẵn trong layoutHtml, ẩn đi để khỏi gây hiểu lầm.
    hideColumnSpan?: boolean;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

function parseOptions(json: string | null): OptionRow[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            return parsed.map((x) => ({ value: String(x.value ?? ""), label: String(x.label ?? "") }));
        }
    } catch {
        // JSON hỏng (vd sửa tay từ ngoài) — coi như rỗng, không chặn mở dialog.
    }
    return [];
}

// Sửa chi tiết 1 field trong bộ nhớ cục bộ — KHÔNG gọi API, chỉ trả field đã sửa về cho FieldCanvas.
// Trường hiện thêm tuỳ DataType: Dropdown/Radio/MultiSelect có bảng Options + chọn FormDataSource
// thay thế; Number/Decimal có Min/Max; Text/TextArea có MaxLength.
export default function FormFieldEditDialog({ field, existingFieldKeys, onClose, onSave, hideColumnSpan }: FormFieldEditDialogProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const tCommon = useTranslations("Common");

    const [values, setValues] = useState<EditableField>(field);
    const [options, setOptions] = useState<OptionRow[]>(() => parseOptions(field.optionsJson));
    const [dataSources, setDataSources] = useState<FormDataSourceDto[]>([]);

    useFetchEffect(
        () => FormDataSourceApi.getAllFormDataSources(),
        [],
        (result) => setDataSources(result),
        t("loadDataSourcesError"),
        (message) => toast.error(message)
    );

    const hasOptions = FIELD_TYPES_WITH_OPTIONS.has(values.dataType);
    const hasMinMax = FIELD_TYPES_WITH_MINMAX.has(values.dataType);
    const hasMaxLength = FIELD_TYPES_WITH_MAXLENGTH.has(values.dataType);

    const usableDataSources = useMemo(() => dataSources, [dataSources]);

    const addOptionRow = () => setOptions((current) => [...current, { value: "", label: "" }]);
    const removeOptionRow = (index: number) => setOptions((current) => current.filter((_, i) => i !== index));
    const updateOptionRow = (index: number, patch: Partial<OptionRow>) =>
        setOptions((current) => current.map((o, i) => (i === index ? { ...o, ...patch } : o)));

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedFieldKey = values.fieldKey.trim();
        if (!trimmedFieldKey || !values.labelVn.trim()) return;
        if (existingFieldKeys.includes(trimmedFieldKey.toLowerCase())) {
            toast.error(t("fieldKeyDuplicate"));
            return;
        }

        const optionsJson = hasOptions && options.length > 0 ? JSON.stringify(options.filter((o) => o.value.trim())) : hasOptions ? "[]" : null;

        onSave({
            ...values,
            fieldKey: trimmedFieldKey,
            labelVn: values.labelVn.trim(),
            labelJp: values.labelJp?.trim() ? values.labelJp.trim() : null,
            placeholder: values.placeholder?.trim() ? values.placeholder.trim() : null,
            defaultValue: values.defaultValue?.trim() ? values.defaultValue.trim() : null,
            helpTextVn: values.helpTextVn?.trim() ? values.helpTextVn.trim() : null,
            autoNumberPattern: values.autoNumberPattern?.trim() ? values.autoNumberPattern.trim() : null,
            optionsJson,
            formDataSourceId: hasOptions ? values.formDataSourceId : null,
            minValue: hasMinMax ? values.minValue : null,
            maxValue: hasMinMax ? values.maxValue : null,
            maxLength: hasMaxLength ? values.maxLength : null,
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-field-edit-title"
                className="z-[61] mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="form-field-edit-title" className="text-lg font-semibold text-[#191c1e]">
                        {t("editFieldTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <div className={hideColumnSpan ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldFieldKey")}</span>
                            <input
                                value={values.fieldKey}
                                onChange={(event) => setValues((current) => ({ ...current, fieldKey: event.target.value }))}
                                placeholder={t("fieldFieldKeyPlaceholder")}
                                required
                                autoFocus
                                className={fieldClassName}
                            />
                        </label>

                        {!hideColumnSpan && (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldColumnSpan")}</span>
                                <select
                                    value={values.columnSpan}
                                    onChange={(event) => setValues((current) => ({ ...current, columnSpan: Number(event.target.value) }))}
                                    className={fieldClassName}
                                >
                                    <option value={1}>{t("columnSpan1")}</option>
                                    <option value={2}>{t("columnSpan2")}</option>
                                    <option value={3}>{t("columnSpan3")}</option>
                                </select>
                            </label>
                        )}
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldLabelVn")}</span>
                        <input
                            value={values.labelVn}
                            onChange={(event) => setValues((current) => ({ ...current, labelVn: event.target.value }))}
                            placeholder={t("fieldLabelVnPlaceholder")}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldLabelJp")}</span>
                        <input
                            value={values.labelJp ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, labelJp: event.target.value }))}
                            placeholder={t("fieldLabelJpPlaceholder")}
                            className={fieldClassName}
                        />
                    </label>

                    <div className="flex gap-6">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={values.isRequired}
                                onChange={(event) => setValues((current) => ({ ...current, isRequired: event.target.checked }))}
                                className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                            />
                            {t("fieldIsRequired")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={values.defaultVisible}
                                onChange={(event) => setValues((current) => ({ ...current, defaultVisible: event.target.checked }))}
                                className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                            />
                            {t("fieldDefaultVisible")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={values.isReadOnly}
                                onChange={(event) => setValues((current) => ({ ...current, isReadOnly: event.target.checked }))}
                                className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                            />
                            {t("fieldIsReadOnly")}
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldPlaceholder")}</span>
                        <input
                            value={values.placeholder ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, placeholder: event.target.value }))}
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldDefaultValue")}</span>
                        <input
                            value={values.defaultValue ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, defaultValue: event.target.value }))}
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldHelpText")}</span>
                        <input
                            value={values.helpTextVn ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, helpTextVn: event.target.value }))}
                            className={fieldClassName}
                        />
                    </label>

                    {hasMaxLength && (
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldMaxLength")}</span>
                            <input
                                type="number"
                                value={values.maxLength ?? ""}
                                onChange={(event) =>
                                    setValues((current) => ({ ...current, maxLength: event.target.value ? Number(event.target.value) : null }))
                                }
                                className={fieldClassName}
                            />
                        </label>
                    )}

                    {hasMinMax && (
                        <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldMinValue")}</span>
                                <input
                                    type="number"
                                    value={values.minValue ?? ""}
                                    onChange={(event) =>
                                        setValues((current) => ({ ...current, minValue: event.target.value ? Number(event.target.value) : null }))
                                    }
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldMaxValue")}</span>
                                <input
                                    type="number"
                                    value={values.maxValue ?? ""}
                                    onChange={(event) =>
                                        setValues((current) => ({ ...current, maxValue: event.target.value ? Number(event.target.value) : null }))
                                    }
                                    className={fieldClassName}
                                />
                            </label>
                        </div>
                    )}

                    {hasOptions && (
                        <div className="space-y-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
                            <div className="flex items-center justify-between">
                                <span className={fieldLabelClassName}>{t("fieldOptions")}</span>
                                <button
                                    type="button"
                                    onClick={addOptionRow}
                                    className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#5e3f3a] hover:text-[#191c1e]"
                                >
                                    <Plus className="h-3 w-3" /> {t("addOption")}
                                </button>
                            </div>
                            {options.length === 0 && <p className="text-xs text-[#8a8f94]">{t("noOptions")}</p>}
                            {options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        value={option.value}
                                        onChange={(event) => updateOptionRow(index, { value: event.target.value })}
                                        placeholder={t("optionValuePlaceholder")}
                                        className="h-9 w-1/3 rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm outline-none focus:border-[#e3000f]"
                                    />
                                    <input
                                        value={option.label}
                                        onChange={(event) => updateOptionRow(index, { label: event.target.value })}
                                        placeholder={t("optionLabelPlaceholder")}
                                        className="h-9 flex-1 rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm outline-none focus:border-[#e3000f]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeOptionRow(index)}
                                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#930006] hover:bg-[#fff4f2]"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}

                            <label className="block pt-2">
                                <span className={fieldLabelClassName}>{t("fieldFormDataSource")}</span>
                                <select
                                    value={values.formDataSourceId ?? 0}
                                    onChange={(event) =>
                                        setValues((current) => ({
                                            ...current,
                                            formDataSourceId: Number(event.target.value) === 0 ? null : Number(event.target.value),
                                        }))
                                    }
                                    className={fieldClassName}
                                >
                                    <option value={0}>{t("fieldFormDataSourceNone")}</option>
                                    {usableDataSources.map((ds) => (
                                        <option key={ds.id} value={ds.id}>
                                            {ds.nameVn}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-[#8a8f94]">{t("fieldFormDataSourceNote")}</p>
                            </label>
                        </div>
                    )}

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldAutoNumberPattern")}</span>
                        <input
                            value={values.autoNumberPattern ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, autoNumberPattern: event.target.value }))}
                            placeholder={t("fieldAutoNumberPatternPlaceholder")}
                            className={fieldClassName}
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            {tCommon("save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
