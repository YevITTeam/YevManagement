using System;

namespace Identity.Domain.Entities;

public partial class UserPermission
{
    public int UserId { get; set; }

    public int PermissionId { get; set; }

    // true = grants this permission specifically to this User even if the Role doesn't have it.
    // false = revokes this permission specifically from this User even if the Role grants it.
    // Deny (false) always wins over Grant when computing the effective permission (see MyClaimsTransformation).
    public bool IsGranted { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Permission Permission { get; set; } = null!;
}
