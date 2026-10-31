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

        // Production forms read the single ProductionApprovalStep chain; Group/Line scope of intermediate steps
        // is inferred from employeeIds, so mixed groups/lines yield no candidate for that step.
        Task<ResolveApprovalChainResultDto> ResolveChainForProductionCreationAsync(
            int? creatorEmployeeId, int departmentId, int workshopId, List<int> employeeIds, int otCaseId);
    }
}
