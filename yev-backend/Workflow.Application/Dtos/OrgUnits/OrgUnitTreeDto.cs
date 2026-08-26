namespace Workflow.Application.Dtos.OrgUnits
{
    // Dựng cây cho màn quản trị kéo-thả (workflow-module.md §6 GET /OrgUnit/tree).
    public class OrgUnitTreeDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public int OrgLevelId { get; set; }
        public int SortOrder { get; set; }
        public List<OrgUnitTreeDto> Children { get; set; } = new();
    }
}
