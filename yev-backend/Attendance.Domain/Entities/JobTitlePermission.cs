namespace Attendance.Domain.Entities;

// Only JobTitlePermissionWhitelist codes are allowed. PermissionCode is a plain string because Permissions live in
// the Identity database (no cross-DB FK); synced via IUserDirectoryService.SyncAutoGrantedPermissionsAsync.
public partial class JobTitlePermission
{
    public int Id { get; set; }

    public int JobTitleId { get; set; }

    public string PermissionCode { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual JobTitle JobTitle { get; set; } = null!;
}
