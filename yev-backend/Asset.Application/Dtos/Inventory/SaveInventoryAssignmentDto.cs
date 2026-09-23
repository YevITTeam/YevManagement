using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Inventory
{
    public class SaveInventoryAssignmentDto
    {
        [Required(ErrorMessage = "Vui lòng chọn người dùng.")]
        public int UserId { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập.")]
        public string UserName { get; set; } = null!;

        public string? FullName { get; set; }

        [Required(ErrorMessage = "Vui lòng chọn xưởng.")]
        public int BranchId { get; set; }
    }
}
