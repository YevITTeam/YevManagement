using Attendance.Application.Dtos.GroupApprovalSteps;

namespace Attendance.Application.Interfaces.Service
{
    public interface IGroupApprovalStepService
    {
        // userName/isAdmin dùng để scope-check (2026-08-11) — mirror IDepartmentApprovalStepService.
        Task<List<GroupApprovalStepDto>> GetByGroupAsync(string userName, bool isAdmin, int groupId);
        Task<List<GroupApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int groupId, ReplaceGroupApprovalStepsDto request);

        Task<GroupBorrowedApproversDto> GetBorrowedApproversAsync(string userName, bool isAdmin, int groupId);
        Task<GroupBorrowedApproversDto> ReplaceBorrowedApproversAsync(string userName, bool isAdmin, int groupId, ReplaceGroupBorrowedApproversDto request);
    }
}
