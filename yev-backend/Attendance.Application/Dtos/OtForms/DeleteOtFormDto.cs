using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Reason is mandatory: removing anything from a legal document must record why.
    public class DeleteOtFormDto
    {
        [Required(ErrorMessage = "Lý do xoá đơn không được để trống")]
        public string Reason { get; set; } = null!;
    }
}
