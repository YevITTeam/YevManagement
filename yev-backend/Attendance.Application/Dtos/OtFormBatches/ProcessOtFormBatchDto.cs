using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtFormBatches
{
    // Duyệt hàng loạt "Đơn tổng" — mỗi đơn nhỏ trong batch phải có đúng 1 quyết định
    // (Forms phải khớp CHÍNH XÁC tập OtFormId còn hiệu lực của batch, xem OtFormService.ProcessBatchAsync).
    public class ProcessOtFormBatchDto
    {
        // Second-factor password, verify 1 lần cho cả batch — cùng nguyên tắc ApproveOtFormDto/RejectOtFormDto.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;

        [Required(ErrorMessage = "Danh sách quyết định từng đơn không được để trống")]
        public List<ProcessOtFormBatchFormDto> Forms { get; set; } = new();
    }
}
