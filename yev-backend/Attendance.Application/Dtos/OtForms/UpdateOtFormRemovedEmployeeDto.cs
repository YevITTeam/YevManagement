using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class UpdateOtFormRemovedEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        // Required unless the remover is the form's own creator (checked in OtFormService.UpdateAsync).
        public string? Reason { get; set; }
    }
}
