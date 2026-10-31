using Attendance.Application.Dtos.JobTitlePermissions;

namespace Attendance.Application.Interfaces.Service
{
    public interface IJobTitlePermissionService
    {
        Task<List<JobTitlePermissionDto>> GetByJobTitleAsync(int jobTitleId);

        // Also syncs Identity permissions immediately for every employee holding this title.
        Task<List<JobTitlePermissionDto>> ReplaceAsync(int jobTitleId, ReplaceJobTitlePermissionsDto request);

        // Only workflow-participation permissions; admin permissions must not be grantable via job titles.
        List<string> GetAllowedPermissionCodes();
    }
}
