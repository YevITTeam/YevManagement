using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// "Đơn tổng" — a daily bundle of individual OT Forms sitting at a manager terminal level
// (JobTitleTerminalLevel.DepartmentManager/WorkshopManager/GeneralDirector) so the approver at that
// level can approve/reject all of them in a single action instead of one form at a time (see
// docs/attendance-module.md — §Đơn tổng). No IsDeleted — a system-managed table, same as
// OtFormApprovalEmailToken.
public partial class OtFormBatch
{
    public int Id { get; set; }

    // Stores Attendance.Domain.Enums.JobTitleTerminalLevel — which manager level this batch is for.
    public int TerminalLevel { get; set; }

    // Only set when TerminalLevel=DepartmentManager (candidates are scoped to 1 Department). Null for
    // WorkshopManager/GeneralDirector — those 2 levels are company-wide (see
    // JobTitleApprovalChainService), so 1 batch per level per day covers the whole company.
    public int? DepartmentId { get; set; }

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

    public virtual Department? Department { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();

    public virtual ICollection<OtFormBatchEmailToken> OtFormBatchEmailTokens { get; set; } = new List<OtFormBatchEmailToken>();
}
