using System.Security.Cryptography;
using System.Text;
using Asset.Application.Dtos.UsbLogs;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    // USB activity log (asset-module.md §1.24). Ingest is called by the PC agent, which has no user token.
    public class UsbLogController : BaseController
    {
        private const string AgentKeyHeader = "X-Agent-Key";

        private readonly IUsbLogService _usbLogService;
        private readonly IConfiguration _configuration;

        public UsbLogController(IUsbLogService usbLogService, IConfiguration configuration)
        {
            _usbLogService = usbLogService;
            _configuration = configuration;
        }

        [AllowAnonymous]
        [HttpPost("ingest")]
        public async Task<ActionResult<ApiResponse<UsbIngestResultDto>>> Ingest([FromBody] UsbIngestRequest request)
        {
            if (!IsAgentKeyValid()) return Unauthorized();

            var result = await _usbLogService.IngestAsync(request);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("machines")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UsbMachineDto>>>> GetMachines([FromQuery] UsbMachineFilterRequest filter)
        {
            var result = await _usbLogService.GetMachinesPagedAsync(filter);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("sessions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UsbSessionDto>>>> GetSessions([FromQuery] UsbSessionFilterRequest filter)
        {
            var result = await _usbLogService.GetSessionsPagedAsync(filter);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("sessions/{id:guid}/files")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UsbFileEventDto>>>> GetSessionFiles(
            Guid id, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _usbLogService.GetSessionFilesPagedAsync(id, pageIndex, pageSize, keyword);
            return Success(result);
        }

        // Fails closed: an empty configured key rejects every call. Constant-time compare avoids leaking the key.
        private bool IsAgentKeyValid()
        {
            var expected = _configuration["UsbAgent:ApiKey"];
            var provided = Request.Headers[AgentKeyHeader].FirstOrDefault();
            if (string.IsNullOrEmpty(expected) || string.IsNullOrEmpty(provided)) return false;

            return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(provided));
        }
    }
}
