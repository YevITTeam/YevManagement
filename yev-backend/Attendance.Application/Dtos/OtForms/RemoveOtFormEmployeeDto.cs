using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // In-app removal: uses the current Pending step's candidate rule for both group and line forms; no SecondaryPassword required.
    public class RemoveOtFormEmployeeDto
    {
        [Required(ErrorMessage = "Nhân viên cần loại không được để trống")]
        public int EmployeeId { get; set; }

        [Required(ErrorMessage = "Lý do loại nhân viên khỏi đơn không được để trống")]
        public string Reason { get; set; } = null!;
    }
}
