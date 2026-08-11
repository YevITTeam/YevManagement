using Attendance.Application.Dtos.GroupApprovalStepCoordinators;

namespace Attendance.Application.Interfaces.Service
{
    public interface IGroupApprovalStepCoordinatorService
    {
        Task<List<GroupApprovalStepCoordinatorDto>> GetByGroupAsync(int groupId);
        Task<List<GroupApprovalStepCoordinatorDto>> ReplaceAsync(int groupId, ReplaceGroupApprovalStepCoordinatorsDto request);
    }
}
