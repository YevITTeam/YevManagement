using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Audit trail — CHỈ INSERT, không IsDeleted, không Update/Delete (workflow-module.md §3.3).
public partial class WorkflowRequestHistory
{
    public int Id { get; set; }

    public int WorkflowRequestId { get; set; }

    public int StepOrder { get; set; }

    public int ActorEmployeeId { get; set; }

    public int? OnBehalfOfEmployeeId { get; set; }

    public string ActorNameSnapshot { get; set; } = null!;

    public RequestAction Action { get; set; }

    public int? SentBackToStepOrder { get; set; }

    public string? Comment { get; set; }

    public byte[]? SignatureImage { get; set; }

    public DateTime ActionAt { get; set; }

    public virtual WorkflowRequest WorkflowRequest { get; set; } = null!;

    public virtual Employee ActorEmployee { get; set; } = null!;

    public virtual Employee? OnBehalfOfEmployee { get; set; }
}
