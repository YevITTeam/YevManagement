using System;
using System.Collections.Generic;

namespace Identity.Domain.Entities;

public class User
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string? FullName { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? DeviceName { get; set; }

    // Mirror of the primary UserEmail (null when the user has none). Filled from the AD "mail" attribute at
    // login only while the user has no email yet; afterwards admins manage it through UserEmails.
    public string? Email { get; set; }

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();

    public virtual ICollection<LoginUserIP> LoginUserIPs { get; set; } = new List<LoginUserIP>();

    public virtual ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();

    public virtual ICollection<UserEmail> UserEmails { get; set; } = new List<UserEmail>();

    public virtual LocalLoginAccount? LocalLoginAccount { get; set; }
}
