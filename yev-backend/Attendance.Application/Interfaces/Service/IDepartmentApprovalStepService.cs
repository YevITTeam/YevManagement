using Attendance.Application.Dtos.DepartmentApprovalSteps;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentApprovalStepService
    {
        Task<List<DepartmentApprovalStepDto>> GetByDepartmentAsync(int departmentId);
        Task<List<DepartmentApprovalStepDto>> ReplaceAsync(int departmentId, ReplaceDepartmentApprovalStepsDto request);
    }
}
