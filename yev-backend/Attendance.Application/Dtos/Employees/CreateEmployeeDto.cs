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

        // Required or forbidden depending on the JobTitle's TerminalLevel (EmployeeService.ValidateOrganizationAssignmentAsync).
        public int? GroupId { get; set; }

        public int? DepartmentId { get; set; }

        // Required for Department Managers: the (Workshop, Department) pairs they approve for.
        public List<EmployeeApprovalScopeInputDto>? ApprovalScopes { get; set; }

        public int? JobTitleId { get; set; }

        // Null = use the global default.
        [Range(1, 744, ErrorMessage = "Giới hạn giờ OT/tháng riêng phải từ 1 đến 744")]
        public decimal? CustomMonthlyOtHourLimit { get; set; }

        [Range(1, 8784, ErrorMessage = "Giới hạn giờ OT/năm riêng phải từ 1 đến 8784")]
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}
