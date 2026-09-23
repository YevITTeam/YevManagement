using Asset.Application.Dtos.ServerChecks;

namespace Asset.Application.Interfaces.Service
{
    public interface IServerCheckAssignmentService
    {
        Task<List<ServerCheckAssignmentDto>> GetAllAsync();

        // Xưởng của user đang đăng nhập; null = chưa được phân công.
        Task<ServerCheckAssignmentDto?> GetMyAssignmentAsync();

        Task<ServerCheckAssignmentDto> SaveAsync(SaveServerCheckAssignmentDto request);

        Task DeleteAsync(int id);
    }
}
