using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.ProductionEmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeImportService
    {
        Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream);

        Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request);

        // Mục 5 (2026-08-27) — xem EmployeeOtHourLimitImportResultDto. userName/isAdmin (2026-08-29) —
        // scope THEO TỪNG DÒNG qua IDepartmentAccessGuard, xem docs/docs-be/attendance-module.md §Phân
        // quyền theo Phòng ban.
        Task<EmployeeOtHourLimitImportResultDto> ImportOtHourLimitsAsync(Stream excelFileStream, string userName, bool isAdmin);

        // Import lũy kế OT theo THÁNG cho MỌI Phòng ban (2026-09-03) — tự đọc file Excel (2 cột: MNV +
        // Tổng giờ), khác ProductionEmployeeImportService.ApplyAccumulationAsync (nhận Rows đã parse sẵn
        // từ FE, dành riêng cho luồng nhân sự dưới chuyền). Dùng lại NGUYÊN permission
        // Attendance.EmployeeAccumulation.Import + cùng cơ chế scope theo từng dòng qua
        // IDepartmentAccessGuard — xem docs/docs-be/attendance-module.md §Phân quyền theo Phòng ban.
        Task<ProductionEmployeeAccumulationResultDto> ImportMonthlyAccumulationAsync(
            Stream excelFileStream, int year, int month, string userName, bool isAdmin);

        // File mẫu tải xuống cho 3 kiểu import trên (2026-08-27, mở rộng 2026-09-03) — không đụng
        // DB nên KHÔNG async, chỉ dựng workbook tĩnh trong bộ nhớ.
        (byte[] Content, string FileName) GenerateTemplate();

        (byte[] Content, string FileName) GenerateOtHourLimitTemplate();

        (byte[] Content, string FileName) GenerateMonthlyAccumulationTemplate();
    }
}
