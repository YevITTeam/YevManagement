using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.FormCategoryCoordinators
{
    // Thay NGUYÊN danh sách người phụ trách thiết kế của 1 FormCategory (workflow-module.md §3.2
    // PUT /FormCategory/{id}/coordinators) — mirror pattern ReplaceEmployeeOrgUnitsDto. Gửi mảng rỗng
    // để bỏ hết.
    public class ReplaceFormCategoryCoordinatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
