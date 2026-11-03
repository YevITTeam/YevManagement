using System;

namespace Attendance.Domain.Entities;

// Composite key (OtFormId, EmployeeId).
public partial class OtFormEmployee
{
    public int OtFormId { get; set; }

    public int EmployeeId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    // Per-employee meal flag; unrelated to ProcessPart.IsEat, which is a form-level flag.
    public bool DidEat { get; set; }

    public string? NoteVn { get; set; }

    public string? NoteJp { get; set; }

    // Actual accumulation before this form, written at sign-off so the signed figure never changes; unused before then.
    public decimal MonthToDate { get; set; }

    public decimal YearToDate { get; set; }

    // Hours actually added to the ledger at sign-off, so reversing subtracts the same figure even after settings change.
    public decimal? LedgerHours { get; set; }

    // Soft removal by an approver: the form is a legal document, so who was dropped and why must stay traceable.
    // Accumulation, NumberOfEmployee and the PDF all filter on IsRemoved.
    public bool IsRemoved { get; set; }

    public string? RemovedByUserName { get; set; }

    public string? RemovedByFullName { get; set; }

    // Holds the remover's StepOrder; name kept to avoid breaking FE/DTO.
    public int? RemovedAtLevel { get; set; }

    public DateTime? RemovedAt { get; set; }

    public string? RemoveReason { get; set; }

    // Snapshots from ProductionEmployee (production forms only), which changes daily.
    public string? CongDoanSnapshot { get; set; }

    public string? TaskNameSnapshot { get; set; }

    public string? BlockCodeSnapshot { get; set; }

    public string? TeamCodeSnapshot { get; set; }

    public string? ShiftTeamCodeSnapshot { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
