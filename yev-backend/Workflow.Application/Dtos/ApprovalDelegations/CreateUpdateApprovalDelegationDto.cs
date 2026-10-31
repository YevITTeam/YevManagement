using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.ApprovalDelegations
{
    // No DelegatorEmployeeId: always the current user, so nobody can create a delegation on someone else's behalf.
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
