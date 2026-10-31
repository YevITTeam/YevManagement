namespace Workflow.Domain.Enums;

// Any: one approval completes the step. All: every Approver must approve.
public enum ApproverMode
{
    Any = 1,
    All = 2
}
