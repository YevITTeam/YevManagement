using System;
using System.Collections.Generic;

namespace Identity.Domain.Entities;

public partial class User
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string? FullName { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? LastLoginIp { get; set; }

    public string? DeviceName { get; set; }

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();
}
