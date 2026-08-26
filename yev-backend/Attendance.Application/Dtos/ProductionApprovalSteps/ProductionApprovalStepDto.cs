namespace Attendance.Application.Dtos.ProductionApprovalSteps
{
    public class ProductionApprovalStepDto
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public int StepOrder { get; set; }
        public int JobTitleId { get; set; }
        public string JobTitleCode { get; set; } = null!;
        public string JobTitleName { get; set; } = null!;
        public int RankOrder { get; set; }
        public bool RequiresSignature { get; set; }
        public bool IsResponsible { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — có thể là None (Line Leader/Group
        // Leader/Team Leader) hoặc khác None (Manager/Factory Manager/Director) — khác
        // DepartmentApprovalStepDto, danh sách này gộp CẢ 2 loại trong 1 chuỗi duy nhất.
        public int TerminalLevel { get; set; }
    }
}
