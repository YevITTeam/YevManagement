using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    public class CreateOtFormDto
    {
        // Required for group forms; must be empty for production-line forms (IsProductionForm = true).
        public int? GroupId { get; set; }

        public bool IsProductionForm { get; set; }

        [Required(ErrorMessage = "Bộ phận không được để trống")]
        public int DepartmentId { get; set; }

        [Required(ErrorMessage = "Lý do không được để trống")]
        public int ReasonId { get; set; }

        [Required(ErrorMessage = "Trường hợp OT không được để trống")]
        public int OtCaseId { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        public string? SubReason { get; set; }

        [Required(ErrorMessage = "Tổng số giờ không được để trống")]
        public decimal TotalHour { get; set; }

        [Required(ErrorMessage = "Ngày tăng ca không được để trống")]
        public DateOnly Date { get; set; }

        [Required(ErrorMessage = "Danh sách nhân viên không được để trống")]
        [MinLength(1, ErrorMessage = "Phải có ít nhất 1 nhân viên")]
        public List<CreateOtFormEmployeeItemDto> Employees { get; set; } = new();

        public ProcessPartDto? ProcessPart { get; set; }

        // Required on create too, same as approving.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;
    }
}
