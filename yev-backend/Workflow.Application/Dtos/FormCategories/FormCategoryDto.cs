namespace Workflow.Application.Dtos.FormCategories
{
    public class FormCategoryDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public int? OrgUnitId { get; set; }
        public string? OrgUnitNameVn { get; set; }
        public int SortOrder { get; set; }
    }
}
