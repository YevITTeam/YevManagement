"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import FieldCanvas from "./FieldCanvas";
import { fromFormFieldDto, type EditableField } from "./editableField";
import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";

interface FormFieldDesignerProps {
    formDefinitionId: number;
}

export default function FormFieldDesigner({ formDefinitionId }: FormFieldDesignerProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [fields, setFields] = useState<EditableField[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        () => FormDefinitionApi.getFields(formDefinitionId),
        [formDefinitionId],
        (result) => setFields(result.map(fromFormFieldDto)),
        t("loadFieldsError"),
        (message) => toast.error(message)
    );

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await FormDefinitionApi.replaceFields(
                formDefinitionId,
                fields.map((field) => ({
                    id: field.id,
                    fieldKey: field.fieldKey,
                    labelVn: field.labelVn,
                    labelJp: field.labelJp,
                    dataType: field.dataType,
                    isRequired: field.isRequired,
                    columnSpan: field.columnSpan,
                    placeholder: field.placeholder,
                    defaultValue: field.defaultValue,
                    optionsJson: field.optionsJson,
                    minValue: field.minValue,
                    maxValue: field.maxValue,
                    maxLength: field.maxLength,
                    helpTextVn: field.helpTextVn,
                    formDataSourceId: field.formDataSourceId,
                    autoNumberPattern: field.autoNumberPattern,
                    defaultVisible: field.defaultVisible,
                    isReadOnly: field.isReadOnly,
                }))
            );
            setFields(result.map(fromFormFieldDto));
            toast.success(t("saveFieldsSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveFieldsError")));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="py-10 text-center text-sm text-[#5e3f3a]">{t("loading")}</div>;
    }

    if (error) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[#5e3f3a]">{t("fieldsHint")}</p>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save className="h-3.5 w-3.5" /> {isSaving ? t("saving") : t("saveChanges")}
                </button>
            </div>

            <FieldCanvas fields={fields} onChange={setFields} />
        </div>
    );
}
