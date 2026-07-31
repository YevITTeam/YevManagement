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

    // === Removed-by-approver block (see docs/attendance-module.md — Loại nhân viên khỏi đơn) ===
    // An approver who disagrees with ONE person out of many no longer has to reject the whole form:
    // they drop that person and approve the rest. This is a SOFT removal (the row stays) — the form is
    // a legal document, so who was dropped, by whom, at which level and why must remain traceable
    // forever. Everything downstream (accumulation, NumberOfEmployee, the printed PDF) filters on
    // IsRemoved; nothing hard-deletes the row.
    public bool IsRemoved { get; set; }

    public string? RemovedByUserName { get; set; }

    public string? RemovedByFullName { get; set; }

    // ApprovalLevel the remover was acting at when they dropped this person (Submitter/GroupHead/
    // DepartmentManager/WorkshopManager/GeneralDirector) — stored as int, same convention as
    // OtFormApprovalHistory.ApprovalLevel.
    public int? RemovedAtLevel { get; set; }

    public DateTime? RemovedAt { get; set; }

    public string? RemoveReason { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
