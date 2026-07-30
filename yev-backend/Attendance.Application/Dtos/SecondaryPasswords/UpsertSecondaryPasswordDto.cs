using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.SecondaryPasswords
{
    public class UpsertSecondaryPasswordDto
    {
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        [MinLength(6, ErrorMessage = "Mật khẩu cấp 2 phải có ít nhất 6 ký tự")]
        public string Password { get; set; } = null!;
    }
}
