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

    // Thay NGUYÊN danh sách ai được tạo đơn của 1 FormDefinition (workflow-module.md §3.2
    // PUT /FormDefinition/{id}/accesses) — mirror pattern ReplaceFormCategoryCoordinatorsDto. Gửi
    // mảng rỗng để bỏ hết (không ai tạo được đơn cho tới khi cấu hình lại).
    public class ReplaceFormAccessesDto
    {
        [Required]
        public List<ReplaceFormAccessItemDto> Items { get; set; } = new();
    }
}
