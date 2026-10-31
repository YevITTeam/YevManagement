using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Dtos.Departments;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentApprovalStepService
    {
        // Non-Admins may only view/edit departments they coordinate.
        Task<List<DepartmentApprovalStepDto>> GetByDepartmentAsync(string userName, bool isAdmin, int departmentId);
        Task<List<DepartmentApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int departmentId, ReplaceDepartmentApprovalStepsDto request);

        // Coordinators only see their own departments so they can't pick one that would 403.
        Task<List<ApprovalTreeDepartmentDto>> GetMyManagedDepartmentsAsync(string userName, bool isAdmin);
    }
}
