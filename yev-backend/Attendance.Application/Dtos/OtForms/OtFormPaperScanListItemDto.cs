namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormPaperScanListItemDto : OtFormPaperScanDto
    {
        public int OtFormId { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public string DepartmentNameVn { get; set; } = null!;
        public string? GroupNameVn { get; set; }
    }
}
