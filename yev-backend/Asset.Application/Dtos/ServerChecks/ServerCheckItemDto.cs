using System;

namespace Asset.Application.Dtos.ServerChecks
{
    public class ServerCheckItemDto
    {
        public int Id { get; set; }
        public int DeviceId { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public int Category { get; set; }
        public string CategoryText { get; set; } = null!;
        public DateTime? ScannedAt { get; set; }
        public string? ScannedBy { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public string? Note { get; set; }

        // True = phải quét QR; false = BE tự ping (hoặc auto-OK nếu không có IP) khi kết thúc phiên.
        public bool RequiresScan { get; set; }
    }
}
