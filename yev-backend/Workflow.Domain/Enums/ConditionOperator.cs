namespace Workflow.Domain.Enums;

// workflow-module.md §4 — toán tử so sánh dùng ở FormFieldConditions.
public enum ConditionOperator
{
    Equals = 1,
    NotEquals = 2,
    Contains = 3,
    GreaterThan = 4,
    LessThan = 5,
    Between = 6,
    IsEmpty = 7,
    IsNotEmpty = 8
}
