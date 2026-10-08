using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ApprovalDelegations
{
    public class ApprovalDelegationDto
    {
        public int Id { get; set; }
        public int DelegatorEmployeeId { get; set; }
        public string DelegatorName { get; set; } = null!;
        public int DelegateEmployeeId { get; set; }
        public string DelegateName { get; set; } = null!;
        public DateOnly FromDate { get; set; }
        public DateOnly ToDate { get; set; }
        public string? Reason { get; set; }

        // Today falls inside [FromDate, ToDate].
        public bool IsActive { get; set; }

        // Caller is the delegator, so only they may edit or delete it.
        public bool IsMine { get; set; }
    }

    public class CreateUpdateApprovalDelegationDto
    {
        [Required]
        public int DelegateEmployeeId { get; set; }

        [Required]
        public DateOnly FromDate { get; set; }

        [Required]
        public DateOnly ToDate { get; set; }

        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    public class DelegateOptionDto
    {
        public int EmployeeId { get; set; }
        public string Code { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string UserName { get; set; } = null!;
        public string JobTitleName { get; set; } = null!;
    }
}
