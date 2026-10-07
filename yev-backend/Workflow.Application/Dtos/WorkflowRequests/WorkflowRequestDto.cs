using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    public class WorkflowRequestStepParticipantDto
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string? EmployeeFullName { get; set; }
        public ParticipantRole ParticipantRole { get; set; }
        public string? ResolvedFromJobTitle { get; set; }
        public DateTime? ActedAt { get; set; }
    }

    public class WorkflowRequestStepDto
    {
        public int Id { get; set; }
        public int StepOrder { get; set; }
        public string StepNameSnapshot { get; set; } = null!;
        public StepType StepTypeSnapshot { get; set; }
        public string? OrgUnitNameSnapshot { get; set; }
        public ApproverMode ApproverModeSnapshot { get; set; }
        public bool RequireSignatureSnapshot { get; set; }
        public bool AllowSendBackSnapshot { get; set; }
        public bool AllowAddApproverSnapshot { get; set; }
        public StepStatus Status { get; set; }
        public bool IsAdHoc { get; set; }
        public int? InsertedByEmployeeId { get; set; }
        public string? InsertedByEmployeeName { get; set; }
        public int? ActedByEmployeeId { get; set; }
        public string? ActedByEmployeeName { get; set; }
        public DateTime? ActedAt { get; set; }
        public List<WorkflowRequestStepParticipantDto> Participants { get; set; } = new();
    }

    public class WorkflowRequestHistoryDto
    {
        public int Id { get; set; }
        public int StepOrder { get; set; }
        public int ActorEmployeeId { get; set; }
        public string ActorNameSnapshot { get; set; } = null!;
        public int? OnBehalfOfEmployeeId { get; set; }
        public string? OnBehalfOfEmployeeName { get; set; }
        public RequestAction Action { get; set; }
        public int? SentBackToStepOrder { get; set; }
        public string? Comment { get; set; }
        // byte[] <-> base64 (frontend-conventions.md §2) — Pha 3B-2: cần cho khối chữ ký ở bản in (workflow-module.md
        // §5.7 "Khối chữ ký: dựng từ WorkflowRequestSteps + WorkflowRequestHistories.SignatureImage").
        public string? SignatureImageBase64 { get; set; }
        public DateTime ActionAt { get; set; }
    }

    // DataJson/FormSchemaJson trả về dạng object đã parse sẵn (không phải chuỗi) để FE đỡ phải
    // JSON.parse lại — workflow-module.md §5.8.
    public class WorkflowRequestDto
    {
        public int Id { get; set; }
        public string? RequestCode { get; set; }
        public int FormDefinitionId { get; set; }
        public string FormDefinitionNameVn { get; set; } = null!;
        public int? FormRouteId { get; set; }
        public string? RouteConditionSnapshot { get; set; }
        public int FormVersion { get; set; }
        public object? DataJson { get; set; }
        public object? FormSchemaJson { get; set; }
        public RequestStatus Status { get; set; }
        public int CurrentStepOrder { get; set; }
        public int CreatedByEmployeeId { get; set; }
        public string CreatedByEmployeeName { get; set; } = null!;
        public int? CreatedByOrgUnitId { get; set; }
        public string? CreatedByOrgUnitNameVn { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public List<WorkflowRequestStepDto> Steps { get; set; } = new();
        public List<WorkflowRequestHistoryDto> Histories { get; set; } = new();
        public List<WorkflowAttachmentDto> Attachments { get; set; } = new();
    }

    public class WorkflowRequestListItemDto
    {
        public int Id { get; set; }
        public string? RequestCode { get; set; }
        public int FormDefinitionId { get; set; }
        public string FormDefinitionNameVn { get; set; } = null!;
        public RequestStatus Status { get; set; }
        public int CurrentStepOrder { get; set; }
        public int CreatedByEmployeeId { get; set; }
        public string CreatedByEmployeeName { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}
