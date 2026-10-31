namespace Attendance.Application.Dtos.OtForms
{
    // Lets the FE pre-fill/lock Team/Line/Shift for Line Leaders; only combinations with all 3 FKs resolved are returned.
    public class MyProductionCreateScopeItemDto
    {
        // Same for every item (belongs to the caller): Employee.DepartmentId ?? Employee.Group.DepartmentId,
        // since Line Leaders are usually assigned via a Group.
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;

        public int ProductionLineId { get; set; }
        public string LineCode { get; set; } = null!;
        public string? LineNameVn { get; set; }

        public int TeamId { get; set; }
        public string TeamCode { get; set; } = null!;
        public string? TeamNameVn { get; set; }

        public int ShiftTeamId { get; set; }
        public string ShiftTeamCode { get; set; } = null!;
        public string? ShiftTeamNameVn { get; set; }
    }
}
