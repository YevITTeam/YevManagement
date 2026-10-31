namespace Workflow.Domain.Entities;

public partial class JobTitle
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    // Lower = higher rank. Display/sorting only, never used to infer approval flow.
    public int RankOrder { get; set; }

    // Must be true for titles used as route anchors (resolution needs exactly one holder per unit);
    // false for common titles held by many (e.g. staff). Defaults true for existing data.
    public bool IsUniquePerOrgUnit { get; set; } = true;

    public bool IsDeleted { get; set; }

    public virtual ICollection<EmployeeOrgUnit> EmployeeOrgUnits { get; set; } = new List<EmployeeOrgUnit>();

    public virtual ICollection<FormApprovalStepParticipant> FormApprovalStepParticipants { get; set; } = new List<FormApprovalStepParticipant>();

    public virtual ICollection<OrgLevelJobTitleSuggestion> OrgLevelJobTitleSuggestions { get; set; } = new List<OrgLevelJobTitleSuggestion>();
}
