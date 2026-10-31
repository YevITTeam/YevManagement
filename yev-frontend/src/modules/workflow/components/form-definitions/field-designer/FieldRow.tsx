"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";
import { COLUMN_SPAN_CLASS, inputClassName, parseOptions } from "@/modules/workflow/components/requests/DynamicFormRenderer";
import type { EditableField } from "./editableField";
import { FIELD_TYPE_META } from "./fieldTypeMeta";

interface FieldRowProps {
    field: EditableField;
    onEdit: () => void;
    onDelete: () => void;
}

// Static disabled preview mirroring each dataType branch of DynamicFormRenderer.tsx; keep them in sync.
function FieldPreviewControl({ field, t }: { field: EditableField; t: ReturnType<typeof useTranslations> }) {
    switch (field.dataType) {
        case FieldDataType.Text:
            return <input type="text" disabled placeholder={field.placeholder ?? undefined} className={inputClassName} />;
        case FieldDataType.TextArea:
            return <textarea disabled rows={2} placeholder={field.placeholder ?? undefined} className={`${inputClassName} h-auto resize-none py-2`} />;
        case FieldDataType.Number:
        case FieldDataType.Decimal:
            return <input type="number" disabled placeholder={field.placeholder ?? undefined} className={inputClassName} />;
        case FieldDataType.Date:
            return <input type="date" disabled className={inputClassName} />;
        case FieldDataType.DateTime:
            return <input type="datetime-local" disabled className={inputClassName} />;
        case FieldDataType.Time:
            return <input type="time" disabled className={inputClassName} />;
        case FieldDataType.Dropdown: {
            const options = parseOptions(field.optionsJson);
            return (
                <select disabled defaultValue="" className={inputClassName}>
                    <option value="">{t("fieldPreviewSelectPlaceholder")}</option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            );
        }
        case FieldDataType.Radio:
        case FieldDataType.MultiSelect: {
            const options = parseOptions(field.optionsJson);
            if (options.length === 0) return <p className="py-2 text-xs italic text-[#8a8f94]">{t("fieldPreviewNoOptions")}</p>;
            return (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                    {options.map((o) => (
                        <label key={o.value} className="flex items-center gap-1.5 text-sm text-[#191c1e]">
                            <input type={field.dataType === FieldDataType.Radio ? "radio" : "checkbox"} disabled />
                            {o.label}
                        </label>
                    ))}
                </div>
            );
        }
        case FieldDataType.Checkbox:
            return (
                <div className="pt-1.5">
                    <input type="checkbox" disabled className="h-4 w-4" />
                </div>
            );
        case FieldDataType.Employee:
            return <input type="text" disabled placeholder={t("accessTargetPlaceholderEmployee")} className={inputClassName} />;
        case FieldDataType.OrgUnit:
            return <input type="text" disabled placeholder={t("accessTargetPlaceholderOrgUnit")} className={inputClassName} />;
        default:
            return null;
    }
}

export default function FieldRow({ field, onEdit, onDelete }: FieldRowProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.clientId });
    const meta = FIELD_TYPE_META[field.dataType];

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`${COLUMN_SPAN_CLASS[field.columnSpan] ?? COLUMN_SPAN_CLASS[1]} rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm transition ${
                isDragging ? "opacity-50" : "hover:border-[#e3000f]"
            }`}
        >
            <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-[#f1f5f9] pb-1.5">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="flex min-w-0 cursor-grab items-center gap-1 text-[10px] font-medium text-[#8a8f94] hover:text-[#5e3f3a] active:cursor-grabbing"
                    aria-label={t("dragHandle")}
                >
                    <GripVertical className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                        {field.fieldKey} · {t(meta.labelKey)} · {t("colSpanShort", { span: field.columnSpan })}
                    </span>
                </button>

                <div className="flex shrink-0 items-center gap-0.5">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] hover:bg-[#f2f4f6]"
                        aria-label={t("editField")}
                    >
                        <Pencil className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#930006] hover:bg-[#fff4f2]"
                        aria-label={t("deleteField")}
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {field.dataType === FieldDataType.Label ? (
                <div>
                    <p className="text-sm font-semibold text-[#191c1e]">{field.labelVn || <em className="text-[#8a8f94]">{t("fieldPreviewLabelEmpty")}</em>}</p>
                    {field.helpTextVn && <p className="mt-0.5 text-xs text-[#8a8f94]">{field.helpTextVn}</p>}
                </div>
            ) : (
                <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-[#8a8f94]">
                        {field.labelVn}
                        {field.isRequired && <span className="text-[#e3000f]">*</span>}
                    </span>
                    <FieldPreviewControl field={field} t={t} />
                </label>
            )}
        </div>
    );
}
