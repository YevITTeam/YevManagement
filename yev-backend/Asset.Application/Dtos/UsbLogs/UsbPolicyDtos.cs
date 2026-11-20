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
        public long? CapacityBytes { get; set; }
        public string DeviceClass { get; set; } = null!;
        public bool IsApproved { get; set; }
        public string? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovalNote { get; set; }
        public DateTime FirstSeenAt { get; set; }
        public DateTime LastSeenAt { get; set; }
        public int SessionCount { get; set; }
        public string? LastMachineName { get; set; }
    }

    public class UsbApprovalRequest
    {
        [StringLength(255, ErrorMessage = "Ghi chú tối đa 255 ký tự.")]
        public string? Note { get; set; }
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
        // "VID|PID|SERIAL", upper case.
        public List<string>? Approved { get; set; }
    }
}
