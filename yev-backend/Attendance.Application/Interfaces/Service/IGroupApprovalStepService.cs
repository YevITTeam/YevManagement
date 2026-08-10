using Attendance.Application.Dtos.GroupApprovalSteps;

namespace Attendance.Application.Interfaces.Service
{
    public interface IGroupApprovalStepService
    {
        Task<List<GroupApprovalStepDto>> GetByGroupAsync(int groupId);
        Task<List<GroupApprovalStepDto>> ReplaceAsync(int groupId, ReplaceGroupApprovalStepsDto request);
    }
}
