namespace Attendance.Domain.Entities;

// A person assigned to one intermediate level of a Group's tree, independent of their own Group or job title.
public partial class GroupApprovalStepMember
{
    public int Id { get; set; }

    public int GroupApprovalStepId { get; set; }

    public int EmployeeId { get; set; }

    // Everyone on the level may approve; only these people are mailed.
    public bool ReceivesMail { get; set; }

    public virtual GroupApprovalStep GroupApprovalStep { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
