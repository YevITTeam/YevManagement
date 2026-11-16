"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { FIELD_TYPE_META, PALETTE_ORDER } from "./fieldTypeMeta";

function PaletteItem({ dataType }: { dataType: number }) {
    const t = useTranslations("Workflow.FormDefinition");
    const meta = FIELD_TYPE_META[dataType];
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `palette-${dataType}`,
        data: { source: "palette", dataType },
    });
    const Icon = meta.icon;

    return (
        <button
            ref={setNodeRef}
            type="button"
            {...listeners}
            {...attributes}
            className={`flex w-full min-w-0 cursor-grab items-center gap-2.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-left text-sm text-[#191c1e] transition hover:border-[#e3000f] hover:bg-[#fff4f2] active:cursor-grabbing ${
                isDragging ? "opacity-40" : ""
            }`}
        >
            <Icon className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
            <span className="truncate">{t(meta.labelKey)}</span>
        </button>
    );
}

export default function FieldPalette() {
    const t = useTranslations("Workflow.FormDefinition");

    return (
        // Sticky on desktop so the palette stays in reach while dropping into a long canvas.
        <div className="space-y-3 lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("paletteTitle")}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                {PALETTE_ORDER.map((dataType) => (
                    <PaletteItem key={dataType} dataType={dataType} />
                ))}
            </div>
        </div>
    );
}
