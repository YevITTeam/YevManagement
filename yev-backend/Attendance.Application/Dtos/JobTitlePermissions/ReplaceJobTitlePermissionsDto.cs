using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.JobTitlePermissions
{
    // Replaces the whole list; each code must be in JobTitlePermissionWhitelist.AllowedCodes. Empty clears it.
    public class ReplaceJobTitlePermissionsDto
    {
        [Required]
        public List<string> PermissionCodes { get; set; } = new();
    }
}
