namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormDto
    {
        public int Id { get; set; }

        // Null for production-line forms.
        public int? GroupId { get; set; }
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }

        public bool IsProductionForm { get; set; }
        public int DepartmentId { get; set; }
        public string DepartmentCode { get; set; } = null!;
        public string DepartmentNameVn { get; set; } = null!;
        public string? DepartmentNameJp { get; set; }
        public int ReasonId { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public string? ReasonNameJp { get; set; }
        public int OtCaseId { get; set; }
        public string OtCaseCode { get; set; } = null!;
        public string? OtCaseDescription { get; set; }
        public string? OtCaseDescriptionJp { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? SubReason { get; set; }
        public decimal TotalHour { get; set; }
        public DateOnly Date { get; set; }
        public int NumberOfEmployee { get; set; }
        public string CreatedByUserName { get; set; } = null!;

        // Snapshot of the creator's full name — FE always prefers displaying this field, falling back to CreatedByUserName if null.
        public string? CreatedByFullName { get; set; }

        // UTC; the FE uses it as the self-sign time since there is no approval history row for it.
        public DateTime CreatedAt { get; set; }

        // Set only when the creator self-signs the requester box; serialized as base64.
        public byte[]? CreatorSignatureImage { get; set; }

        // Enum Attendance.Domain.Enums.OtFormStatus.
        public int Status { get; set; }

        // Normal edit is open (InApproval, office forms: no Manager-level step approved yet).
        public bool IsEditable { get; set; }

        // OtFormResubmitKind when the form can only be changed through a re-submission (PUT with ResubmitReason).
        public int? ResubmitKind { get; set; }

        // Accounts allowed to re-submit; Admin may also re-sign (ResubmitKind = Resign).
        public List<string> ResubmitUserNames { get; set; } = new();

        public DateTime? ResubmitDeadline { get; set; }

        // Null when the chain is complete.
        public string? ApprovalChainWarning { get; set; }

        public List<OtFormEmployeeDto> Employees { get; set; } = new();
        public ProcessPartDto? ProcessPart { get; set; }
        public List<OtFormApprovalHistoryDto> ApprovalHistories { get; set; } = new();

        // Newest first.
        public List<OtFormEditLogDto> EditLogs { get; set; } = new();

        // Ordered by StepOrder.
        public List<OtFormApprovalStepDto> ApprovalSteps { get; set; } = new();
    }
}
