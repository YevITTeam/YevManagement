namespace Attendance.Application.Dtos.OtForms
{
    public class ProcessPartDto
    {
        public bool IsEat { get; set; }

        // Count of each meal ticket type — manually entered by the form creator (not auto-calculated
        // from the employee list), only meaningful when IsEat = true (2026-07-16, see docs/attendance-module.md).
        public int MainTicketCount { get; set; }
        public int SecondaryTicketCount { get; set; }
        public int MilkCount { get; set; }

        public bool IsTransportation { get; set; }
        public bool IsUseCopyRoom { get; set; }
        public string? AnotherSuggestionVn { get; set; }
        public string? AnotherSuggestionJp { get; set; }
    }
}
