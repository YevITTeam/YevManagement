using Asset.Application.Dtos.ServerChecks;

namespace Asset.Application.Interfaces.Service
{
    public interface IServerCheckAssignmentService
    {
        Task<List<ServerCheckAssignmentDto>> GetAllAsync();

        // Null = not assigned.
        Task<ServerCheckAssignmentDto?> GetMyAssignmentAsync();

        Task<ServerCheckAssignmentDto> SaveAsync(SaveServerCheckAssignmentDto request);

        Task DeleteAsync(int id);
    }
}
