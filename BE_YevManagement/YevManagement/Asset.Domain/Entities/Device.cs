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

    public DateTime PurchaseDate { get; set; }

    public DateTime? ExpirationDate { get; set; }

    public int DepreciationMonths { get; set; }

    public bool IsOutsourced { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public string? SerialNumber { get; set; }

    public bool IsUseUsb { get; set; }

    public int? ReplacesOldDeviceId { get; set; }

    public int? GroupId { get; set; }

    public int? DepartmentId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Branch Branch { get; set; } = null!;

    public virtual Device? ReplacesOldDevice { get; set; }

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
