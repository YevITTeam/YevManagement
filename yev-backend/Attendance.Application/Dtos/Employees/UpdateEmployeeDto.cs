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

        // Required or forbidden depending on the JobTitle's TerminalLevel (EmployeeService.ValidateOrganizationAssignmentAsync).
        public int? GroupId { get; set; }

        public int? DepartmentId { get; set; }

        // Required for Department Managers: the (Workshop, Department) pairs they approve for.
        public List<EmployeeApprovalScopeInputDto>? ApprovalScopes { get; set; }

        public int? JobTitleId { get; set; }

        // OT limits are edited via PUT /api/Employee/{id}/ot-limit, which has a narrower permission.
    }
}
