using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtForm
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int DepartmentId { get; set; }

    public int ReasonId { get; set; }

    public int OtCaseId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string? SubReason { get; set; }

    public decimal TotalHour { get; set; }

    public DateOnly Date { get; set; }

    public int NumberOfEmployee { get; set; }

    // The form creator — stores UserName (Identity.User lives in a different DB, and the JWT has no
    // numeric UserId claim, only UserName), following the same convention as
    // Asset.Domain.Models.AuditTrail.ChangedBy.
    public string CreatedByUserName { get; set; } = null!;

    // Snapshot of the JWT's "FullName" claim at the time the form was created — so every display
    // (list/detail) can always show the user's name instead of the raw UserName, same reasoning as
    // OtFormApprovalHistory.ApproverFullName.
    public string? CreatedByFullName { get; set; }

    // Stores the Attendance.Domain.Enums.OtFormStatus enum as an int (following the same convention as
    // Asset.Domain.Entities.Device.Status).
    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    // "Đơn tổng" this form was swept into, once it reaches OtFormStatus.Pending (awaiting Department
    // Manager) — null until the daily sweep picks it up (see docs/attendance-module.md — §Đơn tổng).
    public int? OtFormBatchId { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Department Department { get; set; } = null!;

    public virtual Reason Reason { get; set; } = null!;

    public virtual OtCase OtCase { get; set; } = null!;

    public virtual OtFormBatch? OtFormBatch { get; set; }

    public virtual ProcessPart? ProcessPart { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<OtFormApprovalHistory> OtFormApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();

    public virtual ICollection<OtFormApprovalEmailToken> OtFormApprovalEmailTokens { get; set; } = new List<OtFormApprovalEmailToken>();
}
