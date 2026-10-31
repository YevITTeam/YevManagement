using Attendance.Application.Dtos.ProductionEmployees;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeService
    {
        Task<List<ProductionEmployeeSearchItemDto>> SearchAsync(
            int? productionLineId, int? teamId, int? shiftTeamId, string? congDoan, string? keyword, DateOnly? targetDate);

        Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId);
        Task<List<ProductionOptionDto>> GetTeamOptionsAsync();
        Task<List<ProductionOptionDto>> GetShiftTeamOptionsAsync(int? productionLineId, int? teamId);

        // departmentId is the optional FE filter; coordinator scope from callerUserName/isAdmin is always applied.
        Task<PagedResponse<ProductionEmployeeListItemDto>> GetPagedAsync(
            string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword,
            int? productionLineId, int? teamId, int? shiftTeamId, int? departmentId);

        // Scoped to departments the caller coordinates.
        Task UpdateAsync(int id, UpdateProductionEmployeeDto request, string callerUserName, bool isAdmin);
    }
}
