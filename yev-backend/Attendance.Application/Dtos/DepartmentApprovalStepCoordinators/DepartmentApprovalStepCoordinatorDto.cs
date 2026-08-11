namespace Attendance.Application.Dtos.DepartmentApprovalStepCoordinators
{
    public class DepartmentApprovalStepCoordinatorDto
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;

        // null = Employee này CHƯA liên kết tài khoản đăng nhập (Employee.UserName) — vẫn hợp lệ để
        // gán làm người phụ trách, nhưng quyền thao tác thật chỉ có hiệu lực SAU khi Admin liên kết
        // UserName cho họ (tự động cấp lúc đó, không cần thao tác gì thêm — xem
        // EmployeeService.SyncAutoGrantedPermissionsCoreAsync). FE hiển thị nhãn "chưa liên kết" khi null.
        public string? UserName { get; set; }
    }
}
