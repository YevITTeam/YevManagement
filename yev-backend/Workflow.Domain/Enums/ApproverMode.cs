namespace Workflow.Domain.Enums;

// workflow-module.md §5.6 — Any: 1 người bấm là bước xong. All: mọi Approver đều phải bấm.
public enum ApproverMode
{
    Any = 1,
    All = 2
}
