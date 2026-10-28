using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // 1 nhân viên bị loại khỏi đơn trong lượt Sửa đơn (2026-09-04) — xem UpdateOtFormDto.RemovedEmployees.
    public class UpdateOtFormRemovedEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        // Required unless the remover is the form's own creator (checked in OtFormService.UpdateAsync).
        public string? Reason { get; set; }
    }
}
