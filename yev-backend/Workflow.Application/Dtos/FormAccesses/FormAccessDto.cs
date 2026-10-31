using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormAccesses
{
    // RoleId points to Identity.Roles in another DB (no FK), so the FE resolves the role name itself.
    public class FormAccessDto
    {
        public int Id { get; set; }
        public AccessTargetType TargetType { get; set; }
        public int? RoleId { get; set; }
        public int? OrgUnitId { get; set; }
        public string? OrgUnitNameVn { get; set; }
        public int? EmployeeId { get; set; }
        public string? EmployeeFullName { get; set; }
    }
}
