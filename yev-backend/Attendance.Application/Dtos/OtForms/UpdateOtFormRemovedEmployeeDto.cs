using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // 1 nhân viên bị loại khỏi đơn trong lượt Sửa đơn (2026-09-04) — xem UpdateOtFormDto.RemovedEmployees.
    public class UpdateOtFormRemovedEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        // Mandatory — same principle as the old RemoveOtFormEmployeeDto.Reason: any action that takes
        // something away from the form must record why, since the form is a legal document.
        [Required(ErrorMessage = "Lý do loại nhân viên khỏi đơn không được để trống")]
        public string Reason { get; set; } = null!;
    }
}
