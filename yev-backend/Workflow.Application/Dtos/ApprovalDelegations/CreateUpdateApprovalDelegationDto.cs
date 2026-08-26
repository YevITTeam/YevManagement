using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.ApprovalDelegations
{
    // DelegatorEmployeeId KHÔNG có trong DTO — luôn resolve = người dùng hiện tại (mirror
    // CreatedByEmployeeId ở FormDefinitionService), tránh việc 1 người tạo ủy quyền thay mặt người
    // khác qua body request.
    public class CreateUpdateApprovalDelegationDto
    {
        [Required(ErrorMessage = "Người duyệt thay không được để trống")]
        public int DelegateEmployeeId { get; set; }

        public int? FormDefinitionId { get; set; }

        [Required(ErrorMessage = "Ngày bắt đầu không được để trống")]
        public DateTime FromDate { get; set; }

        [Required(ErrorMessage = "Ngày kết thúc không được để trống")]
        public DateTime ToDate { get; set; }

        [MaxLength(500)]
        public string? Reason { get; set; }
    }
}
