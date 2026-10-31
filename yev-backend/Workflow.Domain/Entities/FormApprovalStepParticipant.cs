using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// JobTitle indirection: the holder is resolved from EmployeeOrgUnits at submit, so a new manager means editing one row, not every form.
public partial class FormApprovalStepParticipant
{
    public int Id { get; set; }

    public int FormApprovalStepId { get; set; }

    public ParticipantSource ParticipantSource { get; set; }

    public int? EmployeeId { get; set; }

    public int? JobTitleId { get; set; }

    public ParticipantRole ParticipantRole { get; set; }

    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormApprovalStep FormApprovalStep { get; set; } = null!;

    public virtual Employee? Employee { get; set; }

    public virtual JobTitle? JobTitle { get; set; }
}
