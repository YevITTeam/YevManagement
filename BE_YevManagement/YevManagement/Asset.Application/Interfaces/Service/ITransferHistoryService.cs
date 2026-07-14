using Asset.Application.Dtos.TransferHistories;

namespace Asset.Application.Interfaces.Service
{
    public interface ITransferHistoryService
    {
        Task<TransferHistoryDto> TransferAsync(CreateTransferHistoryDto request);
        Task<List<TransferHistoryDto>> GetByDeviceIdAsync(int deviceId);
    }
}
