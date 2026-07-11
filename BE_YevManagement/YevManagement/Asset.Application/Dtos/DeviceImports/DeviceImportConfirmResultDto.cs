namespace Asset.Application.Dtos.DeviceImports
{
    public class DeviceImportConfirmResultDto
    {
        public int CreatedCount { get; set; }
        public List<int> CreatedDeviceIds { get; set; } = new();

        // Số Device vừa tạo có kèm DeviceConfiguration (dòng Excel có ít nhất 1 trong 5
        // cột Hãng/Model/CPU/RAM/Ổ Cứng, 2026-07-11).
        public int CreatedConfigCount { get; set; }

        // Danh sách gợi ý "máy cũ sẽ chuyển sang máy mới vừa tạo" lấy từ cột MQL Cũ.
        // Import KHÔNG tự chuyển máy nữa (2026-07-11) — chỉ tạo Device rồi trả gợi ý
        // này để FE điền sẵn (nhưng cho sửa) trên màn hình "Chuyển máy", người dùng
        // phải tự bấm "Chuyển" cho từng dòng thì mới thật sự gọi POST /api/TransferHistory.
        public List<DeviceImportPendingTransferDto> PendingTransfers { get; set; } = new();

        // Dòng còn lỗi validate ở thời điểm Confirm bị bỏ qua, KHÔNG chặn cả batch nữa
        // (2026-07-11, đổi — trước đó có bất kỳ dòng lỗi nào thì không ghi gì cả). Dòng hợp
        // lệ vẫn được tạo bình thường; dòng lỗi liệt kê ở đây kèm lý do để FE báo lại.
        public int SkippedCount { get; set; }
        public List<DeviceImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
