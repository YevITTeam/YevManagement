namespace Asset.Application.Dtos.DeviceImports
{
    public class DeviceImportConfirmResultDto
    {
        public int CreatedCount { get; set; }
        public List<int> CreatedDeviceIds { get; set; } = new();

        // Danh sách gợi ý "máy cũ sẽ chuyển sang máy mới vừa tạo" lấy từ cột MQL Cũ.
        // Import KHÔNG tự chuyển máy nữa (2026-07-11) — chỉ tạo Device rồi trả gợi ý
        // này để FE điền sẵn (nhưng cho sửa) trên màn hình "Chuyển máy", người dùng
        // phải tự bấm "Chuyển" cho từng dòng thì mới thật sự gọi POST /api/TransferHistory.
        public List<DeviceImportPendingTransferDto> PendingTransfers { get; set; } = new();
    }
}
