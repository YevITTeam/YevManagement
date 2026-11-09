using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionEmployees
{
    // Manual fix between imports; FKs are nullable since admin station codes have no physical Line.
    public class UpdateProductionEmployeeDto
    {
        public int? ProductionLineId { get; set; }
        public int? TeamId { get; set; }
        public int? ShiftTeamId { get; set; }

        [MaxLength(50, ErrorMessage = "Công đoạn tối đa 50 ký tự")]
        public string? CongDoan { get; set; }

        [MaxLength(255, ErrorMessage = "Công việc tối đa 255 ký tự")]
        public string? TaskName { get; set; }
    }
}
