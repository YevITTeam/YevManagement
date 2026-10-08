using Attendance.Application.Dtos.ApprovalDelegations;

namespace Attendance.Application.Interfaces.Service
{
    public interface IApprovalDelegationService
    {
        // Both directions: delegations the caller gave and received.
        Task<List<ApprovalDelegationDto>> GetMineAsync(string currentUserName);

        Task<List<DelegateOptionDto>> GetDelegateOptionsAsync(string currentUserName);

        Task<ApprovalDelegationDto> CreateAsync(string currentUserName, CreateUpdateApprovalDelegationDto request);

        Task<ApprovalDelegationDto> UpdateAsync(int id, string currentUserName, CreateUpdateApprovalDelegationDto request);

        Task DeleteAsync(int id, string currentUserName);
    }
}
