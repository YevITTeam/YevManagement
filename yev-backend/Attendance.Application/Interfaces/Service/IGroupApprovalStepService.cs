using Attendance.Application.Dtos.GroupApprovalSteps;
using Attendance.Application.Dtos.Groups;

namespace Attendance.Application.Interfaces.Service
{
    public interface IGroupApprovalStepService
    {
        Task<List<GroupDto>> GetMyManagedGroupsAsync(string userName, bool isAdmin);
        Task<List<GroupApprovalStepDto>> GetByGroupAsync(string userName, bool isAdmin, int groupId);
        Task<List<GroupApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int groupId, ReplaceGroupApprovalStepsDto request);

        Task<GroupBorrowedApproversDto> GetBorrowedApproversAsync(string userName, bool isAdmin, int groupId);
        Task<GroupOtFormCreatorsDto> GetOtFormCreatorsAsync(string userName, bool isAdmin, int groupId);
        Task<GroupOtFormCreatorsDto> ReplaceOtFormCreatorsAsync(string userName, bool isAdmin, int groupId, ReplaceGroupOtFormCreatorsDto request);
        Task<GroupBorrowedApproversDto> ReplaceBorrowedApproversAsync(string userName, bool isAdmin, int groupId, ReplaceGroupBorrowedApproversDto request);
    }
}
