namespace Attendance.Application.Dtos.ProductionEmployees
{
    // Manual fix between imports; FKs are nullable since admin station codes have no physical Line.
    // CongDoan/TaskName are descriptive only and stay as last imported.
    public class UpdateProductionEmployeeDto
    {
        public int? ProductionLineId { get; set; }
        public int? TeamId { get; set; }
        public int? ShiftTeamId { get; set; }
    }
}
