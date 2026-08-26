using Shared.Application.Wrapper;
using Workflow.Application.Dtos.EmployeeOrgUnits;
using Workflow.Application.Dtos.Employees;

namespace Workflow.Application.Interfaces.Service
{
    public interface IEmployeeService
    {
        Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<EmployeeDto> GetByIdAsync(int id);
        Task<EmployeeDto> CreateAsync(CreateEmployeeDto request);
        Task UpdateAsync(UpdateEmployeeDto request);
        Task DeleteAsync(int id);

        Task<List<EmployeeOrgUnitDto>> GetOrgUnitsAsync(int employeeId);
        Task<List<EmployeeOrgUnitDto>> ReplaceOrgUnitsAsync(int employeeId, ReplaceEmployeeOrgUnitsDto request);
    }
}
