using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalStepCoordinators
{
    // Thay NGUYÊN danh sách người phụ trách Cây duyệt của 1 Nhóm. Gửi mảng rỗng để bỏ hết. Mỗi
    // EmployeeId PHẢI thuộc đúng Nhóm này — validate ở GroupApprovalStepCoordinatorService.ReplaceAsync.
    public class ReplaceGroupApprovalStepCoordinatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
