using Attendance.Application.Dtos.EmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeImportService
    {
        Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream);

        Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request);
    }
}
