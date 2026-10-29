using Attendance.Application.Dtos.EmployeeIdentityLinkImports;

namespace Attendance.Application.Interfaces.Service
{
    // Import Excel hàng loạt liên kết Employee ↔ User Identity + tự tạo tài khoản nếu chưa có + gán chữ
    // ký (2026-09-03, Admin-only). Preview VÀ Confirm đều tự đọc file trực tiếp — xem
    // EmployeeIdentityLinkImportRowDto để biết lý do không truyền Rows qua JSON như các import khác.
    public interface IEmployeeIdentityLinkImportService
    {
        Task<EmployeeIdentityLinkImportPreviewResultDto> PreviewAsync(Stream excelFileStream);

        Task<EmployeeIdentityLinkImportConfirmResultDto> ConfirmAsync(Stream excelFileStream);

        Task<(byte[] Content, string FileName)> GenerateTemplateAsync();

        // Current links of the filtered employees in the template layout, to edit and re-import.
        Task<(byte[] Content, string FileName)> ExportAsync(Dtos.Employees.EmployeeExportFilterDto filter, string userName, bool isAdmin);
    }
}
