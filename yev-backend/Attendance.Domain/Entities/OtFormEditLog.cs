using System;

namespace Attendance.Domain.Entities;

// Data edits only (Approve/Reject live in OtFormApprovalHistory); one row per changed field or add/remove action.
public partial class OtFormEditLog
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public string ActionByUserName { get; set; } = null!;

    // Snapshot at action time.
    public string? ActionByFullName { get; set; }

    public DateTime ActionAt { get; set; }

    public int ActionType { get; set; }

    // Null for form-level changes.
    public int? EmployeeId { get; set; }

    public string? EmployeeCodeSnapshot { get; set; }

    // Null for EmployeeAdded/EmployeeRemoved.
    public string? FieldName { get; set; }

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
