using Asset.Application.Dtos.Inventory;

namespace Asset.Application.Interfaces.Service
{
    public interface IInventoryAssignmentService
    {
        Task<List<InventoryAssignmentDto>> GetAllAsync();

        // Xưởng của user đang đăng nhập; null = chưa được phân công.
        Task<InventoryAssignmentDto?> GetMyAssignmentAsync();

        Task<InventoryAssignmentDto> SaveAsync(SaveInventoryAssignmentDto request);

        Task DeleteAsync(int id);
    }
}
