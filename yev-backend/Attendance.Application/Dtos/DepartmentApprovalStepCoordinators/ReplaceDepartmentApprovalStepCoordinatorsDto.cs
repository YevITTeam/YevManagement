using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.DepartmentApprovalStepCoordinators
{
    // Thay NGUYÊN danh sách người phụ trách Cây duyệt của 1 Bộ phận. Gửi mảng rỗng để bỏ hết. Mỗi
    // EmployeeId PHẢI thuộc đúng Bộ phận này (trực tiếp hoặc qua Group con) — validate ở
    // DepartmentApprovalStepCoordinatorService.ReplaceAsync.
    public class ReplaceDepartmentApprovalStepCoordinatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
