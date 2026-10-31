namespace Workflow.Application.Dtos.OrgUnits
{
    // Shown on tree nodes so users can see who holds which position without leaving the tree screen.
    public class OrgUnitTreeMemberDto
    {
        // EmployeeOrgUnits.Id — identifies the assignment row for per-row update/remove.
        public int AssignmentId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeFullName { get; set; } = null!;
        public string EmployeeCode { get; set; } = null!;
        public int? JobTitleId { get; set; }
        public string? JobTitleNameVn { get; set; }
        // Lower = higher rank; used only for FE grouping/indentation, never for business decisions.
        public int? JobTitleRankOrder { get; set; }
        public bool IsPrimary { get; set; }
    }
}
