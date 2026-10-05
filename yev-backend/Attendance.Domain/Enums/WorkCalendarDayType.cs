namespace Attendance.Domain.Enums
{
    // Kind of non-working day stored in WorkCalendarDays. A date without a row is a working day.
    public enum WorkCalendarDayType
    {
        Sunday = 1,
        PublicHoliday = 2,
        SpecialHoliday = 3,
    }
}
