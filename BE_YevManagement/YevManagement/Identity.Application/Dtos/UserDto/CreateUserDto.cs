using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.UserDto
{
    public class CreateUserDto
    {
        [Required(ErrorMessage = "Tên đăng nhập không được để trống")]
        [MaxLength(100, ErrorMessage = "Tên đăng nhập không được vượt quá 100 ký tự")]
        public string UserName { get; set; } = null!;

        // Không bắt buộc (2026-07-11, đổi lại — bỏ vai trò "chìa khoá" đăng nhập).
        // Chỉ để tham khảo/hiển thị; MyClaimsTransformation giờ khớp User lúc login
        // theo UserName suông, không còn phụ thuộc DeviceName resolve qua reverse-DNS
        // (không ổn định, từng gây tạo trùng User — xem ghi chú ở docs/identity-module.md).
        [MaxLength(100, ErrorMessage = "Tên thiết bị không được vượt quá 100 ký tự")]
        public string? DeviceName { get; set; }

        public string? FullName { get; set; }

        public List<int> RoleIds { get; set; } = new List<int>();
    }
}
