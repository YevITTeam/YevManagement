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

        // Second-factor password, re-verified by OtFormService before the removal is recorded — same
        // gate as sign/approve/reject (see docs/attendance-module.md — Mật khẩu cấp 2).
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
