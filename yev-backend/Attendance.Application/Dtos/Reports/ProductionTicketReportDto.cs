namespace Attendance.Application.Dtos.Reports
{
    // Completed production forms only; FE renders the PDF with jsPDF, BE returns JSON.
    public class ProductionTicketReportDto
    {
        public DateOnly Date { get; set; }

        public int TotalSecondaryTicketCount { get; set; }

        public int TotalMainTicketCount { get; set; }

        public int TotalMilkCount { get; set; }

        public List<ProductionTicketReportRowDto> Rows { get; set; } = new();
    }

    // One row per (CongDoan, Team, Line-ShiftTeam, shift) combination. Ticket counts come from each form's
    // ProcessPart, not recomputed from MealTicketType, because ProcessPart may have been edited manually.
    public class ProductionTicketReportRowDto
    {
        // BOPHAN, from OtFormEmployee.CongDoanSnapshot.
        public string CongDoan { get; set; } = null!;

        // Hard-coded windows: H=6-8h, B=10-14h, A=14-18h, C=18-22h; "Khac" when none match.
        public string Ca { get; set; } = null!;

        // DAY column, from OtFormEmployee.TeamCodeSnapshot.
        public string Team { get; set; } = null!;

        // BlockCodeSnapshot + "-" + ShiftTeamCodeSnapshot; the suffix is the color group, not a shift time.
        public string LineCa { get; set; } = null!;

        public int SecondaryTicketCount { get; set; }

        public int MainTicketCount { get; set; }

        public int MilkCount { get; set; }

        public decimal TotalHour { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndTime { get; set; }
    }
}
