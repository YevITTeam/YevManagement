using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class ApproveOtFormDto
    {
        public string? Comment { get; set; }

        // Second-factor password, re-verified by OtFormService against the caller's own
        // SecondaryPassword before the sign/approve is recorded — applies to submit AND approve
        // (both funnel through this same DTO).
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
