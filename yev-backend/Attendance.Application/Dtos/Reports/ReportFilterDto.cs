namespace Attendance.Application.Dtos.Reports
{
    // Shared query of every OT report: completed forms whose date is in [FromDate, ToDate]; null filters = all.
    public class ReportFilterDto
    {
        public DateOnly FromDate { get; set; }
        public DateOnly ToDate { get; set; }
        public int? DepartmentId { get; set; }
        public int? WorkshopId { get; set; }
        public int[]? GroupIds { get; set; }
    }
}
