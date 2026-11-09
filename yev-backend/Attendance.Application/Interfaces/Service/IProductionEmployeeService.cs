using Attendance.Application.Dtos.ProductionEmployees;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeService
    {
        Task<List<ProductionEmployeeSearchItemDto>> SearchAsync(
            int? productionLineId, int? teamId, int? shiftTeamId, string? congDoan, string? keyword, DateOnly? targetDate);

        Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId);
        Task<List<ProductionOptionDto>> GetTeamOptionsAsync();
        Task<List<ProductionOptionDto>> GetShiftTeamOptionsAsync(int? productionLineId, int? teamId);

        Task<List<string>> GetCongDoanOptionsAsync();

        // Scoped to departments the caller coordinates.
        Task UpdateAsync(int employeeId, UpdateProductionEmployeeDto request, string callerUserName, bool isAdmin);
    }
}
