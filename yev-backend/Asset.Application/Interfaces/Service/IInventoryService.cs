using Asset.Application.Dtos.Inventory;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IInventoryService
    {
        // Caller's assigned branch InProgress session, for the kiosk scan screen.
        Task<InventorySessionDto?> GetCurrentSessionAsync();

        Task<InventorySessionDto> StartSessionAsync();

        Task<InventorySessionDto> GetSessionByIdAsync(int id);

        Task<InventorySessionItemDto> ScanAsync(int sessionId, ScanInventoryItemDto request);

        Task<InventorySessionDto> EndSessionAsync(int sessionId, EndInventorySessionDto request);

        Task<PagedResponse<InventorySessionDto>> GetSessionsPagedAsync(int pageIndex, int pageSize, DateTime? fromDate, DateTime? toDate, int? branchId);

        Task<(byte[] Content, string FileName)> ExportSessionAsync(int sessionId);
    }
}
