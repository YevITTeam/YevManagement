using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// RequestCode is null until Submit, when it is allocated atomically via WorkflowSequences.
public partial class WorkflowRequest
{
    public int Id { get; set; }

    public string? RequestCode { get; set; }

    public int FormDefinitionId { get; set; }

    public int? FormRouteId { get; set; }

    public string? RouteConditionSnapshot { get; set; }

    public int FormVersion { get; set; }

    public string DataJson { get; set; } = "{}";

    public string? FormSchemaJson { get; set; }

    public RequestStatus Status { get; set; }

    public int CurrentStepOrder { get; set; }

    public int CreatedByEmployeeId { get; set; }

    public int? CreatedByOrgUnitId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormDefinition FormDefinition { get; set; } = null!;

    public virtual FormRoute? FormRoute { get; set; }

    public virtual Employee CreatedByEmployee { get; set; } = null!;

    public virtual OrgUnit? CreatedByOrgUnit { get; set; }

    public virtual ICollection<WorkflowRequestStep> WorkflowRequestSteps { get; set; } = new List<WorkflowRequestStep>();

    public virtual ICollection<WorkflowRequestHistory> WorkflowRequestHistories { get; set; } = new List<WorkflowRequestHistory>();

    public virtual ICollection<WorkflowAttachment> WorkflowAttachments { get; set; } = new List<WorkflowAttachment>();

    public virtual ICollection<WorkflowRequestEmailToken> WorkflowRequestEmailTokens { get; set; } = new List<WorkflowRequestEmailToken>();
}
