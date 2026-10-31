using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.ServerChecks
{
    // Upsert by UserId: 1 user = 1 branch.
    public class SaveServerCheckAssignmentDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "Vui lòng chọn người dùng.")]
        public int UserId { get; set; }

        [Required(ErrorMessage = "Tên đăng nhập không được để trống.")]
        [MaxLength(150, ErrorMessage = "Tên đăng nhập tối đa 150 ký tự.")]
        public string UserName { get; set; } = null!;

        [MaxLength(150, ErrorMessage = "Họ tên tối đa 150 ký tự.")]
        public string? FullName { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Vui lòng chọn xưởng.")]
        public int BranchId { get; set; }
    }
}
