namespace Attendance.Application.Interfaces.Service
{
    // Single shared check for every "department coordinator" feature so the security logic can't drift between callers.
    public interface IDepartmentAccessGuard
    {
        // Admin always passes; others need an explicit DepartmentApprovalStepCoordinator row (never inferred from job title).
        Task EnsureCanManageDepartmentAsync(string userName, bool isAdmin, int departmentId);

        // For per-row scoping of free-form input (e.g. employee codes from Excel); callers handle the Admin bypass themselves.
        Task<HashSet<int>> GetManagedDepartmentIdsAsync(string userName);
    }
}
