using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionApprovalSteps
{
    public class ReplaceProductionApprovalStepItemDto
    {
        [Required]
        public int JobTitleId { get; set; }

        public bool RequiresSignature { get; set; }
        public bool IsResponsible { get; set; }
    }

    // Thay NGUYÊN danh sách bước duyệt "theo chuyền" của 1 Department — 1 danh sách DUY NHẤT, không
    // tách Group/Department như ReplaceDepartmentApprovalStepsDto (xem ProductionApprovalStep). Thứ
    // tự phần tử trong Steps chính là StepOrder (phần tử đầu = bước 1). Gửi mảng rỗng để xoá hết.
    public class ReplaceProductionApprovalStepsDto
    {
        [Required]
        public List<ReplaceProductionApprovalStepItemDto> Steps { get; set; } = new();
    }
}
