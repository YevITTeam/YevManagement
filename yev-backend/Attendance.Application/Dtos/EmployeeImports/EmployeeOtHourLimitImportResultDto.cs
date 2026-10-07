namespace Attendance.Application.Dtos.EmployeeImports
{
    // Import hàng loạt giới hạn giờ OT/tháng/năm riêng từng nhân viên (mục 5, 2026-08-27 — xem
    // attendance-module.md §Lũy kế & giới hạn giờ OT). KHÔNG dùng cơ chế
    // Preview/Confirm 2 bước như EmployeeImportService.PreviewAsync/ConfirmAsync — chỉ update 2 field
    // số nullable trên nhân viên ĐÃ TỒN TẠI (không tạo mới, không có Department/Group phụ thuộc để rà
    // trước như import Employee đầy đủ), nên áp dụng thẳng và trả lại kết quả từng dòng để xem lại.
    public class EmployeeOtHourLimitImportResultDto
    {
        public int UpdatedCount { get; set; }

        public int SkippedCount { get; set; }

        public List<EmployeeOtHourLimitImportRowResultDto> Rows { get; set; } = new();
    }

    public class EmployeeOtHourLimitImportRowResultDto
    {
        public int RowNumber { get; set; }

        public string EmployeeCode { get; set; } = null!;

        public bool Success { get; set; }

        // Null nếu Success=true.
        public string? Error { get; set; }

        // Giá trị ĐÃ ÁP DỤNG (null nếu ô đó để trống trong file — nghĩa là GIỮ NGUYÊN override cũ, xem
        // EmployeeOtHourLimitImportService.ApplyAsync — không phải null nghĩa là xoá override).
        public decimal? MonthlyLimit { get; set; }

        public decimal? YearlyLimit { get; set; }
    }
}
