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

    // Automatically resolved from the AD "mail" attribute at login (MyClaimsTransformation.GetActualEmail) —
    // used to send signature/form-approval confirmation emails (Attendance module). Nullable because
    // not every AD account has mail available, and the system never needed Email before this feature.
    public string? Email { get; set; }

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();

    public virtual ICollection<LoginUserIP> LoginUserIPs { get; set; } = new List<LoginUserIP>();

    public virtual ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
}
