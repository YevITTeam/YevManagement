using Attendance.Application.Dtos.WorkCalendars;

namespace Attendance.Application.Interfaces.Service
{
    public interface IWorkCalendarService
    {
        Task<IReadOnlyList<WorkCalendarDayDto>> GetByYearAsync(int year);

        // Excel template for a year: all Sundays of the year plus the holiday rows already stored for it.
        Task<byte[]> BuildTemplateAsync(int year);

        // Replaces every non-working day of the given year with the rows in the file. All-or-nothing.
        Task<WorkCalendarImportResultDto> ImportAsync(int year, Stream stream);
    }
}
