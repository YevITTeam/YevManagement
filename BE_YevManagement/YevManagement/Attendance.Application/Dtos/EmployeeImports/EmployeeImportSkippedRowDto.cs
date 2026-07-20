namespace Attendance.Application.Dtos.EmployeeImports
{
    // 1 dòng bị bỏ qua (không import) ở bước Confirm vì còn lỗi validate — dòng còn lại vẫn được
    // tạo bình thường, không chặn cả batch (cùng hành vi DeviceImportService ở module Asset).
    public class EmployeeImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
