// Must match BE enum RouteConditionType.
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
    // HTML from the imported .docx with <span data-field-key> placeholders; null = grid mode.
    layoutHtml: string | null;
    createdByEmployeeId: number;
    createdByEmployeeName: string;
    updatedByEmployeeId: number | null;
    updatedByEmployeeName: string | null;
    createdAt: string;
    updatedAt: string;
}

// No routeConditionType: immutable after creation.
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

// Clone copies FormFields + conditions but not FormAccesses; category, prefix and route condition are inherited.
export interface CloneFormDefinitionDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
}
