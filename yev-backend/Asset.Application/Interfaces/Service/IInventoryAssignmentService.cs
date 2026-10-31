using Asset.Application.Dtos.Inventory;

namespace Asset.Application.Interfaces.Service
{
    public interface IInventoryAssignmentService
    {
        Task<List<InventoryAssignmentDto>> GetAllAsync();

        // Null = not assigned.
        Task<InventoryAssignmentDto?> GetMyAssignmentAsync();

        Task<InventoryAssignmentDto> SaveAsync(SaveInventoryAssignmentDto request);

        Task DeleteAsync(int id);
    }
}
