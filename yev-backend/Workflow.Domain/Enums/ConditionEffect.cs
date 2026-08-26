namespace Workflow.Domain.Enums;

// workflow-module.md §4 — hiệu ứng của 1 FormFieldConditions khi khớp điều kiện.
public enum ConditionEffect
{
    Show = 1,
    Hide = 2,
    Require = 3,
    ReadOnly = 4
}
