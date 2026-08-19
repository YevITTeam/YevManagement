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

        public int? JobTitleId { get; set; }
    }
}
