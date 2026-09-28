namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionEmployeeExportService
    {
        // 1 sheet / Phòng ban hệ thống (Employee.Group.Department) — trả nguyên file .xlsx dạng bytes,
        // Controller tự bọc File(...), không qua ApiResponse<T> (xem ProductionEmployeeExportController).
        // callerUserName/isAdmin dùng để SCOPE theo Bộ phận phụ trách (2026-09-28, cùng mô hình
        // GetPagedAsync/UpdateAsync — CHỈ Bộ phận, không có Nhóm): non-Admin chỉ xuất được sheet của
        // (các) Bộ phận mình phụ trách.
        Task<(byte[] Content, string FileName)> ExportAsync(string callerUserName, bool isAdmin);
    }
}
