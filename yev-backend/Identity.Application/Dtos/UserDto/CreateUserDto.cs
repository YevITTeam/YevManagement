using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.UserDto
{
    public class CreateUserDto
    {
        [Required(ErrorMessage = "Tên đăng nhập không được để trống")]
        [MaxLength(100, ErrorMessage = "Tên đăng nhập không được vượt quá 100 ký tự")]
        public string UserName { get; set; } = null!;

        // Not required (2026-07-11, changed back — removed its role as the login "key").
        // For reference/display only; MyClaimsTransformation now matches the User at login
        // purely by UserName, no longer depending on DeviceName resolved via reverse-DNS
        // (unreliable, previously caused duplicate User creation — see notes in docs/identity-module.md).
        [MaxLength(100, ErrorMessage = "Tên thiết bị không được vượt quá 100 ký tự")]
        public string? DeviceName { get; set; }

        public string? FullName { get; set; }

        public List<int> RoleIds { get; set; } = new List<int>();
    }
}
