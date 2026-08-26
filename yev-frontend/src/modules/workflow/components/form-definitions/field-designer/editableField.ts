import type { FormFieldDto, ReplaceFormFieldItemDto, FieldDataType } from "@/modules/workflow/types/form-field.dto";
import { randomClientId } from "@/lib/uuid";
import { FIELD_TYPES_WITH_OPTIONS } from "./fieldTypeMeta";

// State cục bộ trong canvas — thêm/xoá/kéo-sắp xếp/sửa chỉ đổi mảng này, KHÔNG gọi API cho tới khi
// bấm "Lưu thay đổi" (workflow-module.md §6, xem comment ReplaceFieldsAsync ở BE). clientId là khoá
// ổn định cho dnd-kit vì field mới thêm chưa có `id` thật (còn null tới khi lưu).
export interface EditableField extends ReplaceFormFieldItemDto {
    clientId: string;
}

export function fromFormFieldDto(dto: FormFieldDto): EditableField {
    return {
        clientId: `existing-${dto.id}`,
        id: dto.id,
        fieldKey: dto.fieldKey,
        labelVn: dto.labelVn,
        labelJp: dto.labelJp,
        dataType: dto.dataType,
        isRequired: dto.isRequired,
        columnSpan: dto.columnSpan,
        placeholder: dto.placeholder,
        defaultValue: dto.defaultValue,
        optionsJson: dto.optionsJson,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        maxLength: dto.maxLength,
        helpTextVn: dto.helpTextVn,
        formDataSourceId: dto.formDataSourceId,
        autoNumberPattern: dto.autoNumberPattern,
        defaultVisible: dto.defaultVisible,
        isReadOnly: dto.isReadOnly,
    };
}

function nextUniqueFieldKey(dataType: FieldDataType, existing: EditableField[]): string {
    const prefix = "field_";
    const usedKeys = new Set(existing.map((f) => f.fieldKey));
    let n = existing.length + 1;
    let candidate = `${prefix}${n}`;
    while (usedKeys.has(candidate)) {
        n += 1;
        candidate = `${prefix}${n}`;
    }
    return candidate;
}

export function createDefaultField(dataType: FieldDataType, existing: EditableField[], defaultLabel: string): EditableField {
    return {
        clientId: `new-${randomClientId()}`,
        id: null,
        fieldKey: nextUniqueFieldKey(dataType, existing),
        labelVn: defaultLabel,
        labelJp: null,
        dataType,
        isRequired: false,
        columnSpan: 1,
        placeholder: null,
        defaultValue: null,
        optionsJson: FIELD_TYPES_WITH_OPTIONS.has(dataType) ? "[]" : null,
        minValue: null,
        maxValue: null,
        maxLength: null,
        helpTextVn: null,
        formDataSourceId: null,
        autoNumberPattern: null,
        defaultVisible: true,
        isReadOnly: false,
    };
}
