namespace Attendance.Domain.Entities;

// Snapshot at creation; every candidate is valid, whoever acts first decides the step.
public partial class OtFormApprovalStepCandidate
{
    public int Id { get; set; }

    public int OtFormApprovalStepId { get; set; }

    public int EmployeeId { get; set; }

    public string UserName { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public virtual OtFormApprovalStep OtFormApprovalStep { get; set; } = null!;
}
