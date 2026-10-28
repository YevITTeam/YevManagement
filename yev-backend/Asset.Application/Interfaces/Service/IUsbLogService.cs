using Asset.Application.Dtos.UsbLogs;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IUsbLogService
    {
        Task<UsbIngestResultDto> IngestAsync(UsbIngestRequest request);

        Task<PagedResponse<UsbMachineDto>> GetMachinesPagedAsync(UsbMachineFilterRequest filter);

        Task<PagedResponse<UsbSessionDto>> GetSessionsPagedAsync(UsbSessionFilterRequest filter);

        Task<PagedResponse<UsbFileEventDto>> GetSessionFilesPagedAsync(Guid sessionId, int pageIndex, int pageSize, string? keyword);
    }
}
