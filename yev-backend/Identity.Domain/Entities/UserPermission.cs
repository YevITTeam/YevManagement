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

    // true = row was written automatically by JobTitlePermission sync (Attendance module, via
    // IUserDirectoryService.SyncAutoGrantedPermissionsAsync) because the linked Employee holds a
    // Chức vụ (JobTitle) whose configured permission set includes this code — NOT a manual grant by
    // an Admin. Lets the sync safely auto-revoke stale auto-granted rows when JobTitleId/UserName
    // changes, without ever touching rows an Admin granted/denied by hand via "Tuỳ chỉnh quyền"
    // (UpdateUserPermissionOverridesAsync only replaces rows where IsAutoGranted=false — see
    // docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ").
    public bool IsAutoGranted { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Permission Permission { get; set; } = null!;
}
