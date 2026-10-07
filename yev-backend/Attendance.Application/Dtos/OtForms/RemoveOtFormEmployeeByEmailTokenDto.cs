using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Twin of RemoveOtFormEmployeeDto for the [AllowAnonymous] email-confirm channel. The link alone is not
    // enough here, so the secondary password is re-verified like Approve/Reject.
    public class RemoveOtFormEmployeeByEmailTokenDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        [Required(ErrorMessage = "Lý do loại nhân viên khỏi đơn không được để trống")]
        public string Reason { get; set; } = null!;

        [Required(ErrorMessage = "Mật khẩu cấp 2 là bắt buộc")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
