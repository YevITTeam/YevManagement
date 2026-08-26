using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormAccesses
{
    // RoleId là cross-DB (Identity.Roles, KHÔNG FK — workflow-module.md §1.4) nên BE không tự resolve
    // được tên Role trong Workflow DB; FE tự ánh xạ bằng danh sách lấy từ AuthApi.getAllRoles().
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
