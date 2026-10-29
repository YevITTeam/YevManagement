using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalSteps
{
    public class ReplaceGroupApprovalStepItemDto
    {
        [Required]
        public int JobTitleId { get; set; }

        // Bước này bắt buộc ký tay hay chỉ cần xác nhận — cấu hình riêng theo từng Nhóm (xem
        // GroupApprovalStep.RequiresSignature).
        public bool RequiresSignature { get; set; }

        // Đánh dấu bước này là "người chịu trách nhiệm" trên form in — tối đa 1 phần tử trong Steps
        // được đặt true (validate ở GroupApprovalStepService.ReplaceAsync).
        public bool IsResponsible { get; set; }

        public bool CanResubmit { get; set; }
    }

    // Thay NGUYÊN danh sách bước duyệt trung gian của 1 Group — thứ tự phần tử trong Steps chính là
    // StepOrder (phần tử đầu = bước 1). Gửi mảng rỗng để xoá hết cây duyệt của Nhóm đó.
    public class ReplaceGroupApprovalStepsDto
    {
        [Required]
        public List<ReplaceGroupApprovalStepItemDto> Steps { get; set; } = new();
    }
}
