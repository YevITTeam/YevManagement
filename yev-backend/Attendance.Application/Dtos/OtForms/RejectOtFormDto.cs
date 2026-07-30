using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class RejectOtFormDto
    {
        [Required(ErrorMessage = "Lý do từ chối không được để trống")]
        public string Comment { get; set; } = null!;

        // Second-factor password, re-verified by OtFormService before the rejection is recorded.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
