namespace Workflow.Domain.Entities;

// Referenced by WorkflowRequests.FormRouteId (Restrict), so ReplaceRoutesAsync must merge by Id, not recreate.
public partial class FormRoute
{
    public int Id { get; set; }

    public int FormDefinitionId { get; set; }

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public int SortOrder { get; set; }

    public decimal? MinValue { get; set; }

    public decimal? MaxValue { get; set; }

    public string? ClassValue { get; set; }

    public bool IsDefault { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormDefinition FormDefinition { get; set; } = null!;

    public virtual ICollection<FormApprovalStep> FormApprovalSteps { get; set; } = new List<FormApprovalStep>();

    public virtual ICollection<WorkflowRequest> WorkflowRequests { get; set; } = new List<WorkflowRequest>();
}
