using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.ServerChecks
{
    public class ScanServerCheckItemDto
    {
        // First line of the device QR label, always Device.DeviceCode.
        [Required(ErrorMessage = "Vui lòng quét mã QR thiết bị.")]
        public string DeviceCode { get; set; } = null!;
    }
}
