using Asset.Application.Dtos.UsbLogs;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IUsbLogService
    {
        Task<UsbIngestResultDto> IngestAsync(UsbIngestRequest request);

        Task<PagedResponse<UsbMachineDto>> GetMachinesPagedAsync(UsbMachineFilterRequest filter);
        Task<byte[]> ExportMachinesAsync(UsbMachineFilterRequest filter);

        Task<PagedResponse<UsbSessionDto>> GetSessionsPagedAsync(UsbSessionFilterRequest filter);

        Task<byte[]> ExportSessionsAsync(UsbSessionFilterRequest filter);

        Task<PagedResponse<UsbFileSearchDto>> SearchFilesPagedAsync(UsbFileFilterRequest filter);

        Task<byte[]> ExportFileEventsAsync(UsbFileFilterRequest filter);

        Task<List<UsbMachineUsbDto>> GetMachineUsbsAsync(string machineName);

        Task<PagedResponse<UsbFileEventDto>> GetSessionFilesPagedAsync(
            Guid sessionId, int pageIndex, int pageSize, string? keyword, string? sortBy, bool sortDesc, bool sensitiveOnly);
    }
}
