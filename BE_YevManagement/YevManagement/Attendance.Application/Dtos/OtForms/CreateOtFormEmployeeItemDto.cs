using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class CreateOtFormEmployeeItemDto
    {
        [Required(ErrorMessage = "Nhân viên không được để trống")]
        public int EmployeeId { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        public string? NoteVn { get; set; }

        public string? NoteJp { get; set; }
    }
}
