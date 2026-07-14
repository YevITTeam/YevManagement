using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class DeviceEmail
{
    public int Id { get; set; }

    public int DeviceId { get; set; }

    public string Email { get; set; } = null!;

    public string? Note { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Device Device { get; set; } = null!;
}
