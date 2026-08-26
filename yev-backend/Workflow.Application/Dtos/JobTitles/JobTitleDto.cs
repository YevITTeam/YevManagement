namespace Workflow.Application.Dtos.JobTitles
{
    public class JobTitleDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public int RankOrder { get; set; }
        public bool IsUniquePerOrgUnit { get; set; }
    }
}
