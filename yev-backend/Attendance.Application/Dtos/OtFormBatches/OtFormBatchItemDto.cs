using Attendance.Application.Dtos.OtForms;

namespace Attendance.Application.Dtos.OtFormBatches
{
    // Trimmed OtFormDto with only what the approver needs to decide on this form.
    public class OtFormBatchItemDto
    {
        public int OtFormId { get; set; }

        // Null for production-line forms (no fixed GroupId).
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }
        public bool IsProductionForm { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public string? ReasonNameJp { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public string? OtCaseDescription { get; set; }
        public string? OtCaseDescriptionJp { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? SubReason { get; set; }
        public decimal TotalHour { get; set; }
        public string CreatedByUserName { get; set; } = null!;
        public string? CreatedByFullName { get; set; }
        public int NumberOfEmployee { get; set; }

        // Null if the form was created without it.
        public ProcessPartDto? ProcessPart { get; set; }

        // Active (not removed) employees only, same rule as NumberOfEmployee.
        public List<OtFormEmployeeDto> Employees { get; set; } = new();
    }
}
