using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormFieldConditions
{
    // Delete-all-and-recreate is safe: no table references FormFieldConditions.Id.
    public class ReplaceFormFieldConditionsDto
    {
        [Required]
        public List<ReplaceFormFieldConditionItemDto> Items { get; set; } = new();
    }

    public class ReplaceFormFieldConditionItemDto
    {
        [Required]
        public int TargetFieldId { get; set; }

        [Required]
        public int SourceFieldId { get; set; }

        [Required]
        public ConditionOperator Operator { get; set; }

        public string? CompareValue { get; set; }

        public string? CompareValue2 { get; set; }

        [Required]
        public ConditionEffect Effect { get; set; }

        public int LogicGroup { get; set; } = 1;
    }
}
