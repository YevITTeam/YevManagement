using Attendance.Domain.Enums;

namespace Attendance.Application.Dtos.WorkCalendars
{
    public class WorkCalendarDayDto
    {
        public DateOnly Date { get; set; }

        public WorkCalendarDayType DayType { get; set; }

        public string? Note { get; set; }
    }
}
