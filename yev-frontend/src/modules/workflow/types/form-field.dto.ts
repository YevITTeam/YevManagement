// workflow-module.md §4 — khớp enum FieldDataType ở BE (Workflow.Domain.Enums.FieldDataType).
export const FieldDataType = {
    Text: 1,
    TextArea: 2,
    Number: 3,
    Decimal: 4,
    Date: 5,
    DateTime: 6,
    Time: 7,
    Dropdown: 8,
    Radio: 9,
    Checkbox: 10,
    MultiSelect: 11,
    Employee: 12,
    OrgUnit: 13,
    Label: 14,
} as const;

export type FieldDataType = (typeof FieldDataType)[keyof typeof FieldDataType];

export interface FormFieldDto {
    id: number;
    formDefinitionId: number;
    fieldKey: string;
    labelVn: string;
    labelJp: string | null;
    dataType: FieldDataType;
    isRequired: boolean;
    sortOrder: number;
    columnSpan: number;
    placeholder: string | null;
    defaultValue: string | null;
    optionsJson: string | null;
    minValue: number | null;
    maxValue: number | null;
    maxLength: number | null;
    helpTextVn: string | null;
    formDataSourceId: number | null;
    formDataSourceNameVn: string | null;
    autoNumberPattern: string | null;
    defaultVisible: boolean;
    isReadOnly: boolean;
}

// id = null nghĩa là dòng mới, có giá trị = update đúng field đã tồn tại (workflow-module.md §6 —
// FormDefinitionService.ReplaceFieldsAsync merge theo Id/FieldKey, KHÔNG xoá-tất-tạo-lại).
export interface ReplaceFormFieldItemDto {
    id: number | null;
    fieldKey: string;
    labelVn: string;
    labelJp: string | null;
    dataType: FieldDataType;
    isRequired: boolean;
    columnSpan: number;
    placeholder: string | null;
    defaultValue: string | null;
    optionsJson: string | null;
    minValue: number | null;
    maxValue: number | null;
    maxLength: number | null;
    helpTextVn: string | null;
    formDataSourceId: number | null;
    autoNumberPattern: string | null;
    defaultVisible: boolean;
    isReadOnly: boolean;
}
