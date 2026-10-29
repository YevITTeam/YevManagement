using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.ProductionEmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeImportService
    {
        Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string userName, bool isAdmin);

        Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request, string userName, bool isAdmin);

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
        Task<(byte[] Content, string FileName)> GenerateTemplateAsync();

        (byte[] Content, string FileName) GenerateOtHourLimitTemplate();

        (byte[] Content, string FileName) GenerateMonthlyAccumulationTemplate();

        // Current data of the filtered employees in the matching template, to edit and re-import.
        Task<(byte[] Content, string FileName)> ExportEmployeesAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin);
        Task<(byte[] Content, string FileName)> ExportOtHourLimitsAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin);
        Task<(byte[] Content, string FileName)> ExportMonthlyAccumulationAsync(EmployeeExportFilterDto filter, int year, int month, string userName, bool isAdmin);
    }
}
