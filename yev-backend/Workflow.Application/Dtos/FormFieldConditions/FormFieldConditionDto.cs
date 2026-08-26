using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormFieldConditions
{
    public class FormFieldConditionDto
    {
        public int Id { get; set; }
        public int TargetFieldId { get; set; }
        public string TargetFieldLabelVn { get; set; } = null!;
        public int SourceFieldId { get; set; }
        public string SourceFieldLabelVn { get; set; } = null!;
        public ConditionOperator Operator { get; set; }
        public string? CompareValue { get; set; }
        public string? CompareValue2 { get; set; }
        public ConditionEffect Effect { get; set; }
        public int LogicGroup { get; set; }
        public int SortOrder { get; set; }
    }
}
