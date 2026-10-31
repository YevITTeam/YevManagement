using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Existing rows may only change actual times, DidEat and notes; NoteVn/NoteJp let line leaders annotate per employee.
    public class UpdateOtFormEmployeeTimeDto
    {
        [Required(ErrorMessage = "Nhân viên không được để trống")]
        public int EmployeeId { get; set; }

        // Optional — null keeps the row's current StartTime (new rows fall back to the form's StartTime).
        public TimeOnly? StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        public bool DidEat { get; set; }

        public string? NoteVn { get; set; }

        public string? NoteJp { get; set; }
    }
}
