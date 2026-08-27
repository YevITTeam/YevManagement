namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ProductionEmployeeAccumulationResultDto
    {
        // Số nhân viên có chênh lệch (khác 0) giữa "OT month" trong file và lũy kế hệ thống đang tính
        // — đã ghi 1 dòng điều chỉnh vào EmployeeAccumulationHistory cho mỗi người.
        public int AdjustedCount { get; set; }

        // Không chênh lệch (đã khớp sẵn) — không cần ghi gì thêm.
        public int UnchangedCount { get; set; }

        public int SkippedCount { get; set; }
        public List<ProductionEmployeeAccumulationSkippedRowDto> SkippedRows { get; set; } = new();

        // Tổng số giờ đã điều chỉnh (có thể âm nếu số hệ thống đang cao hơn số trong file).
        public decimal TotalDeltaHours { get; set; }
    }

    public class ProductionEmployeeAccumulationSkippedRowDto
    {
        public string? EmployeeCode { get; set; }
        public string Reason { get; set; } = null!;
    }
}
