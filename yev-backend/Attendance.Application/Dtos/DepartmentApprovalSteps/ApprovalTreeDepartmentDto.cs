using Attendance.Application.Dtos.Departments;

namespace Attendance.Application.Dtos.DepartmentApprovalSteps
{
    // A department offered on the approval-tree screen. CanManage = Admin or department coordinator;
    // otherwise the caller only coordinates GroupIds inside it and sees the department steps read-only.
    public class ApprovalTreeDepartmentDto : DepartmentDto
    {
        public bool CanManage { get; set; }
        public List<int> GroupIds { get; set; } = new();
    }
}
