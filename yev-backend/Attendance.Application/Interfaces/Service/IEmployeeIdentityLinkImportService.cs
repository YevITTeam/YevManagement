using Attendance.Application.Dtos.EmployeeIdentityLinkImports;

namespace Attendance.Application.Interfaces.Service
{
    // Preview and Confirm both re-read the file instead of round-tripping Rows (see EmployeeIdentityLinkImportRowDto).
    public interface IEmployeeIdentityLinkImportService
    {
        Task<EmployeeIdentityLinkImportPreviewResultDto> PreviewAsync(Stream excelFileStream);

        Task<EmployeeIdentityLinkImportConfirmResultDto> ConfirmAsync(Stream excelFileStream);

        Task<(byte[] Content, string FileName)> GenerateTemplateAsync();

        // Current links of the filtered employees in the template layout, to edit and re-import.
        Task<(byte[] Content, string FileName)> ExportAsync(Dtos.Employees.EmployeeExportFilterDto filter, string userName, bool isAdmin);
    }
}
