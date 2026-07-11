using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceEmailInputDto
    {
        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không đúng định dạng")]
        public string Email { get; set; } = null!;

        public string? Note { get; set; }
    }
}
