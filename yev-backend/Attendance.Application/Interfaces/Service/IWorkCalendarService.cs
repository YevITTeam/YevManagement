using Attendance.Application.Dtos.WorkCalendars;

namespace Attendance.Application.Interfaces.Service
{
    public interface IWorkCalendarService
    {
        Task<IReadOnlyList<WorkCalendarDayDto>> GetByYearAsync(int workshopId, int year);

        Task<int> GetWorkshopIdByCodeAsync(string workshopCode);

        // Excel template for a year: all Sundays of the year plus the holiday rows already stored for it.
        Task<(byte[] Content, string FileName)> BuildTemplateAsync(int workshopId, int year);

        // Replaces every non-working day of the workshop's year with the rows in the file. All-or-nothing.
        Task<WorkCalendarImportResultDto> ImportAsync(int workshopId, int year, Stream stream);

        Task SaveDayAsync(SaveWorkCalendarDayDto request);
    }
}
