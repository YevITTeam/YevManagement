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

        // Màn "Nhân viên dưới chuyền" (view riêng, đọc thẳng ProductionEmployees) — xem
        // ProductionEmployeeListItemDto. departmentId lọc theo Employee.Group.DepartmentId (thêm
        // 2026-08-27, theo yêu cầu người dùng — dữ liệu về lý thuyết không chỉ riêng 1 Bộ phận "Chế
        // tạo", dù thực tế thường chỉ có 1).
        Task<PagedResponse<ProductionEmployeeListItemDto>> GetPagedAsync(
            int pageIndex, int pageSize, string? keyword, int? productionLineId, int? teamId, int? shiftTeamId, int? departmentId);
    }
}
