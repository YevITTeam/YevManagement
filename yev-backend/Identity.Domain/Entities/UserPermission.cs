using System;

namespace Identity.Domain.Entities;

public partial class UserPermission
{
    public int UserId { get; set; }

    public int PermissionId { get; set; }

    // true grants beyond the Role, false revokes a Role grant; deny always wins.
    public bool IsGranted { get; set; }

    // Written by the job-title permission sync, so the sync can revoke stale rows without touching Admin's manual overrides.
    public bool IsAutoGranted { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Permission Permission { get; set; } = null!;
}
