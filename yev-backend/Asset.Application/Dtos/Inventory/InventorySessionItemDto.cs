using System;

namespace Asset.Application.Dtos.Inventory
{
    public class InventorySessionItemDto
    {
        public int Id { get; set; }
        public int DeviceId { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string? DeviceTypeName { get; set; }
        public string? Manager { get; set; }
        public string? GroupName { get; set; }
        public string? DepartmentName { get; set; }
        public string? SerialNumber { get; set; }
        public DateTime? ScannedAt { get; set; }
        public string? ScannedBy { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public string? Note { get; set; }
    }
}
