using Attendance.Application.Dtos.ProductionEmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeImportService
    {
        // userName/isAdmin (2026-08-29) — scope theo Phòng ban qua IDepartmentAccessGuard, xem
        // docs/docs-be/attendance-module.md §Phân quyền theo Phòng ban.
        Task<ProductionEmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string userName, bool isAdmin);

        Task<ProductionEmployeeImportConfirmResultDto> ConfirmAsync(ConfirmProductionEmployeeImportDto request, string userName, bool isAdmin);

        Task<ProductionEmployeeAccumulationResultDto> ApplyAccumulationAsync(ApplyProductionEmployeeAccumulationDto request, string userName, bool isAdmin);

        // File mẫu tải xuống (2026-08-27, theo yêu cầu người dùng) — không đụng DB nên KHÔNG async.
        (byte[] Content, string FileName) GenerateTemplate();
    }
}
