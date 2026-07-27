using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Edit the entire form (categories + employee list + ProcessPart) — only allowed when
    // OtForm.Status == Pending (no approval level has approved yet), see OtFormService.UpdateAsync.
    // No signature field since the "Requester" signature was already signed at creation time
    // (taken automatically from UserSignature), and is not re-signed on edit.
    public class UpdateOtFormDto
    {
        [Required(ErrorMessage = "Nhóm không được để trống")]
        public int GroupId { get; set; }

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
    }
}
