using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.OtFormBatches
{
    public class ProcessOtFormBatchFormDto
    {
        [Required(ErrorMessage = "Mã đơn không được để trống")]
        public int OtFormId { get; set; }

        // Enum Attendance.Domain.Enums.OtFormBatchFormDecision (0=Approve, 1=Reject).
        public int Decision { get; set; }

        // Required for Reject; validated in the service since it depends on Decision.
        public string? RejectReason { get; set; }

        // Approve only: unchecked employees go through the existing RemoveEmployeeCoreAsync flow.
        public List<int>? ExcludedEmployeeIds { get; set; }
    }
}
