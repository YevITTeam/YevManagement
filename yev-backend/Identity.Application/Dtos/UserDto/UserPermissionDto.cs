using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UserPermissionDto
    {
        public int PermissionId { get; set; }
        public string Code { get; set; }
        public string Module { get; set; }
        public string? Description { get; set; }

        // true = specifically granted to this user; false = specifically revoked from this user
        // (overrides the permission granted by the user's Role).
        public bool IsGranted { get; set; }

        // true = row was auto-written by JobTitlePermission sync (Attendance), not a manual Admin
        // grant/deny — FE uses this to show it read-only-ish and exclude it from what gets
        // resubmitted on save, so a manual save for 1 permission doesn't silently "claim" every
        // auto-granted permission this user currently has (see UpdateUserPermissionOverridesAsync).
        public bool IsAutoGranted { get; set; }
    }
}
