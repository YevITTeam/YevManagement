using Attendance.Application.Dtos.Overview;

namespace Attendance.Application.Interfaces.Service
{
    public interface IOtOverviewService
    {
        // Admin and Manager-and-above titles only (IEmployeeService.CanViewOverviewAsync); null = not allowed.
        // Figures cover only the caller's employee scope, optionally narrowed to one workshop.
        Task<OtOverviewDto?> GetAsync(string callerUserName, bool isAdmin, int year, int month, int? workshopId);
    }
}
