using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Ẩn/hiện · bắt buộc theo điều kiện (workflow-module.md §3.2, §5.3). TargetFieldId là ô BỊ điều
// khiển (Cascade — xoá field đó thì điều kiện này vô nghĩa, xoá theo), SourceFieldId là ô MANG giá
// trị điều kiện (Restrict — không cho xoá field đang được điều kiện khác dựa vào).
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
