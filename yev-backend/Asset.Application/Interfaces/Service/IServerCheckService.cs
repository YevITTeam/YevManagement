using Asset.Application.Dtos.ServerChecks;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IServerCheckService
    {
        Task<ServerCheckSessionDto?> GetTodaySessionAsync();
        Task<ServerCheckSessionDto> StartSessionAsync();
        Task<ServerCheckSessionDto> GetSessionByIdAsync(int id);
        Task<ServerCheckItemDto> ScanAsync(int sessionId, ScanServerCheckItemDto request);
        Task<ServerCheckSessionDto> EndSessionAsync(int sessionId, EndServerCheckSessionDto request);
        Task<List<ServerCheckManualItemDto>> GetManualItemsAsync();
        Task<PagedResponse<ServerCheckSessionDto>> GetSessionsPagedAsync(int pageIndex, int pageSize, DateTime? fromDate, DateTime? toDate);
        Task<List<ServerCheckReportRowDto>> GetReportAsync(DateTime fromDate, DateTime toDate);
        Task<NetworkPingResultDto> PingNetworkAsync();
        Task<(byte[] Content, string FileName)> ExportReportAsync(DateTime fromDate, DateTime toDate);
    }
}
