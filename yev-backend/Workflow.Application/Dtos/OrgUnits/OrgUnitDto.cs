namespace Workflow.Application.Dtos.OrgUnits
{
    public class OrgUnitDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public int OrgLevelId { get; set; }
        public string OrgLevelNameVn { get; set; } = null!;
        public int? ParentId { get; set; }
        public string? ParentNameVn { get; set; }
        public int SortOrder { get; set; }
        public DateTime? ValidFrom { get; set; }
        public DateTime? ValidTo { get; set; }
    }
}
