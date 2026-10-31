using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtFormBatches
{
    // Forms must match exactly the batch's still-valid OtFormIds, one decision each.
    public class ProcessOtFormBatchDto
    {
        // Verified once for the whole batch.
        [Required(ErrorMessage = "Mật khẩu cấp 2 không được để trống")]
        public string SecondaryPassword { get; set; } = null!;

        [Required(ErrorMessage = "Danh sách quyết định từng đơn không được để trống")]
        public List<ProcessOtFormBatchFormDto> Forms { get; set; } = new();
    }
}
