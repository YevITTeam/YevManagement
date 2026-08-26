namespace Workflow.Domain.Entities;

// Cấp số atomic (workflow-module.md §3.4, §5.4) — PK composite (SequenceKey, Year). Không có Id
// surrogate, không IsDeleted (bảng counter thuần).
public partial class WorkflowSequence
{
    public string SequenceKey { get; set; } = null!;

    public int Year { get; set; }

    public int LastSequence { get; set; }
}
