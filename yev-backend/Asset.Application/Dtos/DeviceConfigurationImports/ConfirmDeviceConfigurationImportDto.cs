using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class ConfirmDeviceConfigurationImportDto
    {
        [Required(ErrorMessage = "Danh sách thiết bị cần import không được để trống")]
        [MinLength(1, ErrorMessage = "Danh sách thiết bị cần import không được để trống")]
        public List<DeviceConfigurationImportRowDto> Rows { get; set; } = new();

        // Create a role-Basic Identity user for each account that is active in the directory but unknown to Identity.
        public bool CreateMissingUsers { get; set; }

        // Replace a device's existing domain account with the one Tanium reports; off keeps hand-typed accounts.
        public bool OverwriteExistingAccount { get; set; }
    }
}
