using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Inventory
{
    public class ScanInventoryItemDto
    {
        [Required(ErrorMessage = "Vui lòng nhập mã thiết bị.")]
        public string DeviceCode { get; set; } = null!;
    }
}
