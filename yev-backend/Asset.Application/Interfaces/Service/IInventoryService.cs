using Asset.Application.Dtos.Inventory;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IInventoryService
    {
        // Phiên InProgress của xưởng người gọi được phân công (asset-module.md §1.22) — dùng cho màn quét kiosk.
        Task<InventorySessionDto?> GetCurrentSessionAsync();

        Task<InventorySessionDto> StartSessionAsync();

        Task<InventorySessionDto> GetSessionByIdAsync(int id);

        Task<InventorySessionItemDto> ScanAsync(int sessionId, ScanInventoryItemDto request);

        Task<InventorySessionDto> EndSessionAsync(int sessionId, EndInventorySessionDto request);

        Task<PagedResponse<InventorySessionDto>> GetSessionsPagedAsync(int pageIndex, int pageSize, DateTime? fromDate, DateTime? toDate, int? branchId);

        Task<List<InventoryReportRowDto>> GetReportAsync(DateTime fromDate, DateTime toDate, int? branchId);

        Task<(byte[] Content, string FileName)> ExportReportAsync(DateTime fromDate, DateTime toDate, int? branchId);
    }
}
