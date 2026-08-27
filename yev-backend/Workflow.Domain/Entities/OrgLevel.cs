namespace Workflow.Domain.Entities;

public partial class OrgLevel
{
    public int Id { get; set; }

    public int LevelNumber { get; set; }

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OrgUnit> OrgUnits { get; set; } = new List<OrgUnit>();

    public virtual ICollection<OrgLevelJobTitleSuggestion> OrgLevelJobTitleSuggestions { get; set; } = new List<OrgLevelJobTitleSuggestion>();
}
