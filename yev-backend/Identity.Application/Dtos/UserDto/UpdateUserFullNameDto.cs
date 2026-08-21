using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.UserDto
{
    public class UpdateUserFullNameDto
    {
        public int UserId { get; set; }

        [Required(ErrorMessage = "Họ tên không được để trống")]
        [MaxLength(100, ErrorMessage = "Họ tên không được vượt quá 100 ký tự")]
        public string FullName { get; set; } = null!;
    }
}
