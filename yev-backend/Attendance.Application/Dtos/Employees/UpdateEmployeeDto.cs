using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    public class UpdateEmployeeDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã nhân viên không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Họ không được để trống")]
        public string FirstName { get; set; } = null!;

        [Required(ErrorMessage = "Tên không được để trống")]
        public string LastName { get; set; } = null!;

        public string? UserName { get; set; }

        // Nullable (2026-08-08) — bắt buộc/cấm tuỳ theo TerminalLevel của JobTitleId, validate ở
        // EmployeeService.ValidateOrganizationAssignmentAsync (xem docs §Cây chức vụ).
        public int? GroupId { get; set; }

        public int? DepartmentId { get; set; }

        // Required for Department Managers: the (Workshop, Department) pairs they approve for.
        public List<EmployeeApprovalScopeInputDto>? ApprovalScopes { get; set; }

        public int? JobTitleId { get; set; }

        // KHÔNG có CustomMonthlyOtHourLimit/CustomYearlyOtHourLimit ở đây (2026-08-29, cố ý tách khỏi
        // DTO này) — sửa riêng qua PUT /api/Employee/{id}/ot-limit (permission hẹp hơn
        // Attendance.Employee.UpdateOtLimit, scope theo Phòng ban), xem
        // docs/docs-be/attendance-module.md §Phân quyền theo Phòng ban.
    }
}
