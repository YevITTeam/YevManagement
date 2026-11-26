using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.UsbLogs
{
    public class UsbDeviceFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Keyword { get; set; }
        public bool? IsApproved { get; set; }
        public string? DeviceClass { get; set; }
        public int? BranchId { get; set; }
        public int? DepartmentId { get; set; }
        public string? SortBy { get; set; }
        public bool SortDesc { get; set; }
    }

    public class UsbDeviceDto
    {
        public int Id { get; set; }
        public string VendorId { get; set; } = null!;
        public string ProductId { get; set; } = null!;
        public string SerialNumber { get; set; } = null!;
        public string? FriendlyName { get; set; }
        public string? Alias { get; set; }
        public long? CapacityBytes { get; set; }
        public string DeviceClass { get; set; } = null!;
        public bool IsApproved { get; set; }
        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovalNote { get; set; }
        public int AccessLevel { get; set; }
        public bool IsSharedSerial { get; set; }
        public int? BranchId { get; set; }
        public string? BranchName { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public DateTime FirstSeenAt { get; set; }
        public DateTime LastSeenAt { get; set; }
        public int SessionCount { get; set; }
        public string? LastMachineName { get; set; }
        // Per-machine approvals; empty when IsApproved (every machine) or not approved at all.
        public List<UsbApprovedMachineDto> ApprovedMachines { get; set; } = new();
    }

    public class UsbApprovedMachineDto
    {
        public int DeviceId { get; set; }
        public string DeviceCode { get; set; } = null!;
    }

    // Replaces the USB's whole approval scope: every machine, or exactly DeviceIds.
    public class UsbApprovalRequest
    {
        [StringLength(255, ErrorMessage = "Ghi chú tối đa 255 ký tự.")]
        public string? Note { get; set; }
        public bool AllMachines { get; set; } = true;
        // UsbAccessLevel: 1 read-only, 2 read-write.
        [Range(1, 2, ErrorMessage = "Quyền không hợp lệ.")]
        public int AccessLevel { get; set; } = 2;
        public List<int> DeviceIds { get; set; } = new();
        [Range(1, int.MaxValue, ErrorMessage = "Chọn xưởng sở hữu USB.")]
        public int BranchId { get; set; }
        [Range(1, int.MaxValue, ErrorMessage = "Chọn bộ phận sở hữu USB.")]
        public int DepartmentId { get; set; }
    }

    public class UsbOwnerOptionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
    }

    public class UsbOwnerOptionsDto
    {
        public List<UsbOwnerOptionDto> Branches { get; set; } = new();
        public List<UsbOwnerOptionDto> Departments { get; set; } = new();
    }

    // Empty or whitespace clears the alias.
    public class UsbAliasRequest
    {
        [StringLength(100, ErrorMessage = "Tên gợi nhớ tối đa 100 ký tự.")]
        public string? Alias { get; set; }
    }

    // Asset devices with a PC computer name, for the per-machine approval picker.
    public class UsbMachineOptionDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
    }

    public class UsbPolicySettingDto
    {
        // UsbBlockMode: 0 Off, 1 Audit, 2 Enforce.
        [Range(0, 2, ErrorMessage = "Chế độ không hợp lệ.")]
        public int Mode { get; set; }

        [StringLength(4000, ErrorMessage = "Danh sách máy tối đa 4000 ký tự.")]
        public string? EnforceMachines { get; set; }
    }

    public class UsbAgentFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Keyword { get; set; }
        public bool StaleOnly { get; set; }
        public int? BranchId { get; set; }
        public int? DepartmentId { get; set; }
        public string? SortBy { get; set; }
        public bool SortDesc { get; set; }
    }

    public class UsbAgentDto
    {
        public int Id { get; set; }
        public string MachineName { get; set; } = null!;
        public string? AgentVersion { get; set; }
        public string? WindowsUser { get; set; }
        public DateTime FirstSeenAt { get; set; }
        public DateTime LastSeenAt { get; set; }
        public bool IsStale { get; set; }
        public string? DeviceCode { get; set; }
        public string? BranchName { get; set; }
        public string? DepartmentName { get; set; }
        // UsbAgentEventType of the latest lifecycle event; null for agents before 1.3.
        public int? LastEventType { get; set; }
        public DateTime? LastEventAt { get; set; }
    }

    public class UsbAgentEventDto
    {
        public int EventType { get; set; }
        public DateTime OccurredAt { get; set; }
        public string? Actor { get; set; }
        public string? Detail { get; set; }
    }

    public class UsbAgentSettingDto
    {
        public bool TrackCopyIn { get; set; }
        public bool HasUninstallPassword { get; set; }
        public string? TargetVersion { get; set; }
        public string? UpdateMachines { get; set; }
        public int SyncSeconds { get; set; }
        public int? PurgeUninstalledDays { get; set; }
    }

    public class UsbAgentSettingRequest
    {
        public bool TrackCopyIn { get; set; }

        // Capped at 10 minutes: an agent silent for 15 minutes counts as offline.
        [Range(15, 600, ErrorMessage = "Chu kỳ đồng bộ từ 15 đến 600 giây.")]
        public int SyncSeconds { get; set; } = 60;

        [Range(1, 3650, ErrorMessage = "Số ngày từ 1 đến 3650.")]
        public int? PurgeUninstalledDays { get; set; }

        [StringLength(20, ErrorMessage = "Phiên bản tối đa 20 ký tự.")]
        public string? TargetVersion { get; set; }

        [StringLength(4000, ErrorMessage = "Danh sách máy tối đa 4000 ký tự.")]
        public string? UpdateMachines { get; set; }
    }

    // Deletes agent rows matching either criterion; their lifecycle log and USB history stay.
    public class UsbAgentPurgeRequest
    {
        public bool Uninstalled { get; set; }

        [Range(1, 3650, ErrorMessage = "Số ngày từ 1 đến 3650.")]
        public int? OfflineDays { get; set; }
    }

    public class UsbStatsDto
    {
        public int AgentCount { get; set; }
        public int AgentOnlineCount { get; set; }
        public int AgentStaleCount { get; set; }
        public int MachinesConnectedNow { get; set; }
        public int BlockedNow { get; set; }
        public int SessionsToday { get; set; }
        public int BlockedToday { get; set; }
        public int SensitiveFilesToday { get; set; }
        public int StorageUsbCount { get; set; }
        public int ApprovedUsbCount { get; set; }
    }

    // Empty clears the password.
    public class UsbUninstallPasswordRequest
    {
        [StringLength(100, ErrorMessage = "Mật khẩu tối đa 100 ký tự.")]
        public string? Password { get; set; }
    }

    public class UsbAgentReleaseDto
    {
        public int Id { get; set; }
        public string Version { get; set; } = null!;
        public long SizeBytes { get; set; }
        public string Sha256 { get; set; } = null!;
        public string? Note { get; set; }
        public string? UploadedBy { get; set; }
        public DateTime UploadedAt { get; set; }
    }

    public class UsbAgentSyncRequest
    {
        [Required(ErrorMessage = "Tên máy là bắt buộc.")]
        [StringLength(100, ErrorMessage = "Tên máy tối đa 100 ký tự.")]
        public string MachineName { get; set; } = null!;
        public string? AgentVersion { get; set; }
        public string? WindowsUser { get; set; }
        public string? PolicyVersion { get; set; }
    }

    // Approved is null when the agent's PolicyVersion is current, so the minute-by-minute sync stays tiny.
    public class UsbAgentSyncResponse
    {
        public int Mode { get; set; }
        public string PolicyVersion { get; set; } = null!;
        // "VID|PID|SERIAL", upper case, read-write.
        public List<string>? Approved { get; set; }
        // Approved read-only; null together with Approved. Agents before 1.3 ignore it and keep these write-blocked.
        public List<string>? ReadOnly { get; set; }
        public bool TrackCopyIn { get; set; }
        public string? UninstallPasswordHash { get; set; }
        // Agents before 1.4 ignore it and keep their configured interval.
        public int SyncSeconds { get; set; }
        // Set only when this machine should run another version.
        public UsbAgentUpdateDto? Update { get; set; }
    }

    public class UsbAgentUpdateDto
    {
        public string Version { get; set; } = null!;
        public string Sha256 { get; set; } = null!;
        public string Signature { get; set; } = null!;
    }
}
