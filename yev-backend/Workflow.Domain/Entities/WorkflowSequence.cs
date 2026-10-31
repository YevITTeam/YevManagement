namespace Workflow.Domain.Entities;

// Pure counter table: composite PK (SequenceKey, Year), no surrogate Id, no IsDeleted.
public partial class WorkflowSequence
{
    public string SequenceKey { get; set; } = null!;

    public int Year { get; set; }

    public int LastSequence { get; set; }
}
