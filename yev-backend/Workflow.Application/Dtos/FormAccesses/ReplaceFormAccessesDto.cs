using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormAccesses
{
    public class ReplaceFormAccessItemDto
    {
        [Required(ErrorMessage = "Loại đối tượng không được để trống")]
        public AccessTargetType TargetType { get; set; }

        public int? RoleId { get; set; }

        public int? OrgUnitId { get; set; }

        public int? EmployeeId { get; set; }
    }

    // Replaces the whole list; an empty array means nobody can create requests until reconfigured.
    public class ReplaceFormAccessesDto
    {
        [Required]
        public List<ReplaceFormAccessItemDto> Items { get; set; } = new();
    }
}
