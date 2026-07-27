using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.UserApprovalScopes
{
    public class CreateUserApprovalScopeDto
    {
        [Required(ErrorMessage = "Tên đăng nhập không được để trống")]
        public string UserName { get; set; } = null!;

        [Required(ErrorMessage = "Loại phạm vi không được để trống")]
        public int ScopeType { get; set; }

        [Required(ErrorMessage = "Phạm vi (Group/Department) không được để trống")]
        public int ScopeId { get; set; }

        [Required(ErrorMessage = "Cấp duyệt không được để trống")]
        public int ApprovalLevel { get; set; }
    }
}
