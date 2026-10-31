namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormEditLogDto
    {
        public string ActionByUserName { get; set; } = null!;
        public string? ActionByFullName { get; set; }
        public DateTime ActionAt { get; set; }

        // Enum Attendance.Domain.Enums.OtFormEditActionType.
        public int ActionType { get; set; }

        public int? EmployeeId { get; set; }
        public string? EmployeeCodeSnapshot { get; set; }
        public string? FieldName { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
    }
}
