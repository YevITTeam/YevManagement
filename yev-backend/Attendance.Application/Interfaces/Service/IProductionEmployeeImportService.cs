using Attendance.Application.Dtos.ProductionEmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeImportService
    {
        // Scoped by department via IDepartmentAccessGuard.
        Task<ProductionEmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string userName, bool isAdmin);

        Task<ProductionEmployeeImportConfirmResultDto> ConfirmAsync(ConfirmProductionEmployeeImportDto request, string userName, bool isAdmin);

        Task<ProductionEmployeeAccumulationResultDto> ApplyAccumulationAsync(ApplyProductionEmployeeAccumulationDto request, string userName, bool isAdmin);

        (byte[] Content, string FileName) GenerateTemplate();
    }
}
