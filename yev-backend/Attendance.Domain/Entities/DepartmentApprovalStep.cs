namespace Attendance.Domain.Entities;

// Only the 3 terminal levels per department; intermediate levels live in GroupApprovalStep per group.
// Managed by whole-list replace (ReplaceAsync), no per-row CRUD.
public partial class DepartmentApprovalStep
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    // Per department, not per JobTitle: the same title may need to sign in one department but only confirm in another.
    public bool RequiresSignature { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}
