namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeExportService
    {
        // 1 sheet / Phòng ban hệ thống (Employee.Group.Department) — trả nguyên file .xlsx dạng bytes,
        // Controller tự bọc File(...), không qua ApiResponse<T> (xem ProductionEmployeeExportController).
        Task<(byte[] Content, string FileName)> ExportAsync();
    }
}
