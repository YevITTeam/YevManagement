using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class TransferHistory
{
    public int Id { get; set; }

    public int OldDeviceId { get; set; }

    public int NewDeviceId { get; set; }

    public DateTime TransferDate { get; set; }

    public string? Note { get; set; }

    public virtual Device NewDevice { get; set; } = null!;

    public virtual Device OldDevice { get; set; } = null!;
}
