using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Twin of RemoveOtFormEmployeeDto for the [AllowAnonymous] email-confirm channel — the
    // OtFormApprovalEmailToken in the URL is the sole credential here, so there is deliberately NO
    // SecondaryPassword field (chốt qua AskUserQuestion 2026-07-31, khác Duyệt/Từ chối qua email vẫn
    // giữ mật khẩu cấp 2 — xem docs/attendance-module.md — Loại nhân viên khỏi đơn).
    public class RemoveOtFormEmployeeByEmailTokenDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        [Required(ErrorMessage = "Lý do loại nhân viên khỏi đơn không được để trống")]
        public string Reason { get; set; } = null!;
    }
}
