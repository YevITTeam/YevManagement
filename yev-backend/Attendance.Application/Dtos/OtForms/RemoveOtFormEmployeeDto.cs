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

        // Second-factor password — bắt buộc từ 2026-08-28 (theo yêu cầu người dùng, đảo ngược quyết
        // định 2026-07-31 ở trên). CHỈ áp dụng cho action trong app này — kênh email
        // (RemoveOtFormEmployeeByEmailTokenDto) vẫn giữ nguyên KHÔNG cần mật khẩu cấp 2 (token tự nó
        // là thông tin xác thực, quyết định riêng không đổi).
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
