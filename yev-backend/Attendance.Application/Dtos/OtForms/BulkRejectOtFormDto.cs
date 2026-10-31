using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Shared rejection reason for the whole batch.
    public class BulkRejectOtFormDto : RejectOtFormDto
    {
        [Required(ErrorMessage = "Danh sách đơn không được để trống")]
        [MinLength(1, ErrorMessage = "Phải chọn ít nhất 1 đơn")]
        public List<int> OtFormIds { get; set; } = new();
    }
}
