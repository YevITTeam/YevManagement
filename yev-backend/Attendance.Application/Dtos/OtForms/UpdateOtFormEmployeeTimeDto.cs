using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Item of UpdateOtFormDto.Employees — after 2026-07-31, editing an existing form is restricted to
    // ONLY each active employee's actual OT end time + DidEat (added 2026-08-05, xem OtFormEmployee.DidEat)
    // — see OtFormService.UpdateAsync. EmployeeId must already be an active (not removed) employee on
    // the form; adding/removing people is rejected.
    // NoteVn/NoteJp trở lại 2026-08-27 (Giai đoạn 5) — Group Leader/Team Leader (đơn "theo chuyền") ghi
    // chú trao đổi qua từng nhân viên thay vì ghi giấy, xem OtFormService.UpdateAsync.
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
