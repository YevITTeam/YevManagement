using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Reasons
{
    public class CreateReasonDto
    {
        [Required(ErrorMessage = "Tên lý do (VN) không được để trống")]
        public string ReasonNameVn { get; set; } = null!;

        public string? ReasonNameJp { get; set; }
    }
}
