using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.EmployeeOrgUnits
{
    // Thay NGUYÊN danh sách đơn vị/chức danh kiêm nhiệm của 1 Employee (workflow-module.md §6
    // PUT /Employee/{id}/org-units) — mirror pattern ReplaceAsync của Attendance
    // (DepartmentApprovalStepCoordinatorService). Gửi mảng rỗng để bỏ hết.
    public class ReplaceEmployeeOrgUnitsDto
    {
        [Required]
        public List<ReplaceEmployeeOrgUnitItemDto> Items { get; set; } = new();
    }

    public class ReplaceEmployeeOrgUnitItemDto
    {
        [Required]
        public int OrgUnitId { get; set; }

        public int? JobTitleId { get; set; }

        public bool IsPrimary { get; set; }

        public DateTime? ValidFrom { get; set; }

        public DateTime? ValidTo { get; set; }
    }
}
