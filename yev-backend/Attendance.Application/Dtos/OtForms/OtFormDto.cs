namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormDto
    {
        public int Id { get; set; }
        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
        public string? GroupNameJp { get; set; }
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
        public int ReasonId { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public string? ReasonNameJp { get; set; }
        public int OtCaseId { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? SubReason { get; set; }
        public decimal TotalHour { get; set; }
        public DateOnly Date { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // Snapshot of the creator's full name — FE always prefers displaying this field, falling back to CreatedByUserName if null.
        public string? CreatedByFullName { get; set; }

        public int? RequesterEmployeeId { get; set; }
        public string? RequesterFullName { get; set; }
        public string? RequesterUserName { get; set; }

        public int? ResponsibleEmployeeId { get; set; }
        public string? ResponsibleFullName { get; set; }
        public string? ResponsibleUserName { get; set; }

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        // true when Status == Pending (no approval level has approved yet) — only then can PUT /api/OtForm/{id} be called.
        public bool IsEditable { get; set; }

        public List<OtFormEmployeeDto> Employees { get; set; } = new();
        public ProcessPartDto? ProcessPart { get; set; }
        public List<OtFormApprovalHistoryDto> ApprovalHistories { get; set; } = new();
    }
}
