using Attendance.Application.Dtos.Reports;

namespace Attendance.Application.Interfaces.Service
{
    // Daily reports for completed production-line forms.
    public interface IProductionOtReportService
    {
        // departmentId null = all departments, since production forms may belong to any department.

        // Returns JSON; FE renders the PDF.
        Task<ProductionTicketReportDto> GetTicketReportAsync(DateOnly date, int? departmentId, int? workshopId = null);

        // Returned as raw bytes; the controller wraps it in File(...).
        Task<(byte[] Content, string FileName)> ExportHoursReportAsync(DateOnly date, int? departmentId, int? workshopId = null);

        // One row per OT form (not merged per person), plus repeated per-day totals.
        Task<(byte[] Content, string FileName)> ExportTimesReportAsync(DateOnly date, int? departmentId, int? workshopId = null);

        // File names follow "{QueryName}_{yyyy-MM-d}_{DepartmentCode}.xlsx" (day without leading zero).

        // 17 columns, one row per person per day.
        Task<(byte[] Content, string FileName)> ExportQryExportExcelAsync(DateOnly date, int? departmentId, int? workshopId = null);

        // Separate purpose from Qry_EXPORT_EXCEL, not a reduced version of it.
        Task<(byte[] Content, string FileName)> ExportSumExportDataAsync(DateOnly date, int? departmentId, int? workshopId = null);

        // One item per Block/ShiftTeam with OT that day; FE renders the PDFs and zips them.
        Task<List<ProductionTicketBatchGroupDto>> GetTicketBatchAsync(DateOnly date, int? departmentId, int? workshopId = null);
    }
}
