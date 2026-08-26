namespace Workflow.Application.Dtos.EmployeeOrgUnits
{
    public class EmployeeOrgUnitDto
    {
        public int Id { get; set; }
        public int OrgUnitId { get; set; }
        public string OrgUnitCode { get; set; } = null!;
        public string OrgUnitNameVn { get; set; } = null!;
        public int? JobTitleId { get; set; }
        public string? JobTitleNameVn { get; set; }
        public bool IsPrimary { get; set; }
        public DateTime? ValidFrom { get; set; }
        public DateTime? ValidTo { get; set; }
    }
}
