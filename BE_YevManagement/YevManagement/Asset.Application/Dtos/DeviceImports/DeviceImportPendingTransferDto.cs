namespace Asset.Application.Dtos.DeviceImports
{
    // 1 gợi ý thay thế máy rút ra từ cột "MQL Cũ" của dòng import. Chỉ mang tính gợi
    // ý/điền sẵn cho FE — không tự thực hiện chuyển máy (xem DeviceImportConfirmResultDto).
    public class DeviceImportPendingTransferDto
    {
        public int NewDeviceId { get; set; }
        public string NewDeviceCode { get; set; } = string.Empty;
        public int OldDeviceId { get; set; }
        public string OldDeviceCode { get; set; } = string.Empty;
    }
}
