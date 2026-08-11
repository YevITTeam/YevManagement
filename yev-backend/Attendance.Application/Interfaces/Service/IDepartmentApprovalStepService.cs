using Attendance.Application.Dtos.DepartmentApprovalSteps;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentApprovalStepService
    {
        // userName/isAdmin dùng để scope-check (2026-08-11) — Admin xem/sửa được mọi Bộ phận, người
        // không phải Admin chỉ xem/sửa được Bộ phận mình được gán phụ trách (xem
        // DepartmentApprovalStepCoordinator, docs/docs-be/attendance-module.md §Cây chức vụ).
        Task<List<DepartmentApprovalStepDto>> GetByDepartmentAsync(string userName, bool isAdmin, int departmentId);
        Task<List<DepartmentApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int departmentId, ReplaceDepartmentApprovalStepsDto request);
    }
}
