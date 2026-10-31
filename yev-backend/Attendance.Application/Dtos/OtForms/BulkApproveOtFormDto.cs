using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Shared Comment/SecondaryPassword; reuses single ApproveAsync per form (re-verifying each time) to keep that flow untouched.
    // Each form succeeds or fails independently (see BulkOtFormActionResultItemDto).
    public class BulkApproveOtFormDto : ApproveOtFormDto
    {
        [Required(ErrorMessage = "Danh sách đơn không được để trống")]
        [MinLength(1, ErrorMessage = "Phải chọn ít nhất 1 đơn")]
        public List<int> OtFormIds { get; set; } = new();
    }
}
