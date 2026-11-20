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
        private readonly IUsbPolicyService _usbPolicyService;
        private readonly IConfiguration _configuration;

        public UsbLogController(IUsbLogService usbLogService, IUsbPolicyService usbPolicyService, IConfiguration configuration)
        {
            _usbLogService = usbLogService;
            _usbPolicyService = usbPolicyService;
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

        // Heartbeat + policy pull, about once a minute per agent.
        [AllowAnonymous]
        [HttpPost("agent-sync")]
        public async Task<ActionResult<ApiResponse<UsbAgentSyncResponse>>> AgentSync([FromBody] UsbAgentSyncRequest request)
        {
            if (!IsAgentKeyValid()) return Unauthorized();

            var result = await _usbPolicyService.SyncAgentAsync(request);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("devices")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UsbDeviceDto>>>> GetDevices([FromQuery] UsbDeviceFilterRequest filter)
        {
            var result = await _usbPolicyService.GetDevicesPagedAsync(filter);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("devices/{id:int}/approve")]
        public async Task<ActionResult<ApiResponse<bool>>> Approve(int id, [FromBody] UsbApprovalRequest request)
        {
            await _usbPolicyService.SetApprovalAsync(id, true, request.Note);
            return Success(true, "Đã cấp phép USB.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("devices/{id:int}/revoke")]
        public async Task<ActionResult<ApiResponse<bool>>> Revoke(int id)
        {
            await _usbPolicyService.SetApprovalAsync(id, false, null);
            return Success(true, "Đã thu hồi cấp phép USB.");
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("policy")]
        public async Task<ActionResult<ApiResponse<UsbPolicySettingDto>>> GetPolicy()
        {
            var result = await _usbPolicyService.GetSettingAsync();
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPut("policy")]
        public async Task<ActionResult<ApiResponse<UsbPolicySettingDto>>> UpdatePolicy([FromBody] UsbPolicySettingDto request)
        {
            var result = await _usbPolicyService.UpdateSettingAsync(request);
            return Success(result, "Đã lưu chế độ chặn USB.");
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("agents")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UsbAgentDto>>>> GetAgents([FromQuery] UsbAgentFilterRequest filter)
        {
            var result = await _usbPolicyService.GetAgentsPagedAsync(filter);
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
        [HttpGet("machine-usbs")]
        public async Task<ActionResult<ApiResponse<List<UsbMachineUsbDto>>>> GetMachineUsbs([FromQuery] string machineName)
        {
            var result = await _usbLogService.GetMachineUsbsAsync(machineName);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("sessions/{id:guid}/files")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UsbFileEventDto>>>> GetSessionFiles(
            Guid id, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null,
            [FromQuery] string? sortBy = null, [FromQuery] bool sortDesc = false)
        {
            var result = await _usbLogService.GetSessionFilesPagedAsync(id, pageIndex, pageSize, keyword, sortBy, sortDesc);
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
