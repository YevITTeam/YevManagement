using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Request to drop ONE employee from a form the caller is currently entitled to sign/approve,
    // so the rest of the form can still be approved instead of rejecting all of it
    // (see docs/attendance-module.md — Loại nhân viên khỏi đơn).
    public class RemoveOtFormEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        // Mandatory — same principle as RejectOtFormDto.Comment: any action that takes something away
        // from the form must record why, since the form is a legal document.
        [Required(ErrorMessage = "Lý do loại nhân viên khỏi đơn không được để trống")]
        public string Reason { get; set; } = null!;

        // No SecondaryPassword — unlike sign/approve/reject, removing an employee does not re-verify
        // the second-factor password (decided 2026-07-31, see docs/attendance-module.md — Mật khẩu cấp 2).
    }
}
