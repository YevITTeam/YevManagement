using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Employees mixes existing rows (actuals edit) and new rows; the service diffs against active rows.
    // Department/Group are fixed; Header applies to office forms only.
    public class UpdateOtFormDto
    {
        // Office forms only: general info as on creation, minus Department/Group. OtCase is re-derived server-side.
        public UpdateOtFormHeaderDto? Header { get; set; }

        [Required(ErrorMessage = "Danh sách nhân viên không được để trống")]
        [MinLength(1, ErrorMessage = "Phải có ít nhất 1 nhân viên")]
        public List<UpdateOtFormEmployeeTimeDto> Employees { get; set; } = new();

        // Every active employee missing from Employees must be listed here with a reason, else the update is rejected.
        public List<UpdateOtFormRemovedEmployeeDto> RemovedEmployees { get; set; } = new();

        // Saving edits also requires the second-factor password, same as approval.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;

        // Required when the save re-submits a rejected or Manager-signed form.
        public string? ResubmitReason { get; set; }
    }

    public class UpdateOtFormHeaderDto
    {
        public DateOnly Date { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        [Required(ErrorMessage = "Lý do không được để trống")]
        public int ReasonId { get; set; }

        public string? SubReason { get; set; }

        public ProcessPartDto? ProcessPart { get; set; }
    }
}
