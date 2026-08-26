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
            className={`flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2.5 text-left text-sm text-[#191c1e] transition hover:border-[#e3000f] hover:bg-[#fff4f2] active:cursor-grabbing ${
                isDragging ? "opacity-40" : ""
            }`}
        >
            <Icon className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
            <span className="truncate">{t(meta.labelKey)}</span>
        </button>
    );
}

// Bảng chọn kiểu ô — mỗi kiểu là 1 useDraggable riêng, kéo thả thẳng vào FieldCanvas (workflow-module.md
// §8 Pha 2C — chọn mức tương tác "kéo thẳng từ palette", không phải click-để-thêm).
export default function FieldPalette() {
    const t = useTranslations("Workflow.FormDefinition");

    return (
        <div className="w-56 shrink-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("paletteTitle")}</p>
            <div className="space-y-2">
                {PALETTE_ORDER.map((dataType) => (
                    <PaletteItem key={dataType} dataType={dataType} />
                ))}
            </div>
        </div>
    );
}
