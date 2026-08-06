using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// "Đơn tổng" — a daily bundle of individual OT Forms sitting at the DepartmentManager level
// (OtFormStatus.Pending) for the same Department, so the Department Manager can approve/reject all
// of them in a single action instead of one form at a time (see docs/attendance-module.md — §Đơn
// tổng). No IsDeleted — a system-managed table, same as OtFormApprovalEmailToken.
public partial class OtFormBatch
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    // The calendar day the daily sweep created this batch — NOT the day it gets processed.
    public DateOnly BatchDate { get; set; }

    // Stores Attendance.Domain.Enums.OtFormBatchStatus as an int.
    public int Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ProcessedAt { get; set; }

    // Null when the batch auto-closed itself because every member form had already been processed
    // individually outside the batch flow (see OtFormService.RunDailyBatchSweepAsync).
    public string? ProcessedByUserName { get; set; }

    public string? ProcessedByFullName { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();

    public virtual ICollection<OtFormBatchEmailToken> OtFormBatchEmailTokens { get; set; } = new List<OtFormBatchEmailToken>();
}
