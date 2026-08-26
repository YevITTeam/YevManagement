using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormFieldConditions
{
    // Thay NGUYÊN danh sách điều kiện của 1 FormDefinition (workflow-module.md §6
    // PUT /FormDefinition/{id}/conditions) — không bảng nào tham chiếu Id của FormFieldConditions
    // nên dùng đúng pattern xoá-tất-tạo-lại như FormCategoryCoordinators/EmployeeOrgUnits.
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
