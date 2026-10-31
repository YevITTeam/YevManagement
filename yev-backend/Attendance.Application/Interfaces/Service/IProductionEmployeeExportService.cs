namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeExportService
    {
        // One sheet per department, returned as raw bytes; non-Admins only get departments they coordinate.
        Task<(byte[] Content, string FileName)> ExportAsync(string callerUserName, bool isAdmin);
    }
}
