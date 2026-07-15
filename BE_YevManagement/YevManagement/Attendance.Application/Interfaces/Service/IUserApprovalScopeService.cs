using Attendance.Application.Dtos.UserApprovalScopes;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IUserApprovalScopeService
    {
        Task<PagedResponse<UserApprovalScopeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<UserApprovalScopeDto>> GetByUserNameAsync(string userName);
        Task<UserApprovalScopeDto> CreateAsync(CreateUserApprovalScopeDto request);
        Task DeleteAsync(int id);
    }
}
