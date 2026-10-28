using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Workshops
{
    public class CreateWorkshopDto
    {
        [Required(ErrorMessage = "Mã xưởng không được để trống")]
        public string WorkshopCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên xưởng (VN) không được để trống")]
        public string WorkshopNameVn { get; set; } = null!;

        public string? WorkshopNameJp { get; set; }
    }
}
