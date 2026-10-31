namespace Attendance.Domain.Entities;

// Intermediate (non-terminal) approval levels per group; terminal levels stay in DepartmentApprovalStep.
// Managed by whole-list replace, no per-row CRUD.
public partial class GroupApprovalStep
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    public bool RequiresSignature { get; set; }

    // "Responsible person" on the printout; at most one step per group (validated in ReplaceAsync).
    public bool IsResponsible { get; set; }

    // Holders of this step may edit and re-sign a form after a Manager signed or rejected it (read live, not snapshotted).
    public bool CanResubmit { get; set; }

    // With CanResubmit: the re-submission goes straight to the Manager and every group step is re-signed with the
    // current time; false = the chain restarts at the first group step.
    public bool ResubmitSkipsIntermediate { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}
