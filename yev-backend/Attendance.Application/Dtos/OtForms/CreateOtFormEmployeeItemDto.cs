using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class CreateOtFormEmployeeItemDto
    {
        [Required(ErrorMessage = "Nhân viên không được để trống")]
        public int EmployeeId { get; set; }

        // Actual OT start time for this employee — optional, null = the form's StartTime. Must lie
        // within [form StartTime, EndTime) of this employee (validated in the Service).
        public TimeOnly? StartTime { get; set; }

        // Actual OT end time for this employee — the form creator can adjust it individually per
        // person, but it must be <= the form's overall EndTime (validated in the Service).
        public TimeOnly EndTime { get; set; }

        // Only matters when the hours reach the meal-ticket threshold.
        public bool DidEat { get; set; }

        public string? NoteVn { get; set; }

        public string? NoteJp { get; set; }
    }
}
