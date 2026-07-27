using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class CreateOtFormEmployeeItemDto
    {
        [Required(ErrorMessage = "Nhân viên không được để trống")]
        public int EmployeeId { get; set; }

        // Actual OT end time for this employee — the form creator can adjust it individually per
        // person, but it must be <= the form's overall EndTime (validated in the Service). StartTime
        // is NO LONGER accepted from the FE — it's always fixed to the form's StartTime (see docs/attendance-module.md).
        public TimeOnly EndTime { get; set; }

        public string? NoteVn { get; set; }

        public string? NoteJp { get; set; }
    }
}
