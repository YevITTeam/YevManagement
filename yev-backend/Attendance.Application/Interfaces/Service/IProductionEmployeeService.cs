using Attendance.Application.Dtos.ProductionEmployees;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeService
    {
        Task<List<ProductionEmployeeSearchItemDto>> SearchAsync(
            int? productionLineId, int? teamId, int? shiftTeamId, string? congDoan, string? keyword);

        Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId);
        Task<List<ProductionOptionDto>> GetTeamOptionsAsync();
        Task<List<ProductionOptionDto>> GetShiftTeamOptionsAsync(int? productionLineId, int? teamId);
    }
}
