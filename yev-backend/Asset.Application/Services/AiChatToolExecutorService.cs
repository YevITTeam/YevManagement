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
    // Read-only tools that call existing Asset services directly, so business rules are not duplicated.
    // Every tool caps results at MaxResults so it doesn't flood the model's context.
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
            // This JSON is only fed back to the model, never HTML; escaped non-ASCII makes the small model echo raw \uXXXX in its own text.
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
            // Only filled by device tools; used for FE deep-link stream events, never sent to the model.
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
            // Mirrors DeviceFilterRequest 1:1 so anything filterable on the grid is answerable in chat.
            var request = new DeviceFilterRequest
            {
                PageIndex = 1,
                PageSize = MaxResults,
                DeviceCode = GetDeviceCodeArg(args, "deviceCode"),
                Manager = GetStringArg(args, "manager"),
                IpAddress = GetStringArg(args, "ipAddress"),
                Email = GetStringArg(args, "email"),
                SupplierName = GetStringArg(args, "supplierName"),
                PurchaseDate = GetStringArg(args, "purchaseDate"),
                GroupId = GetIntArg(args, "groupId"),
                DepartmentId = GetIntArg(args, "departmentId"),
                Note = GetStringArg(args, "note"),
                SerialNumber = GetStringArg(args, "serialNumber"),
                IsOutsourced = GetBoolArg(args, "isOutsourced"),
                IsUseUsb = GetBoolArg(args, "isUseUsb"),
                SortDeviceCodeAscending = GetBoolArg(args, "sortDeviceCodeAscending"),
                // Pass names straight through to avoid a name->id lookup round.
                BranchName = GetStringArg(args, "branchName"),
                GroupName = GetStringArg(args, "groupName"),
                DepartmentName = GetStringArg(args, "departmentName"),
                Status = GetIntArg(args, "status")
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

            // Null-checked, never truthy-checked: Status=0 is Available and isInUse=false means free, both useful values.
            var request = new IpAddressFilterRequest
            {
                PageIndex = 1,
                PageSize = MaxResults,
                Keyword = GetStringArg(args, "keyword"),
                Status = GetIntArg(args, "status"),
                IsInUse = GetBoolArg(args, "isInUse"),
                DeviceId = deviceId
            };
            var result = await _ipAddressService.GetPagedAsync(request);

            // Return the total with the capped list, otherwise "any free IPs?" answers are misleading.
            return new
            {
                totalCount = result.TotalCount,
                returnedCount = result.Data.Count,
                items = result.Data
            };
        }

        private async Task<object> GetIpPrefixUsageAsync(JsonElement args)
        {
            var prefix = GetStringArg(args, "prefix");
            if (prefix == null) return MissingArgError("prefix");

            var usage = await _ipAddressService.GetPrefixUsageAsync(prefix);
            if (usage == null) return new { error = $"Không tìm thấy dải mạng '{prefix}'." };

            // Counts are taken BEFORE truncation so the model can state real totals even when the list is cut.
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
                DeviceTypeIds = deviceTypeId.HasValue ? new List<int> { deviceTypeId.Value } : null,
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

        // Same resolution as the import services (Contains, prefer exact case-insensitive hit); returns the canonical
        // DeviceCode so callers can build the FE deep-link without a second query.
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

        // Small models send numbers/booleans as strings, so accept both; null (not 0/false) means "no filter"
        // because 0/false are meaningful values (Status=0 = Available, IsOutsourced=false = in-house).
        private static int? GetIntArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
            if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed)) return parsed;
            return null;
        }

        private static bool? GetBoolArg(JsonElement args, string name)
        {
            if (args.ValueKind != JsonValueKind.Object) return null;
            if (!args.TryGetProperty(name, out var value)) return null;

            if (value.ValueKind == JsonValueKind.True) return true;
            if (value.ValueKind == JsonValueKind.False) return false;
            if (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out var parsed)) return parsed;
            return null;
        }

        private static DateTime? ParseDateArg(JsonElement args, string name)
        {
            var raw = GetStringArg(args, name);
            if (raw == null) return null;

            return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
                ? parsed
                : null;
        }

        // Users and the model mangle the dash in codes ("ydc 9875", "ydc9875"); normalize deterministically.
        // Anchored so only a plain "letters+digits" string is rewritten (DeviceCode has no format validation).
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
