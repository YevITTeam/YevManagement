using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class RejectOtFormDto
    {
        [Required(ErrorMessage = "Lý do từ chối không được để trống")]
        public string Comment { get; set; } = null!;
    }
}
