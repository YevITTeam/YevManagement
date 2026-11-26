using System.Security.Cryptography;
using System.Text;
using Asset.Application.Dtos.UsbLogs;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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
        private const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("devices/export")]
        public async Task<IActionResult> ExportDevices([FromQuery] UsbDeviceFilterRequest filter)
            => File(await _usbPolicyService.ExportDevicesAsync(filter), XlsxType, $"ThietBiUSB_{Stamp()}.xlsx");

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("devices/{id:int}/approve")]
        public async Task<ActionResult<ApiResponse<bool>>> Approve(int id, [FromBody] UsbApprovalRequest request)
        {
            await _usbPolicyService.ApproveAsync(id, request);
            return Success(true, "Đã cấp phép USB.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("devices/{id:int}/revoke")]
        public async Task<ActionResult<ApiResponse<bool>>> Revoke(int id)
        {
            await _usbPolicyService.RevokeAsync(id);
            return Success(true, "Đã thu hồi cấp phép USB.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPut("devices/{id:int}/alias")]
        public async Task<ActionResult<ApiResponse<bool>>> SetAlias(int id, [FromBody] UsbAliasRequest request)
        {
            await _usbPolicyService.SetAliasAsync(id, request.Alias);
            return Success(true, "Đã lưu tên gợi nhớ.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("devices/{id:int}/machines/{deviceId:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> ApproveMachine(int id, int deviceId)
        {
            await _usbPolicyService.SetMachineApprovalAsync(id, deviceId, true);
            return Success(true, "Đã cấp phép USB cho máy này.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpDelete("devices/{id:int}/machines/{deviceId:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> RevokeMachine(int id, int deviceId)
        {
            await _usbPolicyService.SetMachineApprovalAsync(id, deviceId, false);
            return Success(true, "Đã thu hồi cấp phép USB ở máy này.");
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("owner-options")]
        public async Task<ActionResult<ApiResponse<UsbOwnerOptionsDto>>> GetOwnerOptions()
            => Success(await _usbPolicyService.GetOwnerOptionsAsync());

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpGet("machine-options")]
        public async Task<ActionResult<ApiResponse<List<UsbMachineOptionDto>>>> GetMachineOptions()
        {
            var result = await _usbPolicyService.GetMachineOptionsAsync();
            return Success(result);
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
        [HttpGet("agents/{machineName}/events")]
        public async Task<ActionResult<ApiResponse<List<UsbAgentEventDto>>>> GetAgentEvents(string machineName)
        {
            var result = await _usbPolicyService.GetAgentEventsAsync(machineName);
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("agents/export")]
        public async Task<IActionResult> ExportAgents([FromQuery] UsbAgentFilterRequest filter)
            => File(await _usbPolicyService.ExportAgentsAsync(filter), XlsxType, $"AgentUSB_{Stamp()}.xlsx");

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpDelete("agents/{id:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteAgent(int id)
        {
            await _usbPolicyService.DeleteAgentAsync(id);
            return Success(true, "Đã xoá máy khỏi danh sách agent.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("agents/purge")]
        public async Task<ActionResult<ApiResponse<int>>> PurgeAgents([FromBody] UsbAgentPurgeRequest request)
        {
            var count = await _usbPolicyService.PurgeAgentsAsync(request);
            return Success(count, $"Đã xoá {count} máy khỏi danh sách agent.");
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("stats")]
        public async Task<ActionResult<ApiResponse<UsbStatsDto>>> GetStats()
            => Success(await _usbPolicyService.GetStatsAsync());

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("agent-settings")]
        public async Task<ActionResult<ApiResponse<UsbAgentSettingDto>>> GetAgentSetting()
        {
            var result = await _usbPolicyService.GetAgentSettingAsync();
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPut("agent-settings")]
        public async Task<ActionResult<ApiResponse<UsbAgentSettingDto>>> UpdateAgentSetting([FromBody] UsbAgentSettingRequest request)
        {
            var result = await _usbPolicyService.UpdateAgentSettingAsync(request);
            return Success(result, "Đã lưu cài đặt agent.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPut("agent-settings/uninstall-password")]
        public async Task<ActionResult<ApiResponse<bool>>> SetUninstallPassword([FromBody] UsbUninstallPasswordRequest request)
        {
            await _usbPolicyService.SetUninstallPasswordAsync(request.Password);
            return Success(true, string.IsNullOrEmpty(request.Password) ? "Đã bỏ mật khẩu gỡ agent." : "Đã đặt mật khẩu gỡ agent.");
        }

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("agent-releases")]
        public async Task<ActionResult<ApiResponse<List<UsbAgentReleaseDto>>>> GetReleases()
        {
            var result = await _usbPolicyService.GetReleasesAsync();
            return Success(result);
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpPost("agent-releases")]
        [RequestSizeLimit(300L * 1024 * 1024)]
        public async Task<ActionResult<ApiResponse<UsbAgentReleaseDto>>> UploadRelease(IFormFile file, [FromForm] string? note)
        {
            if (file is null || file.Length == 0) return Fail<UsbAgentReleaseDto>("Chọn file YevUsbAgent.exe.");

            // App_Data survives deploys (AutoDeploy keeps it); the key file is copied there once per server.
            var configured = _configuration["UsbAgent:SigningKeyPath"];
            var keyPath = string.IsNullOrWhiteSpace(configured) ? "App_Data/usb-agent-update-key.xml" : configured;
            if (!Path.IsPathRooted(keyPath)) keyPath = Path.Combine(AppContext.BaseDirectory, keyPath);
            if (!System.IO.File.Exists(keyPath)) return Fail<UsbAgentReleaseDto>("Server chưa có khoá ký bản agent (App_Data/usb-agent-update-key.xml).");

            await using var stream = file.OpenReadStream();
            var result = await _usbPolicyService.UploadReleaseAsync(stream, file.FileName, await System.IO.File.ReadAllTextAsync(keyPath), note);
            return Success(result, $"Đã tải lên bản {result.Version}.");
        }

        [RequirePermission("Asset.UsbLog.Approve")]
        [HttpDelete("agent-releases/{id:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteRelease(int id)
        {
            await _usbPolicyService.DeleteReleaseAsync(id);
            return Success(true, "Đã xoá bản agent.");
        }

        // Called by the agent's updater; it checks hash and signature itself, so the key only guards bandwidth.
        [AllowAnonymous]
        [HttpGet("agent-releases/{version}/download")]
        public async Task<IActionResult> DownloadRelease(string version)
        {
            if (!IsAgentKeyValid()) return Unauthorized();

            var path = await _usbPolicyService.GetReleaseFilePathAsync(version);
            return path == null ? NotFound() : PhysicalFile(path, "application/octet-stream", "YevUsbAgent.exe");
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
        [HttpGet("sessions/export")]
        public async Task<IActionResult> ExportSessions([FromQuery] UsbSessionFilterRequest filter)
            => File(await _usbLogService.ExportSessionsAsync(filter), XlsxType, $"PhienCamUSB_{Stamp()}.xlsx");

        [RequirePermission("Asset.UsbLog.View")]
        [HttpGet("files/export")]
        public async Task<IActionResult> ExportFileEvents([FromQuery] UsbSessionFilterRequest filter)
            => File(await _usbLogService.ExportFileEventsAsync(filter), XlsxType, $"ThaoTacFileUSB_{Stamp()}.xlsx");

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
            [FromQuery] string? sortBy = null, [FromQuery] bool sortDesc = false, [FromQuery] bool sensitiveOnly = false)
        {
            var result = await _usbLogService.GetSessionFilesPagedAsync(id, pageIndex, pageSize, keyword, sortBy, sortDesc, sensitiveOnly);
            return Success(result);
        }

        private static string Stamp() => DateTime.UtcNow.AddHours(7).ToString("yyyyMMdd_HHmm");

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
