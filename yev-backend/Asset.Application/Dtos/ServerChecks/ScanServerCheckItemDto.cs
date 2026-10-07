using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.ServerChecks
{
    public class ScanServerCheckItemDto
    {
        // Dòng 1 của QR dán trên thiết bị — luôn là Device.DeviceCode (§5.4b asset-module.md §4).
        [Required(ErrorMessage = "Vui lòng quét mã QR thiết bị.")]
        public string DeviceCode { get; set; } = null!;
    }
}
