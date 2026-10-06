using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class Device
{
    public int Id { get; set; }

    public string DeviceCode { get; set; } = null!;

    public string DeviceName { get; set; } = null!;

    public int DeviceTypeId { get; set; }

    public int SupplierId { get; set; }

    public int BranchId { get; set; }

    public string Manager { get; set; } = null!;

    // Domain account (DOMAIN\user) of the last logged-in user, written only by the Tanium import. Reference
    // data only; Identity is the source of truth for accounts and emails.
    public string? ManagerDomainAccount { get; set; }

    public DateTime PurchaseDate { get; set; }

    public DateTime? ExpirationDate { get; set; }

    public int DepreciationMonths { get; set; }

    public bool IsOutsourced { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public string? SerialNumber { get; set; }

    public bool IsUseUsb { get; set; }

    // Added 2026-09-17: the device physically sits in the server room and carries a printed QR label,
    // so it must be scanned during the daily ServerCheck session (asset-module.md §1.19). Devices that
    // share a ServerCheckCategory but have no physical presence there (virtual servers, switches spread
    // across the factory) stay false — they are never scanned, only pinged (§1.20).
    public bool RequiresDailyCheck { get; set; }

    public int? SuggestedNewDeviceId { get; set; }

    public int? GroupId { get; set; }

    public int? DepartmentId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Branch Branch { get; set; } = null!;

    public virtual Device? SuggestedNewDevice { get; set; }

    public virtual DeviceGroup? DeviceGroup { get; set; }

    public virtual DeviceDepartment? DeviceDepartment { get; set; }

    public virtual DeviceConfiguration? DeviceConfiguration { get; set; }

    public virtual ICollection<DeviceEmail> DeviceEmails { get; set; } = new List<DeviceEmail>();

    public virtual ICollection<DeviceSoftware> DeviceSoftwares { get; set; } = new List<DeviceSoftware>();

    public virtual DeviceType DeviceType { get; set; } = null!;

    public virtual ICollection<IpAddress> IpAddresses { get; set; } = new List<IpAddress>();

    public virtual Supplier Supplier { get; set; } = null!;

    public virtual ICollection<TransferHistory> TransferHistoryNewDevices { get; set; } = new List<TransferHistory>();

    public virtual ICollection<TransferHistory> TransferHistoryOldDevices { get; set; } = new List<TransferHistory>();
}
