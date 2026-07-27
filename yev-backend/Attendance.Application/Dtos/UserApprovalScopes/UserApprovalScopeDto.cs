namespace Attendance.Application.Dtos.UserApprovalScopes
{
    public class UserApprovalScopeDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = null!;

        // Tra cứu từ Identity qua IUserDirectoryService — Admin nhìn tên thật thay vì tài khoản AD
        // thô để biết đang gán ai, cùng convention "hiển thị luôn phải ra tên người dùng" áp dụng
        // cho createdByFullName/approverFullName ở OtForm. Null nếu tài khoản chưa có FullName trong Identity.
        public string? UserFullName { get; set; }

        // Enum Attendance.Domain.Enums.ScopeType (Group/Department).
        public int ScopeType { get; set; }
        public int ScopeId { get; set; }
        public string ScopeName { get; set; } = null!;

        // Enum Attendance.Domain.Enums.ApprovalLevel (DepartmentManager/WorkshopManager).
        public int ApprovalLevel { get; set; }
    }
}
