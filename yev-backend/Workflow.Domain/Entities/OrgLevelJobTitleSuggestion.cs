namespace Workflow.Domain.Entities;

// Pre-select hint only; users may still pick any JobTitle.
public partial class OrgLevelJobTitleSuggestion
{
    public int Id { get; set; }

    public int OrgLevelId { get; set; }

    public int JobTitleId { get; set; }

    // SortOrder = 0 is the FE's default pre-selection.
    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }

    public virtual OrgLevel OrgLevel { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}
