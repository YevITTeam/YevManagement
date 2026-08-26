namespace Workflow.Application.Dtos.OrgLevels
{
    public class OrgLevelDto
    {
        public int Id { get; set; }
        public int LevelNumber { get; set; }
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
    }
}
