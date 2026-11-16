using Attendance.Application.Dtos.JobTitles;

namespace Attendance.Application.Interfaces.Service
{
    public interface IJobTitleApprovalChainService
    {
        // Read-only preview tool; deliberately throws when the creator is missing or has no job title.
        Task<ResolveApprovalChainResultDto> ResolveChainAsync(int creatorEmployeeId, int otCaseId);

        // Lenient variant for CreateAsync: a null creator or one without a title counts as the lowest level.
        // groupId/departmentId are passed in because the caller has already validated them.
        Task<ResolveApprovalChainResultDto> ResolveChainForCreationAsync(int? creatorEmployeeId, int groupId, int departmentId, int workshopId, int otCaseId);

    }
}
