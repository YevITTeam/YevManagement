using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Daily bundle of forms waiting at one terminal level, approved in a single action. System-managed, no IsDeleted.
public partial class OtFormBatch
{
    public int Id { get; set; }

    // Stores Attendance.Domain.Enums.JobTitleTerminalLevel — which manager level this batch is for.
    public int TerminalLevel { get; set; }

    // DepartmentManager level only; WorkshopManager/GeneralDirector are company-wide, so one batch per level per day.
    public int? DepartmentId { get; set; }

    // Set together with DepartmentId (DepartmentManager level only): the same department is a separate
    // batch per workshop because its manager differs per workshop.
    public int? WorkshopId { get; set; }

    // The sweep day, not the processing day.
    public DateOnly BatchDate { get; set; }

    public int Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ProcessedAt { get; set; }

    // Null when the batch auto-closed itself because every member form had already been processed
    // individually outside the batch flow (see OtFormService.RunDailyBatchSweepAsync).
    public string? ProcessedByUserName { get; set; }

    public string? ProcessedByFullName { get; set; }

    public virtual Department? Department { get; set; }

    public virtual Workshop? Workshop { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();

    public virtual ICollection<OtFormBatchEmailToken> OtFormBatchEmailTokens { get; set; } = new List<OtFormBatchEmailToken>();
}
