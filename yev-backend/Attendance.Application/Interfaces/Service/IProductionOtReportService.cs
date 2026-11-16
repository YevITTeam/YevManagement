using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Dtos.Reports;

namespace Attendance.Application.Interfaces.Service
{
    // OT reports over completed forms; every query takes the same filter (date range, workshop, department, groups).
    public interface IProductionOtReportService
    {
        // One day only; JSON, the FE renders the PDF.
        Task<ProductionTicketReportDto> GetTicketReportAsync(ReportFilterDto filter);

        // Excel files return raw bytes; the controller wraps them in File(...). One row per person per day unless noted.
        Task<(byte[] Content, string FileName)> ExportHoursReportAsync(ReportFilterDto filter);

        // One row per OT form (not merged per person), plus repeated per-day totals.
        Task<(byte[] Content, string FileName)> ExportTimesReportAsync(ReportFilterDto filter);

        Task<(byte[] Content, string FileName)> ExportQryExportExcelAsync(ReportFilterDto filter);

        // Separate purpose from Qry_EXPORT_EXCEL, not a reduced version of it.
        Task<(byte[] Content, string FileName)> ExportSumExportDataAsync(ReportFilterDto filter);

        Task<IReadOnlyList<ProductionOptionDto>> GetGroupsAsync(int? workshopId, int? departmentId);

        // One day only; one item per Block/ShiftTeam, the FE renders the PDFs and zips them.
        Task<List<ProductionTicketBatchGroupDto>> GetTicketBatchAsync(ReportFilterDto filter);
    }
}
