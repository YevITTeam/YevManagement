using Asset.Application.Dtos.ServerChecks;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class ServerCheckController : BaseController
    {
        private readonly IServerCheckService _serverCheckService;

        public ServerCheckController(IServerCheckService serverCheckService)
        {
            _serverCheckService = serverCheckService;
        }

        [RequirePermission("Asset.ServerCheck.View")]
        [HttpGet("today")]
        public async Task<ActionResult<ApiResponse<ServerCheckSessionDto?>>> GetToday([FromQuery] int? branchId = null)
        {
            var result = await _serverCheckService.GetTodaySessionAsync(branchId);
            return Success(result);
        }

        [RequirePermission("Asset.ServerCheck.Scan")]
        [HttpPost("start")]
        public async Task<ActionResult<ApiResponse<ServerCheckSessionDto>>> Start()
        {
            var result = await _serverCheckService.StartSessionAsync();
            return Success(result, "Bắt đầu phiên kiểm tra thành công.");
        }

        [RequirePermission("Asset.ServerCheck.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<ServerCheckSessionDto>>> GetById(int id)
        {
            var result = await _serverCheckService.GetSessionByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.ServerCheck.Scan")]
        [HttpPost("{id}/scan")]
        public async Task<ActionResult<ApiResponse<ServerCheckItemDto>>> Scan(int id, [FromBody] ScanServerCheckItemDto request)
        {
            var result = await _serverCheckService.ScanAsync(id, request);
            return Success(result, $"Đã ghi nhận kiểm tra {result.DeviceCode} - {result.DeviceName}.");
        }

        [RequirePermission("Asset.ServerCheck.Scan")]
        [HttpPost("{id}/end")]
        public async Task<ActionResult<ApiResponse<ServerCheckSessionDto>>> End(int id, [FromBody] EndServerCheckSessionDto request)
        {
            var result = await _serverCheckService.EndSessionAsync(id, request);
            return Success(result, "Kết thúc phiên kiểm tra thành công.");
        }

        [RequirePermission("Asset.ServerCheck.Scan")]
        [HttpGet("manual-items")]
        public async Task<ActionResult<ApiResponse<List<ServerCheckManualItemDto>>>> GetManualItems()
        {
            var result = await _serverCheckService.GetManualItemsAsync();
            return Success(result);
        }

        [RequirePermission("Asset.ServerCheck.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<ServerCheckSessionDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 30,
            [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, [FromQuery] int? branchId = null)
        {
            var result = await _serverCheckService.GetSessionsPagedAsync(pageIndex, pageSize, fromDate, toDate, branchId);
            return Success(result);
        }

        [RequirePermission("Asset.ServerCheck.View")]
        [HttpGet("report")]
        public async Task<ActionResult<ApiResponse<List<ServerCheckReportRowDto>>>> GetReport(
            [FromQuery] DateTime fromDate, [FromQuery] DateTime toDate, [FromQuery] int? branchId = null)
        {
            var result = await _serverCheckService.GetReportAsync(fromDate, toDate, branchId);
            return Success(result);
        }

        [RequirePermission("Asset.ServerCheck.Scan")]
        [HttpGet("network-ping")]
        public async Task<ActionResult<ApiResponse<NetworkPingResultDto>>> PingNetwork()
        {
            var result = await _serverCheckService.PingNetworkAsync();
            return Success(result);
        }

        // Trả file .xlsx điền vào ĐÚNG file mẫu giấy gốc — KHÔNG phải ApiResponse<T> (cùng lý do
        // DeviceConfigurationImportController.GetMissingDevicesReport: body là 1 file nhị phân).
        [RequirePermission("Asset.ServerCheck.View")]
        [HttpGet("report/export")]
        public async Task<IActionResult> ExportReport([FromQuery] DateTime fromDate, [FromQuery] DateTime toDate, [FromQuery] int? branchId = null)
        {
            var (content, fileName) = await _serverCheckService.ExportReportAsync(fromDate, toDate, branchId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
