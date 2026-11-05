namespace Attendance.Application.Interfaces.Service
{
    // OT data of completed office forms for General Affairs: Excel export and the daily mail (Excel + ZIP of PDFs per OT date).
    public interface IGeneralAffairsReportService
    {
        Task<(byte[] Content, string FileName)> ExportExcelAsync(DateOnly fromDate, DateOnly toDate, int? workshopId = null, int? departmentId = null);

        // Sends every OT date that has new or changed forms; returns how many mails were queued.
        Task<int> SendPendingAsync();
    }
}
