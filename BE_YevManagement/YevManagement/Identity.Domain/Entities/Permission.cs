using System;
using System.Collections.Generic;

namespace Identity.Domain.Entities;

public partial class Permission
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Module { get; set; } = null!;

    public string? Description { get; set; }

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();
}
