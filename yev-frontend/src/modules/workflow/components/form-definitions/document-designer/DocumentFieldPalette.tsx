"use client";

import { useTranslations } from "next-intl";
import { FIELD_TYPE_META, PALETTE_ORDER } from "../field-designer/fieldTypeMeta";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";

// DocumentFieldCanvas reads this key. Native HTML5 drag-drop (not @dnd-kit) because the drop
// target is free text (contentEditable + caretRangeFromPoint), not a sortable list.
export const DOCUMENT_FIELD_TYPE_DRAG_KEY = "application/x-workflow-field-type";

// Label is omitted in document mode: labels are already text in the Word source.
const DOCUMENT_PALETTE_ORDER = PALETTE_ORDER.filter((dataType) => dataType !== FieldDataType.Label);

function PaletteItem({ dataType }: { dataType: number }) {
    const t = useTranslations("Workflow.FormDefinition");
    const meta = FIELD_TYPE_META[dataType];
    const Icon = meta.icon;

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData(DOCUMENT_FIELD_TYPE_DRAG_KEY, String(dataType));
                e.dataTransfer.effectAllowed = "copy";
            }}
            className="flex w-full min-w-0 cursor-grab items-center gap-2.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-left text-sm text-[#191c1e] transition hover:border-[#e3000f] hover:bg-[#fff4f2] active:cursor-grabbing"
        >
            <Icon className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
            <span className="truncate">{t(meta.labelKey)}</span>
        </div>
    );
}

export default function DocumentFieldPalette() {
    const t = useTranslations("Workflow.FormDefinition");

    return (
        <div className="space-y-3 lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("paletteTitle")}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                {DOCUMENT_PALETTE_ORDER.map((dataType) => (
                    <PaletteItem key={dataType} dataType={dataType} />
                ))}
            </div>
        </div>
    );
}
