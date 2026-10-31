"use client";

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCenter,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import FieldPalette from "./FieldPalette";
import FieldRow from "./FieldRow";
import FormFieldEditDialog from "./FormFieldEditDialog";
import { type EditableField, createDefaultField } from "./editableField";
import { FIELD_TYPE_META } from "./fieldTypeMeta";
import type { FieldDataType } from "@/modules/workflow/types/form-field.dto";

interface FieldCanvasProps {
    fields: EditableField[];
    onChange: (fields: EditableField[]) => void;
}

const EMPTY_DROP_ID = "canvas-empty";

function EmptyDropZone() {
    const t = useTranslations("Workflow.FormDefinition");
    const { setNodeRef, isOver } = useDroppable({ id: EMPTY_DROP_ID });

    return (
        <div
            ref={setNodeRef}
            className={`flex min-h-[160px] items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition ${
                isOver ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]" : "border-[#e0e3e5] text-[#8a8f94]"
            }`}
        >
            {t("dropZonePlaceholder")}
        </div>
    );
}

// Two drag sources: palette (id "palette-{dataType}", adds a field) and canvas (clientId, reorders). No autosave.
export default function FieldCanvas({ fields, onChange }: FieldCanvasProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragStart = (event: DragStartEvent) => {
        const id = event.active.id.toString();
        if (id.startsWith("palette-")) {
            const dataType = Number(id.replace("palette-", ""));
            setActiveDragLabel(t(FIELD_TYPE_META[dataType]?.labelKey ?? ""));
        } else {
            const field = fields.find((f) => f.clientId === id);
            setActiveDragLabel(field?.labelVn ?? null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragLabel(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        if (activeId.startsWith("palette-")) {
            const dataType = Number(activeId.replace("palette-", "")) as FieldDataType;
            const defaultLabel = t(FIELD_TYPE_META[dataType]?.labelKey ?? "");
            const newField = createDefaultField(dataType, fields, defaultLabel);

            const insertAt = overId === EMPTY_DROP_ID ? fields.length : fields.findIndex((f) => f.clientId === overId);
            const next = [...fields];
            next.splice(insertAt === -1 ? fields.length : insertAt, 0, newField);
            onChange(next);
            setEditingClientId(newField.clientId);
            return;
        }

        if (activeId === overId) return;
        const oldIndex = fields.findIndex((f) => f.clientId === activeId);
        const newIndex = fields.findIndex((f) => f.clientId === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        onChange(arrayMove(fields, oldIndex, newIndex));
    };

    const editingField = fields.find((f) => f.clientId === editingClientId) ?? null;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-6">
                <FieldPalette />

                <div className="min-w-0 flex-1">
                    {fields.length === 0 ? (
                        <EmptyDropZone />
                    ) : (
                        // grid-cols-3 matches DynamicFormRenderer so columnSpan previews the real form layout.
                        <SortableContext items={fields.map((f) => f.clientId)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-3 gap-3">
                                {fields.map((field) => (
                                    <FieldRow
                                        key={field.clientId}
                                        field={field}
                                        onEdit={() => setEditingClientId(field.clientId)}
                                        onDelete={() => onChange(fields.filter((f) => f.clientId !== field.clientId))}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    )}
                </div>
            </div>

            <DragOverlay>
                {activeDragLabel && (
                    <div className="rounded-lg border border-[#e3000f] bg-white px-3 py-2.5 text-sm font-semibold text-[#191c1e] shadow-lg">
                        {activeDragLabel}
                    </div>
                )}
            </DragOverlay>

            {editingField && (
                <FormFieldEditDialog
                    field={editingField}
                    existingFieldKeys={fields.filter((f) => f.clientId !== editingField.clientId).map((f) => f.fieldKey.toLowerCase())}
                    onClose={() => setEditingClientId(null)}
                    onSave={(updated) => {
                        onChange(fields.map((f) => (f.clientId === updated.clientId ? updated : f)));
                        setEditingClientId(null);
                    }}
                />
            )}
        </DndContext>
    );
}
