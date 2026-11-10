using System;
using System.Collections.Generic;

namespace Identity.Domain.Entities;

public class LocalAccountPrefix
{
    public int Id { get; set; }

    public string Prefix { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedByUserName { get; set; }

    public virtual ICollection<LocalLoginAccount> Accounts { get; set; } = new List<LocalLoginAccount>();
}
