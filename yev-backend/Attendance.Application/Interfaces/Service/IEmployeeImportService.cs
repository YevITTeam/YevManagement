using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.ProductionEmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeImportService
    {
        Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string userName, bool isAdmin);

        Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request, string userName, bool isAdmin);

        // Scoped per row via IDepartmentAccessGuard.
        Task<EmployeeOtHourLimitImportResultDto> ImportOtHourLimitsAsync(Stream excelFileStream, string userName, bool isAdmin);

        // Any department; reads a 2-column file (code + hours), unlike the production flow which receives parsed rows.
        // Scoped per row via IDepartmentAccessGuard.
        Task<ProductionEmployeeAccumulationResultDto> ImportMonthlyAccumulationAsync(
            Stream excelFileStream, int year, int month, string userName, bool isAdmin);

        // T1..T12 columns found by header; a blank month cell leaves that month untouched.
        Task<ProductionEmployeeAccumulationResultDto> ImportYearlyAccumulationAsync(
            Stream excelFileStream, int year, string userName, bool isAdmin);

        Task<(byte[] Content, string FileName)> GenerateTemplateAsync();

        (byte[] Content, string FileName) GenerateOtHourLimitTemplate();

        (byte[] Content, string FileName) GenerateMonthlyAccumulationTemplate();

        (byte[] Content, string FileName) GenerateYearlyAccumulationTemplate();

        // Current data of the filtered employees in the matching template, to edit and re-import.
        Task<(byte[] Content, string FileName)> ExportEmployeesAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin);
        Task<(byte[] Content, string FileName)> ExportOtHourLimitsAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin);
        Task<(byte[] Content, string FileName)> ExportMonthlyAccumulationAsync(EmployeeExportFilterDto filter, int year, int month, string userName, bool isAdmin);
        Task<(byte[] Content, string FileName)> ExportYearlyAccumulationAsync(EmployeeExportFilterDto filter, int year, string userName, bool isAdmin);
    }
}
