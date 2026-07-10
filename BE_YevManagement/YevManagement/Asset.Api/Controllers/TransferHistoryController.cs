using Asset.Application.Dtos.TransferHistories;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    [AllowAnonymous]
    public class TransferHistoryController : BaseController
    {
        private readonly ITransferHistoryService _transferHistoryService;
        public TransferHistoryController(ITransferHistoryService transferHistoryService)
        {
            _transferHistoryService = transferHistoryService;
        }

        [HttpPost]
        public async Task<IActionResult> Transfer([FromBody] CreateTransferHistoryDto request)
        {
            var result = await _transferHistoryService.TransferAsync(request);
            return CreatedSuccess(nameof(GetByDevice), new { deviceId = result.NewDeviceId }, result, "Chuyển máy thành công.");
        }

        [HttpGet("device/{deviceId}")]
        public async Task<ActionResult<ApiResponse<List<TransferHistoryDto>>>> GetByDevice(int deviceId)
        {
            var result = await _transferHistoryService.GetByDeviceIdAsync(deviceId);
            return Success(result);
        }
    }
}
