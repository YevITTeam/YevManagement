using System;

namespace Attendance.Domain.Entities;

// List of employees participating in an OtForm along with each person's actual OT hours — composite key (OtFormId, EmployeeId).
public partial class OtFormEmployee
{
    public int OtFormId { get; set; }

    public int EmployeeId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string? NoteVn { get; set; }

    public string? NoteJp { get; set; }

    // Snapshot of Employee.MonthToDate/YearToDate at the moment this row was added to the form
    // (CreateAsync, or UpdateAsync when a new employee is added to an existing form) — frozen so
    // viewing an old form always shows the accumulation AS OF form-creation time, not whatever the
    // Employee's accumulation happens to be right now (same principle as
    // OtFormApprovalHistory.SignatureImage/ApproverFullName being snapshots, not live joins).
    public decimal MonthToDate { get; set; }

    public decimal YearToDate { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
