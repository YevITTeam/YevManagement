using Attendance.Application.Dtos.EmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeImportService
    {
        Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream);

        Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request);

        // Mục 5 (2026-08-27) — xem EmployeeOtHourLimitImportResultDto.
        Task<EmployeeOtHourLimitImportResultDto> ImportOtHourLimitsAsync(Stream excelFileStream);

        // File mẫu tải xuống cho 2 kiểu import trên (2026-08-27, theo yêu cầu người dùng) — không đụng
        // DB nên KHÔNG async, chỉ dựng workbook tĩnh trong bộ nhớ.
        (byte[] Content, string FileName) GenerateTemplate();

        (byte[] Content, string FileName) GenerateOtHourLimitTemplate();
    }
}
