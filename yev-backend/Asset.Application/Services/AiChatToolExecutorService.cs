using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Asset.Application.Dtos.AiChat;
using Asset.Application.Dtos.AuditTrails;
using Asset.Application.Dtos.Devices;
using Asset.Application.Dtos.IpAddresses;
using Asset.Application.Interfaces.Service;
using Shared.Application.Wrapper;

namespace Asset.Application.Services
{
    // Implements the 17 read-only tools from docs/ai-chat-be-huong-dan.md §5 by calling straight into
    // the existing Asset Application services — no repository access of its own, no duplicated
    // business rules (soft-delete filtering, status text, etc. all come from those services as-is).
    // Every tool caps results at MaxResults so a chatty tool doesn't flood the model's context.
    public class AiChatToolExecutorService : IAiChatToolExecutorService
    {
        private const int MaxResults = 10;
        // Wider net for name->id resolution than for a result list: the user-typed name might not be
        // the very first alphabetical match, but should still be found somewhere near the top.
        private const int ResolveSearchLimit = 20;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            // Default encoder escapes all non-ASCII as \uXXXX (safe-by-default for HTML embedding),
            // but this JSON only ever becomes a "tool" message's plain-text content sent back to
            // Ollama — never embedded in HTML — so that protection is pure downside here: the model
            // (gemma4:e2b) sees Vietnamese text arrive pre-escaped ("Mỹ PHƯỚC") and,
            // being small, mimics that literal \uXXXX surface form even in the free text it generates
            // itself afterwards, so the FE ends up displaying raw escape codes instead of diacritics
            // (2026-07-27 fix).
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        private readonly IDeviceService _deviceService;
        private readonly ITransferHistoryService _transferHistoryService;
        private readonly IAuditTrailService _auditTrailService;
        private readonly IDeviceTypeService _deviceTypeService;
        private readonly IDeviceGroupService _deviceGroupService;
        private readonly IDeviceDepartmentService _deviceDepartmentService;
        private readonly ISoftwareService _softwareService;
        private readonly IIpAddressService _ipAddressService;
        private readonly IBranchService _branchService;
        private readonly ISupplierService _supplierService;
        private readonly ISoftwareGroupService _softwareGroupService;
        private readonly IIpPrefixService _ipPrefixService;
        private readonly IAssetSettingService _assetSettingService;

        public AiChatToolExecutorService(
            IDeviceService deviceService,
            ITransferHistoryService transferHistoryService,
            IAuditTrailService auditTrailService,
            IDeviceTypeService deviceTypeService,
            IDeviceGroupService deviceGroupService,
            IDeviceDepartmentService deviceDepartmentService,
            ISoftwareService softwareService,
            IIpAddressService ipAddressService,
            IBranchService branchService,
            ISupplierService supplierService,
            ISoftwareGroupService softwareGroupService,
            IIpPrefixService ipPrefixService,
            IAssetSettingService assetSettingService)
        {
            _deviceService = deviceService;
            _transferHistoryService = transferHistoryService;
            _auditTrailService = auditTrailService;
            _deviceTypeService = deviceTypeService;
            _deviceGroupService = deviceGroupService;
            _deviceDepartmentService = deviceDepartmentService;
            _softwareService = softwareService;
            _ipAddressService = ipAddressService;
            _branchService = branchService;
            _supplierService = supplierService;
            _softwareGroupService = softwareGroupService;
            _ipPrefixService = ipPrefixService;
            _assetSettingService = assetSettingService;
        }

