using Attendance.Domain.Enums;

namespace Attendance.Domain.Entities
{
    // One row per NON-WORKING day (Sunday, public holiday, special holiday). A date without a row is a
    // working day. Each year is replaced wholesale on import, so there is no IsDeleted flag.
    public partial class WorkCalendarDay
    {
        public int Id { get; set; }

        public DateOnly Date { get; set; }

        public WorkCalendarDayType DayType { get; set; }

        public string? Note { get; set; }
    }
}
