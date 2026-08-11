using Attendance.Application.Dtos.DepartmentApprovalStepCoordinators;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentApprovalStepCoordinatorService
    {
        Task<List<DepartmentApprovalStepCoordinatorDto>> GetByDepartmentAsync(int departmentId);
        Task<List<DepartmentApprovalStepCoordinatorDto>> ReplaceAsync(int departmentId, ReplaceDepartmentApprovalStepCoordinatorsDto request);
    }
}
