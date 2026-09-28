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
        // ProductionEmployeeListItemDto. departmentId (filter FE chọn) lọc theo Employee.Group.
        // DepartmentId (thêm 2026-08-27 — dữ liệu về lý thuyết không chỉ riêng 1 Bộ phận "Chế tạo", dù
        // thực tế thường chỉ có 1). callerUserName/isAdmin dùng để SCOPE theo Người phụ trách
        // (2026-09-28) — không phải filter FE chọn được, luôn áp dụng.
        Task<PagedResponse<ProductionEmployeeListItemDto>> GetPagedAsync(
            string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword,
            int? productionLineId, int? teamId, int? shiftTeamId, int? departmentId);

        // Sửa tay Line/Team/Nhóm ca/Trưởng nhóm — bổ sung cho Import Excel (2026-09-04), xem
        // UpdateProductionEmployeeDto. callerUserName/isAdmin dùng để SCOPE theo Bộ phận phụ trách
        // (2026-09-28, cùng mô hình GetPagedAsync — CHỈ Bộ phận, không có Nhóm).
        Task UpdateAsync(int id, UpdateProductionEmployeeDto request, string callerUserName, bool isAdmin);
    }
}
