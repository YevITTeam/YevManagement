using Workflow.Application.Dtos.ApprovalDelegations;

namespace Workflow.Application.Interfaces.Service
{
    public interface IApprovalDelegationService
    {
        Task<List<ApprovalDelegationDto>> GetMineAsync(int? currentUserId);
        Task<ApprovalDelegationDto> CreateAsync(CreateUpdateApprovalDelegationDto request, int? currentUserId);
        Task<ApprovalDelegationDto> UpdateAsync(int id, CreateUpdateApprovalDelegationDto request, int? currentUserId);
        Task DeleteAsync(int id, int? currentUserId);
    }
}
