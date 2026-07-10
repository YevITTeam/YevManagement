using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.UserDto
{
    public class CreateUserDto
    {
        [Required(ErrorMessage = "Tên đăng nhập không được để trống")]
        [MaxLength(100, ErrorMessage = "Tên đăng nhập không được vượt quá 100 ký tự")]
        public string UserName { get; set; } = null!;

        // Bắt buộc — đây chính là "chìa khoá" để login sau này khớp đúng bản ghi
        // User này (xem MyClaimsTransformation: định danh đăng nhập là cặp
        // UserName+DeviceName). Phải nhập đúng hostname (reverse DNS) của máy thật.
        [Required(ErrorMessage = "Tên thiết bị không được để trống")]
        [MaxLength(100, ErrorMessage = "Tên thiết bị không được vượt quá 100 ký tự")]
        public string DeviceName { get; set; } = null!;

        public string? FullName { get; set; }

        public List<int> RoleIds { get; set; } = new List<int>();
    }
}
