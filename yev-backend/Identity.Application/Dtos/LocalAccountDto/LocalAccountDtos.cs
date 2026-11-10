using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.LocalAccountDto
{
    public class LocalAccountPrefixDto
    {
        public int Id { get; set; }
        public string Prefix { get; set; } = null!;
        public int AccountCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateLocalAccountPrefixDto
    {
        [Required(ErrorMessage = "Tiền tố không được để trống")]
        [RegularExpression("^[A-Za-z0-9]{2,30}$", ErrorMessage = "Tiền tố chỉ gồm chữ và số, dài 2-30 ký tự")]
        public string Prefix { get; set; } = null!;
    }

    public class CreateLocalAccountDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "Vui lòng chọn tiền tố")]
        public int PrefixId { get; set; }

        [Required(ErrorMessage = "Tên đăng nhập không được để trống")]
        [RegularExpression("^[A-Za-z0-9._-]{1,50}$", ErrorMessage = "Tên đăng nhập chỉ gồm chữ, số và . _ -, tối đa 50 ký tự")]
        public string LoginName { get; set; } = null!;

        [Required(ErrorMessage = "Họ tên không được để trống")]
        [MaxLength(100, ErrorMessage = "Họ tên không được vượt quá 100 ký tự")]
        public string FullName { get; set; } = null!;

        [Required(ErrorMessage = "Mật khẩu không được để trống")]
        [StringLength(128, MinimumLength = 8, ErrorMessage = "Mật khẩu phải từ 8 ký tự")]
        public string Password { get; set; } = null!;

        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [MaxLength(255, ErrorMessage = "Email không được vượt quá 255 ký tự")]
        public string? Email { get; set; }

        public List<int> RoleIds { get; set; } = new();
    }

    public class ResetLocalPasswordDto
    {
        [Required(ErrorMessage = "Mật khẩu không được để trống")]
        [StringLength(128, MinimumLength = 8, ErrorMessage = "Mật khẩu phải từ 8 ký tự")]
        public string NewPassword { get; set; } = null!;
    }

    public class ChangeOwnPasswordDto
    {
        [Required(ErrorMessage = "Vui lòng nhập mật khẩu hiện tại")]
        public string CurrentPassword { get; set; } = null!;

        [Required(ErrorMessage = "Mật khẩu mới không được để trống")]
        [StringLength(128, MinimumLength = 8, ErrorMessage = "Mật khẩu phải từ 8 ký tự")]
        public string NewPassword { get; set; } = null!;
    }
}
