namespace Asset.Application.Dtos.Devices
{
    // Gợi ý "máy nào sẽ nhận chuyển tới" cho màn hình "Chuyển máy" mở trên 1 máy cũ —
    // xem GET /api/Device/{id}/replacement-suggestion, docs/asset-module.md.
    public class DeviceReplacementSuggestionDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
    }
}
