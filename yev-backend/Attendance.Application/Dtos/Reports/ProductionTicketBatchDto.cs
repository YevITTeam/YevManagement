namespace Attendance.Application.Dtos.Reports
{
    // One ticket per Block/ShiftTeam per day; signatures/reasons come from GET /api/OtForm/{PrimaryOtFormId}, not here.
    public class ProductionTicketBatchGroupDto
    {
        // Lowest Id among forms sharing this combination supplies signatures; employees are merged from all of them.
        public int PrimaryOtFormId { get; set; }

        public string Block { get; set; } = null!;

        public string ShiftTeam { get; set; } = null!;

        public int EmployeeCount { get; set; }

        public List<ProductionTicketBatchEmployeeDto> Employees { get; set; } = new();
    }

    public class ProductionTicketBatchEmployeeDto
    {
        public int EmployeeId { get; set; }

        public string EmployeeCode { get; set; } = null!;

        public string FullName { get; set; } = null!;

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }

        public decimal MonthToDate { get; set; }

        public decimal YearToDate { get; set; }

        public string? NoteVn { get; set; }

        // Snapshots are needed for the "process name" cell, built the same way as the single-form print view.
        public string? CongDoanSnapshot { get; set; }

        public string? TaskNameSnapshot { get; set; }

        public string? BlockCodeSnapshot { get; set; }

        public string? TeamCodeSnapshot { get; set; }

        public string? ShiftTeamCodeSnapshot { get; set; }
    }
}
