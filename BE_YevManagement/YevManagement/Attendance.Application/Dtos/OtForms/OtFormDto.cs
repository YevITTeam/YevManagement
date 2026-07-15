namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormDto
    {
        public int Id { get; set; }
        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public int ReasonId { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public int OtCaseId { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? SubReason { get; set; }
        public decimal TotalHour { get; set; }
        public DateOnly Date { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        public List<OtFormEmployeeDto> Employees { get; set; } = new();
        public ProcessPartDto? ProcessPart { get; set; }
        public List<OtFormApprovalHistoryDto> ApprovalHistories { get; set; } = new();
    }
}
