"use client";

import { useTranslations } from "next-intl";
import { FIELD_TYPE_META, PALETTE_ORDER } from "../field-designer/fieldTypeMeta";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";

// Khoá dataTransfer cho việc thả 1 loại field mới vào canvas tài liệu (DocumentFieldCanvas.tsx đọc
// lại đúng khoá này). Native HTML5 drag-drop thay vì @dnd-kit như FieldPalette.tsx (canvas lưới) vì
// đích thả là văn bản tự do (contentEditable + caretRangeFromPoint), không phải danh sách sortable.
export const DOCUMENT_FIELD_TYPE_DRAG_KEY = "application/x-workflow-field-type";

// Bỏ Label khỏi bảng chọn ở chế độ tài liệu — nhãn đã là chữ có sẵn trong văn bản Word gốc, không
// cần thêm 1 field tĩnh nữa (workflow-module.md §1.5).
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
            className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2.5 text-left text-sm text-[#191c1e] transition hover:border-[#e3000f] hover:bg-[#fff4f2] active:cursor-grabbing"
        >
            <Icon className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
            <span className="truncate">{t(meta.labelKey)}</span>
        </div>
    );
}

export default function DocumentFieldPalette() {
    const t = useTranslations("Workflow.FormDefinition");

    return (
        <div className="w-56 shrink-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("paletteTitle")}</p>
            <div className="space-y-2">
                {DOCUMENT_PALETTE_ORDER.map((dataType) => (
                    <PaletteItem key={dataType} dataType={dataType} />
                ))}
            </div>
        </div>
    );
}
