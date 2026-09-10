"use client";

import { useRef, useState } from "react";
import { Save, FileInput, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import FieldCanvas from "./FieldCanvas";
import FormFieldEditDialog from "./FormFieldEditDialog";
import { fromFormFieldDto, type EditableField } from "./editableField";
import DocumentFieldPalette from "../document-designer/DocumentFieldPalette";
import DocumentFieldCanvas, { type DocumentFieldCanvasHandle, type DocumentCanvasInitialContent } from "../document-designer/DocumentFieldCanvas";
import DocumentImportDropzone from "../document-designer/DocumentImportDropzone";
import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";

interface FormFieldDesignerProps {
    formDefinitionId: number;
    // Layout .docx đã lưu của form (workflow-module.md §1.5) — NULL = chế độ lưới hiện tại.
    layoutHtml: string | null;
    // Gọi lại sau khi lưu/xoá layout để FormDefinitionDetail nạp lại FormDefinitionDto (badge/chế độ
    // hiển thị đúng ngay cả khi component này không unmount).
    onLayoutChange: () => void;
}

function toReplaceItems(fields: EditableField[]) {
    return fields.map((field) => ({
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
    }));
}

export default function FormFieldDesigner({ formDefinitionId, layoutHtml, onLayoutChange }: FormFieldDesignerProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [fields, setFields] = useState<EditableField[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingDocxBytes, setPendingDocxBytes] = useState<ArrayBuffer | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isClearLayoutConfirmOpen, setIsClearLayoutConfirmOpen] = useState(false);
    const [isClearingLayout, setIsClearingLayout] = useState(false);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const documentCanvasRef = useRef<DocumentFieldCanvasHandle>(null);

    const { isLoading, error } = useFetchEffect(
        () => FormDefinitionApi.getFields(formDefinitionId),
        [formDefinitionId],
        (result) => setFields(result.map(fromFormFieldDto)),
        t("loadFieldsError"),
        (message) => toast.error(message)
    );

    const documentContent: DocumentCanvasInitialContent | null = pendingDocxBytes
        ? { type: "docx", bytes: pendingDocxBytes }
        : layoutHtml
          ? { type: "html", html: layoutHtml }
          : null;
    const isDocumentMode = documentContent !== null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (isDocumentMode) {
                const orderedKeys = documentCanvasRef.current?.getOrderedFieldKeys() ?? [];
                const orderedFields = [...fields].sort((a, b) => orderedKeys.indexOf(a.fieldKey) - orderedKeys.indexOf(b.fieldKey));
                const savedFields = await FormDefinitionApi.replaceFields(formDefinitionId, toReplaceItems(orderedFields));
                setFields(savedFields.map(fromFormFieldDto));

                const html = documentCanvasRef.current?.getHtml() ?? "";
                await FormDefinitionApi.updateLayout(formDefinitionId, html);
                setPendingDocxBytes(null);
                onLayoutChange();
            } else {
                const savedFields = await FormDefinitionApi.replaceFields(formDefinitionId, toReplaceItems(fields));
                setFields(savedFields.map(fromFormFieldDto));
            }
            toast.success(t("saveFieldsSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveFieldsError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearLayout = async () => {
        setIsClearingLayout(true);
        try {
            await FormDefinitionApi.updateLayout(formDefinitionId, null);
            setPendingDocxBytes(null);
            setIsClearLayoutConfirmOpen(false);
            onLayoutChange();
            toast.success(t("clearLayoutSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("clearLayoutError")));
        } finally {
            setIsClearingLayout(false);
        }
    };

    if (isLoading) {
        return <Skeleton className="h-40 w-full" />;
    }

    if (error) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    const editingField = fields.find((f) => f.clientId === editingClientId) ?? null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[#5e3f3a]">{isDocumentMode ? t("documentFieldsHint") : t("fieldsHint")}</p>
                <div className="flex items-center gap-2">
                    {!isDocumentMode && (
                        <button
                            type="button"
                            onClick={() => setIsImportOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <FileInput className="h-3.5 w-3.5" /> {t("importDocxAction")}
                        </button>
                    )}
                    {isDocumentMode && (
                        <button
                            type="button"
                            onClick={() => setIsClearLayoutConfirmOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> {t("clearLayoutAction")}
                        </button>
                    )}
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

            {isDocumentMode && documentContent ? (
                <div className="flex gap-6">
                    <DocumentFieldPalette />
                    <div className="min-w-0 flex-1">
                        <DocumentFieldCanvas
                            ref={documentCanvasRef}
                            initialContent={documentContent}
                            fields={fields}
                            onFieldsChange={setFields}
                            onFieldClick={setEditingClientId}
                        />
                    </div>
                </div>
            ) : (
                <FieldCanvas fields={fields} onChange={setFields} />
            )}

            {isDocumentMode && editingField && (
                <FormFieldEditDialog
                    field={editingField}
                    hideColumnSpan
                    onClose={() => setEditingClientId(null)}
                    onSave={(updated) => {
                        setFields((prev) => prev.map((f) => (f.clientId === updated.clientId ? updated : f)));
                        setEditingClientId(null);
                    }}
                />
            )}

            {isImportOpen && (
                <DocumentImportDropzone
                    onClose={() => setIsImportOpen(false)}
                    onImported={(bytes) => {
                        setPendingDocxBytes(bytes);
                        setIsImportOpen(false);
                    }}
                />
            )}

            <ConfirmDialog
                isOpen={isClearLayoutConfirmOpen}
                title={t("clearLayoutConfirmTitle")}
                message={t("clearLayoutConfirmMessage")}
                approveLabel={t("clearLayoutAction")}
                loading={isClearingLayout}
                onApprove={handleClearLayout}
                onDenied={() => {
                    if (!isClearingLayout) setIsClearLayoutConfirmOpen(false);
                }}
            />
        </div>
    );
}
