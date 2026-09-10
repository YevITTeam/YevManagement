using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.AttendanceSettings
{
    public class SendTestEmailDto
    {
        [Required(ErrorMessage = "Email người nhận không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        public string Email { get; set; } = null!;
    }
}
