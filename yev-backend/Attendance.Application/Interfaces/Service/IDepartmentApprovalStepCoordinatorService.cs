using Attendance.Application.Dtos.DepartmentApprovalStepCoordinators;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentApprovalStepCoordinatorService
    {
        Task<List<DepartmentApprovalStepCoordinatorDto>> GetByDepartmentAsync(int departmentId);
        Task<List<DepartmentApprovalStepCoordinatorDto>> ReplaceAsync(int departmentId, ReplaceDepartmentApprovalStepCoordinatorsDto request);

        // Thêm 1 người phụ trách nếu CHƯA có trong danh sách — KHÔNG đụng tới người phụ trách khác
        // (khác ReplaceAsync ở trên, vốn thay NGUYÊN danh sách). Dùng cho EmployeeIdentityLinkImportService
        // (2026-09-03) — mỗi dòng import chỉ nên THÊM đúng người đang xử lý, không được xoá mất người
        // phụ trách đã gán từ trước qua màn hình khác. No-op nếu đã là người phụ trách.
        Task EnsureCoordinatorAsync(int departmentId, int employeeId);
    }
}
