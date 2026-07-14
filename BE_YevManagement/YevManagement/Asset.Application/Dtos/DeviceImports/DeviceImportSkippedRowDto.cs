namespace Asset.Application.Dtos.DeviceImports
{
    // 1 dòng bị bỏ qua (không import) ở bước Confirm vì còn lỗi validate — khác hành vi cũ
    // (chặn toàn bộ batch khi có bất kỳ dòng lỗi nào). Trả về để FE báo cho người dùng biết
    // dòng nào không được tạo và lý do (2026-07-11, đổi theo yêu cầu người dùng).
    public class DeviceImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? DeviceCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
