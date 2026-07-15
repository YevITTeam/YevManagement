namespace Attendance.Application.Dtos.UserApprovalScopes
{
    public class UserApprovalScopeDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = null!;

        // Enum Attendance.Domain.Enums.ScopeType (Group/Department).
        public int ScopeType { get; set; }
        public int ScopeId { get; set; }
        public string ScopeName { get; set; } = null!;

        // Enum Attendance.Domain.Enums.ApprovalLevel (DepartmentManager/WorkshopManager).
        public int ApprovalLevel { get; set; }
    }
}
