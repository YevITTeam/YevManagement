// Must match BE enums ConditionOperator/ConditionEffect.
export const ConditionOperator = {
    Equals: 1,
    NotEquals: 2,
    Contains: 3,
    GreaterThan: 4,
    LessThan: 5,
    Between: 6,
    IsEmpty: 7,
    IsNotEmpty: 8,
} as const;

export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator];

export const ConditionEffect = {
    Show: 1,
    Hide: 2,
    Require: 3,
    ReadOnly: 4,
} as const;

export type ConditionEffect = (typeof ConditionEffect)[keyof typeof ConditionEffect];

export interface FormFieldConditionDto {
    id: number;
    targetFieldId: number;
    targetFieldLabelVn: string;
    sourceFieldId: number;
    sourceFieldLabelVn: string;
    operator: ConditionOperator;
    compareValue: string | null;
    compareValue2: string | null;
    effect: ConditionEffect;
    logicGroup: number;
    sortOrder: number;
}

export interface ReplaceFormFieldConditionItemDto {
    targetFieldId: number;
    sourceFieldId: number;
    operator: ConditionOperator;
    compareValue: string | null;
    compareValue2: string | null;
    effect: ConditionEffect;
    logicGroup: number;
}
