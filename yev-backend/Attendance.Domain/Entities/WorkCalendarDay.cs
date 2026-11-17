using Attendance.Domain.Enums;

namespace Attendance.Domain.Entities
{
    // One row per NON-WORKING day of one workshop; a date without a row is a working day for that workshop.
    // Rows are replaced on import or edited one by one, so there is no IsDeleted flag.
    public partial class WorkCalendarDay
    {
        public int Id { get; set; }

        public int WorkshopId { get; set; }

        public DateOnly Date { get; set; }

        public WorkCalendarDayType DayType { get; set; }

        public string? Note { get; set; }

        public virtual Workshop Workshop { get; set; } = null!;
    }
}
