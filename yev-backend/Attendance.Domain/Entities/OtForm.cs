using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtForm
{
    public int Id { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    // Null for production forms (participants may come from different groups); required for office forms.
    public int? GroupId { get; set; }

    // Explicit flag so readers never infer the form type from GroupId == null.
    public bool IsProductionForm { get; set; }

    public int DepartmentId { get; set; }

    // Workshop of the form: the group's workshop, or (production forms) the participants' common workshop.
    public int WorkshopId { get; set; }

    public int ReasonId { get; set; }

    public int OtCaseId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string? SubReason { get; set; }

    public decimal TotalHour { get; set; }

    public DateOnly Date { get; set; }

    public int NumberOfEmployee { get; set; }

    // UserName, not an id: Identity users live in another DB and the JWT carries no numeric UserId.
    public string CreatedByUserName { get; set; } = null!;

    // Snapshot of the JWT FullName at creation.
    public string? CreatedByFullName { get; set; }

    // Also serves as the signing time printed for the creator's self-signature (no history row exists for it).
    public DateTime CreatedAt { get; set; }

    // Set only when the creator ranks at or above every required-signature intermediate title, so nobody else can sign for them.
    public byte[]? CreatorSignatureImage { get; set; }

    // Attendance.Domain.Enums.OtFormStatus.
    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    // Admin hard-stop for forms stuck on a step with no candidates; Completed forms cannot be deleted because
    // their hours are already accumulated. Soft-delete keeps the audit trail.
    public string? DeletedByUserName { get; set; }

    public string? DeletedByFullName { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? DeleteReason { get; set; }

    // OT date under which General Affairs last received this form; null = not in their data.
    public DateOnly? GeneralAffairsSentDate { get; set; }

    // Set when a form already sent is re-submitted, so its day is sent again once the outcome is final.
    public bool GeneralAffairsResendPending { get; set; }

    // Null until the daily batch sweep picks the form up.
    public int? OtFormBatchId { get; set; }

    public virtual Group? Group { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual Workshop Workshop { get; set; } = null!;

    public virtual Reason Reason { get; set; } = null!;

    public virtual OtCase OtCase { get; set; } = null!;

    public virtual OtFormBatch? OtFormBatch { get; set; }

    public virtual ProcessPart? ProcessPart { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<OtFormApprovalHistory> OtFormApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();

    public virtual ICollection<OtFormEditLog> OtFormEditLogs { get; set; } = new List<OtFormEditLog>();

    public virtual OtFormPaperScan? PaperScan { get; set; }

    public virtual ICollection<OtFormApprovalEmailToken> OtFormApprovalEmailTokens { get; set; } = new List<OtFormApprovalEmailToken>();

    public virtual ICollection<OtFormApprovalStep> ApprovalSteps { get; set; } = new List<OtFormApprovalStep>();

    // Snapshot at creation; null when the chain is complete. A form with a missing step stays stuck until Admin fixes the config.
    public string? ApprovalChainWarning { get; set; }
}
