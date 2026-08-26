using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    public class CreateEmployeeDto
    {
        [Required(ErrorMessage = "Mã nhân viên không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Họ không được để trống")]
        public string FirstName { get; set; } = null!;

        [Required(ErrorMessage = "Tên không được để trống")]
        public string LastName { get; set; } = null!;

        // The employee's own AD account (nullable) — required if the employee should be able to
        // adjust their own accumulation later (see Attendance.OTForm/Employee adjust-accumulation).
        public string? UserName { get; set; }

        // Nullable (2026-08-08) — bắt buộc/cấm tuỳ theo TerminalLevel của JobTitleId, validate ở
        // EmployeeService.ValidateOrganizationAssignmentAsync (xem docs §Cây chức vụ).
        public int? GroupId { get; set; }

        public int? DepartmentId { get; set; }

        public int? JobTitleId { get; set; }

        // Giới hạn giờ OT/tháng/năm RIÊNG cho nhân viên này — nullable, để trống = dùng mặc định chung
        // (2026-08-26, xem Employee.cs).
        [Range(1, 744, ErrorMessage = "Giới hạn giờ OT/tháng riêng phải từ 1 đến 744")]
        public decimal? CustomMonthlyOtHourLimit { get; set; }

        [Range(1, 8784, ErrorMessage = "Giới hạn giờ OT/năm riêng phải từ 1 đến 8784")]
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}