        public async Task<AiChatToolExecutionResult> ExecuteAsync(string toolName, JsonElement arguments, CancellationToken cancellationToken)
        {
            // Populated only by the device-related tools below — used to emit {"type":"device"} stream
            // events for the FE's deep-link buttons (docs §11). Never sent to the model.
            var deviceReferences = new List<AiChatDeviceReferenceDto>();

            object result;
            try
            {
                result = toolName switch
                {
                    "search_devices" => await SearchDevicesAsync(arguments, deviceReferences),
                    "get_device_detail" => await GetDeviceDetailAsync(arguments, deviceReferences),
                    "get_device_transfer_history" => await GetDeviceTransferHistoryAsync(arguments, deviceReferences),
                    "get_device_change_history" => await GetDeviceChangeHistoryAsync(arguments, deviceReferences),
                    "search_device_types" => await SearchPagedAsync(() => _deviceTypeService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_device_groups" => await SearchPagedAsync(() => _deviceGroupService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_device_departments" => await SearchPagedAsync(() => _deviceDepartmentService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_software" => await SearchPagedAsync(() => _softwareService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_ip_addresses" => await SearchIpAddressesAsync(arguments),
                    "search_branches" => await SearchPagedAsync(() => _branchService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_suppliers" => await SearchPagedAsync(() => _supplierService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_software_groups" => await SearchPagedAsync(() => _softwareGroupService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "search_ip_prefixes" => await SearchPagedAsync(() => _ipPrefixService.GetPagedAsync(1, MaxResults, GetStringArg(arguments, "keyword"))),
                    "get_ip_prefix_usage" => await GetIpPrefixUsageAsync(arguments),
                    "get_device_report" => await GetDeviceReportAsync(arguments),
                    "get_asset_settings" => await _assetSettingService.GetAsync(),
                    "search_audit_trail" => await SearchAuditTrailAsync(arguments),
                    _ => new { error = $"Không hỗ trợ tool '{toolName}'." }
                };
            }
            catch (Exception ex)
            {
                result = new { error = ex.Message };
            }

            return new AiChatToolExecutionResult
            {
                Json = JsonSerializer.Serialize(result, JsonOptions),
                DeviceReferences = deviceReferences
            };
        }

        private async Task<object> SearchDevicesAsync(JsonElement args, List<AiChatDeviceReferenceDto> deviceReferences)
        {
            var request = new DeviceFilterRequest
            {
                PageIndex = 1,
                PageSize = MaxResults,
                DeviceCode = GetDeviceCodeArg(args, "deviceCode"),
                Manager = GetStringArg(args, "manager"),
                IpAddress = GetStringArg(args, "ipAddress"),
                Email = GetStringArg(args, "email"),
                SupplierName = GetStringArg(args, "supplierName")
            };
            var result = await _deviceService.GetDevicesForGridAsync(request);
            deviceReferences.AddRange(result.Data.Select(d => new AiChatDeviceReferenceDto { Id = d.Id, DeviceCode = d.DeviceCode }));
            return result.Data;
        }

        private async Task<object> GetDeviceDetailAsync(JsonElement args, List<AiChatDeviceReferenceDto> deviceReferences)
        {
            var deviceCode = GetDeviceCodeArg(args, "deviceCode");
            if (deviceCode == null) return MissingArgError("deviceCode");

            var resolved = await ResolveDeviceIdByCodeAsync(deviceCode);
            if (resolved == null) return DeviceNotFoundError(deviceCode);

            var detail = await _deviceService.GetDetailAsync(resolved.Value.Id);
            deviceReferences.Add(new AiChatDeviceReferenceDto { Id = resolved.Value.Id, DeviceCode = resolved.Value.DeviceCode });
            return detail;
        }

        private async Task<object> GetDeviceTransferHistoryAsync(JsonElement args, List<AiChatDeviceReferenceDto> deviceReferences)
        {
            var deviceCode = GetDeviceCodeArg(args, "deviceCode");
            if (deviceCode == null) return MissingArgError("deviceCode");

            var resolved = await ResolveDeviceIdByCodeAsync(deviceCode);
            if (resolved == null) return DeviceNotFoundError(deviceCode);

            var history = await _transferHistoryService.GetByDeviceIdAsync(resolved.Value.Id);
            deviceReferences.Add(new AiChatDeviceReferenceDto { Id = resolved.Value.Id, DeviceCode = resolved.Value.DeviceCode });
            return history.Take(MaxResults).ToList();
        }

        private async Task<object> GetDeviceChangeHistoryAsync(JsonElement args, List<AiChatDeviceReferenceDto> deviceReferences)
        {
            var deviceCode = GetDeviceCodeArg(args, "deviceCode");
            if (deviceCode == null) return MissingArgError("deviceCode");

            var resolved = await ResolveDeviceIdByCodeAsync(deviceCode);
            if (resolved == null) return DeviceNotFoundError(deviceCode);

            var history = await _auditTrailService.GetByRecordAsync("Device", resolved.Value.Id);
            deviceReferences.Add(new AiChatDeviceReferenceDto { Id = resolved.Value.Id, DeviceCode = resolved.Value.DeviceCode });
            return history.Take(MaxResults).ToList();
        }

        private async Task<object> SearchIpAddressesAsync(JsonElement args)
        {
            var deviceCode = GetDeviceCodeArg(args, "deviceCode");
            int? deviceId = null;
            if (deviceCode != null)
            {
                var resolved = await ResolveDeviceIdByCodeAsync(deviceCode);
                if (resolved == null) return DeviceNotFoundError(deviceCode);
                deviceId = resolved.Value.Id;
            }

            var request = new IpAddressFilterRequest
            {
                PageIndex = 1,
                PageSize = MaxResults,
                Keyword = GetStringArg(args, "keyword"),
                DeviceId = deviceId
            };
            var result = await _ipAddressService.GetPagedAsync(request);
            return result.Data;
        }

        private async Task<object> GetIpPrefixUsageAsync(JsonElement args)
        {
            var prefix = GetStringArg(args, "prefix");
            if (prefix == null) return MissingArgError("prefix");

            var usage = await _ipAddressService.GetPrefixUsageAsync(prefix);
            if (usage == null) return new { error = $"Không tìm thấy dải mạng '{prefix}'." };

            // Same MaxResults cap as every other list tool (§5) — counts are computed from the full
            // set BEFORE truncation so the model can still state the real totals even when the list
            // itself is cut short (a /24 can have 200+ free IPs, far more than is worth spending
            // tokens on).
            return new
            {
                usage.Prefix,
                usage.TotalIpCount,
                usage.UsedCount,
                usage.AvailableCount,
                UsedIpAddresses = usage.UsedIpAddresses.Take(MaxResults).ToList(),
                AvailableIpAddresses = usage.AvailableIpAddresses.Take(MaxResults).ToList()
            };
        }

        private async Task<object> GetDeviceReportAsync(JsonElement args)
        {
            var deviceTypeName = GetStringArg(args, "deviceTypeName");
            int? deviceTypeId = null;
            if (deviceTypeName != null)
            {
                deviceTypeId = await ResolveDeviceTypeIdByNameAsync(deviceTypeName);
                if (deviceTypeId == null) return new { error = $"Không tìm thấy loại thiết bị '{deviceTypeName}'." };
            }

            var branchName = GetStringArg(args, "branchName");
            int? branchId = null;
            if (branchName != null)
            {
                branchId = await ResolveBranchIdByNameAsync(branchName);
                if (branchId == null) return new { error = $"Không tìm thấy chi nhánh '{branchName}'." };
            }

            var request = new DeviceReportFilterRequest
            {
                DeviceTypeId = deviceTypeId,
                BranchId = branchId,
                Keyword = GetStringArg(args, "keyword")
            };
            var result = await _deviceService.GetReportListAsync(request);
            return result.Take(MaxResults).ToList();
        }

        private async Task<object> SearchAuditTrailAsync(JsonElement args)
        {
            var request = new AuditTrailFilterRequest
            {
                PageIndex = 1,
                PageSize = MaxResults,
                TableName = GetStringArg(args, "tableName"),
                Action = GetStringArg(args, "action"),
                ChangedBy = GetStringArg(args, "changedBy"),
                FromDate = ParseDateArg(args, "fromDate"),
                ToDate = ParseDateArg(args, "toDate")
            };
            var result = await _auditTrailService.GetPagedAsync(request);
            return result.Data;
        }

        private static async Task<object> SearchPagedAsync<T>(Func<Task<PagedResponse<T>>> query)
        {
            var result = await query();
            return result.Data;
        }

        // Model/user only knows the DeviceCode — resolve to an Id the same way the import services do
        // (Contains match, prefer an exact case-insensitive hit, else the first result). Returns the
        // canonical DeviceCode alongside the Id so callers can build a device reference for the FE's
        // deep-link button (docs §11) without a second query.
        private async Task<(int Id, string DeviceCode)?> ResolveDeviceIdByCodeAsync(string deviceCode)
        {
            var result = await _deviceService.GetDevicesForGridAsync(new DeviceFilterRequest
            {
                DeviceCode = deviceCode,
                PageIndex = 1,
                PageSize = ResolveSearchLimit
            });
            if (result.Data.Count == 0) return null;

            var match = result.Data.FirstOrDefault(d => string.Equals(d.DeviceCode, deviceCode, StringComparison.OrdinalIgnoreCase))
                ?? result.Data[0];
            return (match.Id, match.DeviceCode);
        }

        private async Task<int?> ResolveDeviceTypeIdByNameAsync(string name)
        {
            var result = await _deviceTypeService.GetPagedAsync(1, ResolveSearchLimit, name);
            if (result.Data.Count == 0) return null;

            var exact = result.Data.FirstOrDefault(t => string.Equals(t.TypeName, name, StringComparison.OrdinalIgnoreCase));
            return (exact ?? result.Data[0]).Id;
        }

        private async Task<int?> ResolveBranchIdByNameAsync(string name)
        {
            var result = await _branchService.GetPagedAsync(1, ResolveSearchLimit, name);
            if (result.Data.Count == 0) return null;

            var exact = result.Data.FirstOrDefault(b => string.Equals(b.BranchName, name, StringComparison.OrdinalIgnoreCase));
            return (exact ?? result.Data[0]).Id;
        }

        private static object MissingArgError(string paramName) => new { error = $"Thiếu tham số '{paramName}'." };
        private static object DeviceNotFoundError(string deviceCode) => new { error = $"Không tìm thấy thiết bị có mã '{deviceCode}'." };

        private static string? GetStringArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;
            if (value.ValueKind != JsonValueKind.String) return null;

            var raw = value.GetString();
            return string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();
        }

        private static DateTime? ParseDateArg(JsonElement args, string name)
        {
            var raw = GetStringArg(args, name);
            if (raw == null) return null;

            return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
                ? parsed
                : null;
        }

        // Every real DeviceCode in this system is "letters-digits" (e.g. "ydc-9875") — but users typing
        // into chat (and the model itself) routinely drop/mangle the dash: "ydc 9875", "ydc_9875",
        // "ydc9875". The system prompt already tells the model to normalize this itself, but that is
        // not reliable with a small local model (docs ai-chat-be-huong-dan.md §11) — this is the
        // deterministic fix, applied to every tool argument that resolves a device by code (2026-07-27).
        // Anchored end-to-end (^...$) on purpose: only a plain "letters then digits, nothing else"
        // string gets rewritten, so a code that doesn't fit that 2-part shape is left untouched rather
        // than risking a wrong rewrite (DeviceCode has no format validation — see CreateDeviceDto).
        private static readonly Regex DeviceCodeSeparatorPattern = new(@"^([A-Za-z]+)[\s_-]*([0-9]+)$", RegexOptions.Compiled);

        private static string? NormalizeDeviceCode(string? raw)
        {
            if (raw == null) return null;
            var match = DeviceCodeSeparatorPattern.Match(raw);
            return match.Success ? $"{match.Groups[1].Value}-{match.Groups[2].Value}" : raw;
        }

        private static string? GetDeviceCodeArg(JsonElement args, string name) => NormalizeDeviceCode(GetStringArg(args, name));
    }
}
