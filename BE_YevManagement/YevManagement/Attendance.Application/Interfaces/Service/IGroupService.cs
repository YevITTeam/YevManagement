using Attendance.Application.Dtos.Groups;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IGroupService
    {
        Task<PagedResponse<GroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<GroupDto>> GetAllActiveAsync();
        Task<List<GroupDto>> GetByDepartmentIdAsync(int departmentId);
        Task<GroupDto> GetByIdAsync(int id);
        Task<GroupDto> CreateAsync(CreateGroupDto request);
        Task UpdateAsync(UpdateGroupDto request);
        Task DeleteAsync(int id);
    }
}
