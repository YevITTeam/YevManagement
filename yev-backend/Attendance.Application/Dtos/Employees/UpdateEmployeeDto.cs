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

        // Line × Ca the group covers (the form derives the group from it); null = keep or default from the group.
        public int? ProductionLineId { get; set; }
        public int? ShiftTeamId { get; set; }
        [MaxLength(50, ErrorMessage = "Công đoạn tối đa 50 ký tự")]
        public string? CongDoan { get; set; }
        [MaxLength(255, ErrorMessage = "Công việc tối đa 255 ký tự")]
        public string? TaskName { get; set; }
        // TT/GT for people without a task; a task's own kind wins.
        public string? StaffKind { get; set; }
    }
}
