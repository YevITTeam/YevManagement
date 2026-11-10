using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class ReviewOtFormPaperScanDto
    {
        [Required, MaxLength(500)]
        public string Comment { get; set; } = null!;

        [Required]
        public string SecondaryPassword { get; set; } = null!;
    }
}
