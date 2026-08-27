using Attendance.Application.Dtos.ProductionEmployeeImports;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeImportService
    {
        Task<ProductionEmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream);

        Task<ProductionEmployeeImportConfirmResultDto> ConfirmAsync(ConfirmProductionEmployeeImportDto request);

        Task<ProductionEmployeeAccumulationResultDto> ApplyAccumulationAsync(ApplyProductionEmployeeAccumulationDto request);

        // File mẫu tải xuống (2026-08-27, theo yêu cầu người dùng) — không đụng DB nên KHÔNG async.
        (byte[] Content, string FileName) GenerateTemplate();
    }
}
