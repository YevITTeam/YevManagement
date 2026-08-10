using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.JobTitlePermissions
{
    // Thay NGUYÊN danh sách permission code do 1 Chức vụ tự động cấp — mỗi code PHẢI thuộc
    // JobTitlePermissionWhitelist.AllowedCodes (validate ở JobTitlePermissionService.ReplaceAsync).
    // Gửi mảng rỗng để bỏ hết quyền tự động cấp của Chức vụ đó.
    public class ReplaceJobTitlePermissionsDto
    {
        [Required]
        public List<string> PermissionCodes { get; set; } = new();
    }
}
