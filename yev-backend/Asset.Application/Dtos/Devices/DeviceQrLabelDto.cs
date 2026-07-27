using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Devices
{
    // Request to build QR labels for a set of devices ticked on the grid (2026-07-23). Bulk only —
    // there is no single-device variant; printing 1 device just sends a list of 1.
    public class DeviceQrLabelRequestDto
    {
        [Required(ErrorMessage = "Danh sách thiết bị cần in mã QR không được để trống.")]
        [MinLength(1, ErrorMessage = "Danh sách thiết bị cần in mã QR không được để trống.")]
        public List<int> Ids { get; set; } = new();
    }

    // All printable fields of one device plus a ready-to-encode QrPayload. The FE draws the QR itself
    // (BE only returns data) and lets the user pick which fields to actually print on the label — so
    // every field is returned even if a given label doesn't show all of them.
    public class DeviceQrLabelDto
    {
        public int DeviceId { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string? DeviceTypeName { get; set; }
        public string? BranchName { get; set; }
        public string? SupplierName { get; set; }
        public string? Manager { get; set; }
        public string? SerialNumber { get; set; }
        public string StatusText { get; set; } = null!;
        public DateTime PurchaseDate { get; set; }

        // Default multi-line text to encode into the QR. Line 1 is ALWAYS the bare DeviceCode so an
        // internal scanner app can split it off and look the device up, while a plain phone camera
        // still shows the whole block as readable text. The FE may rebuild this from the fields above
        // when the user customises which fields to encode, but must keep line 1 = DeviceCode.
        public string QrPayload { get; set; } = null!;
    }
}
