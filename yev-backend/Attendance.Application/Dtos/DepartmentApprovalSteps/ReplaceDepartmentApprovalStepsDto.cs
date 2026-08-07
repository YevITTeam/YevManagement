using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.DepartmentApprovalSteps
{
    public class ReplaceDepartmentApprovalStepItemDto
    {
        [Required]
        public int JobTitleId { get; set; }

        // Bước này bắt buộc ký tay hay chỉ cần xác nhận — cấu hình riêng theo từng Phòng ban (xem
        // DepartmentApprovalStep.RequiresSignature).
        public bool RequiresSignature { get; set; }

        // Đánh dấu bước này là "người chịu trách nhiệm" trên form in — tối đa 1 phần tử trong Steps
        // được đặt true (validate ở DepartmentApprovalStepService.ReplaceAsync).
        public bool IsResponsible { get; set; }
    }

    // Thay NGUYÊN danh sách bước duyệt của 1 Department — thứ tự phần tử trong Steps chính là
    // StepOrder (phần tử đầu = bước 1). Gửi mảng rỗng để xoá hết cây duyệt của Department đó.
    public class ReplaceDepartmentApprovalStepsDto
    {
        [Required]
        public List<ReplaceDepartmentApprovalStepItemDto> Steps { get; set; } = new();
    }
}
