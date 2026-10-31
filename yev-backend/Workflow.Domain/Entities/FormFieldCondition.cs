using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Target field (controlled) cascades on delete; Source field (holds the value) is Restrict so it can't be deleted while used.
public partial class FormFieldCondition
{
    public int Id { get; set; }

    public int TargetFieldId { get; set; }

    public int SourceFieldId { get; set; }

    public ConditionOperator Operator { get; set; }

    public string? CompareValue { get; set; }

    public string? CompareValue2 { get; set; }

    public ConditionEffect Effect { get; set; }

    public int LogicGroup { get; set; } = 1;

    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormField TargetField { get; set; } = null!;

    public virtual FormField SourceField { get; set; } = null!;
}
