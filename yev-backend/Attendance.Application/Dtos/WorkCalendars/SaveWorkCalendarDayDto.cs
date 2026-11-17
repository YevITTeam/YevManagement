using Attendance.Domain.Enums;

namespace Attendance.Application.Dtos.WorkCalendars
{
    public class SaveWorkCalendarDayDto
    {
        public int WorkshopId { get; set; }

        public DateOnly Date { get; set; }

        // null = working day, which removes the row.
        public WorkCalendarDayType? DayType { get; set; }

        public string? Note { get; set; }
    }
}
