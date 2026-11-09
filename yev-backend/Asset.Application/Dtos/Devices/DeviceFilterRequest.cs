using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public string? DeviceCode { get; set; }
        public string? Manager { get; set; }
        // Contains match on DOMAIN\user, so "nam.nguyen" and "YEV\nam" both work.
        public string? ManagerDomainAccount { get; set; }
        public string? PurchaseDate { get; set; }
        public string? IpAddress { get; set; }
        public string? Email { get; set; }
        public string? SupplierName { get; set; }
        public int? GroupId { get; set; }
        public int? DepartmentId { get; set; }
        public string? Note { get; set; }
        public bool? IsOutsourced { get; set; }
        public string? SerialNumber { get; set; }
        public bool? IsUseUsb { get; set; }
        // Lets the Device screen quickly gather devices that need QR labels for the server room.
        public bool? RequiresDailyCheck { get; set; }
        public int? BranchId { get; set; }
        public int? DeviceTypeId { get; set; }
        // 0=PendingUse, 1=InUse, 2=PendingLiquidation, 3=Liquidated, 4=UnderRepair (Asset.Domain.Enums.DeviceStatus).
        public int? Status { get; set; }
        // Inclusive: ExpirationDate <= ExpiryDate.
        public DateTime? ExpiryDate { get; set; }

        // Null = default order (PurchaseDate desc); true = ascending, false = descending.
        public bool? SortDeviceCodeAscending { get; set; }
        // Sort by numeric IPv4 value; takes precedence over SortDeviceCodeAscending. true = ascending.
        public bool? SortIpAddressAscending { get; set; }

        // Name-based filters for the AI chat (the grid filters by id). Accepting names avoids a separate name->id
        // tool call, which small local models fail to chain; same Contains() semantics as SupplierName.
        public string? BranchName { get; set; }
        public string? GroupName { get; set; }
        public string? DepartmentName { get; set; }
    }
}
