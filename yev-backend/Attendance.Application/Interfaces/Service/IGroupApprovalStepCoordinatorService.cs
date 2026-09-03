using Attendance.Application.Dtos.GroupApprovalStepCoordinators;

namespace Attendance.Application.Interfaces.Service
{
    public interface IGroupApprovalStepCoordinatorService
    {
        Task<List<GroupApprovalStepCoordinatorDto>> GetByGroupAsync(int groupId);
        Task<List<GroupApprovalStepCoordinatorDto>> ReplaceAsync(int groupId, ReplaceGroupApprovalStepCoordinatorsDto request);

        // Thêm 1 người phụ trách nếu CHƯA có — mirror DepartmentApprovalStepCoordinatorService.EnsureCoordinatorAsync,
        // dùng cho EmployeeIdentityLinkImportService (2026-09-03). No-op nếu đã là người phụ trách.
        Task EnsureCoordinatorAsync(int groupId, int employeeId);
    }
}
