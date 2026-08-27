using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtForms
{
    // Từ chối hàng loạt — mirror BulkApproveOtFormDto. Comment (lý do từ chối) dùng CHUNG cho cả loạt
    // (đã chốt với người dùng 2026-08-27) — không nhập riêng từng đơn.
    public class BulkRejectOtFormDto : RejectOtFormDto
    {
        [Required(ErrorMessage = "Danh sách đơn không được để trống")]
        [MinLength(1, ErrorMessage = "Phải chọn ít nhất 1 đơn")]
        public List<int> OtFormIds { get; set; } = new();
    }
}
