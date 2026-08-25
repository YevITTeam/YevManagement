using Attendance.Application.Dtos.ProductionApprovalSteps;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionApprovalStepService
    {
        Task<List<ProductionApprovalStepDto>> GetByDepartmentAsync(string userName, bool isAdmin, int departmentId);
        Task<List<ProductionApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int departmentId, ReplaceProductionApprovalStepsDto request);
    }
}
