namespace Workflow.Application.Dtos.OrgLevels
{
    public class OrgLevelJobTitleSuggestionDto
    {
        public int JobTitleId { get; set; }
        public string JobTitleCode { get; set; } = null!;
        public string JobTitleNameVn { get; set; } = null!;
        public string? JobTitleNameJp { get; set; }
        public int SortOrder { get; set; }
    }
}
