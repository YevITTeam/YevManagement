// workflow-module.md §4 — khớp enum RouteConditionType ở BE (Workflow.Domain.Enums.RouteConditionType).
export const RouteConditionType = {
    None: 0,
    NumericRange: 1,
    ClassValue: 2,
    Both: 3,
} as const;

export type RouteConditionType = (typeof RouteConditionType)[keyof typeof RouteConditionType];

export interface FormDefinitionDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    formCategoryId: number;
    formCategoryNameVn: string;
    description: string | null;
    version: number;
    isPublished: boolean;
    allowAttachment: boolean;
    requireAttachment: boolean;
    codePrefix: string;
    routeConditionType: RouteConditionType;
    routeNumericFieldKey: string | null;
    routeClassFieldKey: string | null;
    // HTML render từ .docx nhập vào, nhúng <span data-field-key> đánh dấu vị trí field. NULL = chế
    // độ lưới hiện tại (workflow-module.md §1.5).
    layoutHtml: string | null;
    createdByEmployeeId: number;
    createdByEmployeeName: string;
    updatedByEmployeeId: number | null;
    updatedByEmployeeName: string | null;
    createdAt: string;
    updatedAt: string;
}

// KHÔNG có routeConditionType — bất biến sau khi tạo (workflow-module.md §3.2), chỉ có trong Create.
export interface CreateFormDefinitionDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    formCategoryId: number;
    description: string | null;
    allowAttachment: boolean;
    requireAttachment: boolean;
    codePrefix: string;
    routeConditionType: RouteConditionType;
    routeNumericFieldKey: string | null;
    routeClassFieldKey: string | null;
}

export interface UpdateFormDefinitionDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    formCategoryId: number;
    description: string | null;
    allowAttachment: boolean;
    requireAttachment: boolean;
    codePrefix: string;
    routeNumericFieldKey: string | null;
    routeClassFieldKey: string | null;
}

// POST /FormDefinition/{id}/clone — KHÔNG sao chép FormAccesses (workflow-module.md §3.2), chỉ
// FormFields + FormFieldConditions. FormCategoryId/CodePrefix/RouteConditionType... kế thừa từ form gốc.
export interface CloneFormDefinitionDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
}
