using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormRoutes
{
    public class FormRouteDto
    {
        public int Id { get; set; }
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public int SortOrder { get; set; }
        public decimal? MinValue { get; set; }
        public decimal? MaxValue { get; set; }
        public string? ClassValue { get; set; }
        public bool IsDefault { get; set; }
        public List<FormApprovalStepDto> Steps { get; set; } = new();
    }

    public class FormApprovalStepDto
    {
        public int Id { get; set; }
        public int StepOrder { get; set; }
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public StepType StepType { get; set; }
        public OrgUnitScope OrgUnitScope { get; set; }
        public int? OrgUnitId { get; set; }
        public string? OrgUnitNameVn { get; set; }
        public ApproverMode ApproverMode { get; set; }
        public bool RequireSignature { get; set; }
        public bool AllowSendBack { get; set; }
        public bool AllowAddApprover { get; set; }
        public List<FormApprovalStepParticipantDto> Participants { get; set; } = new();
    }

    public class FormApprovalStepParticipantDto
    {
        public int Id { get; set; }
        public ParticipantSource ParticipantSource { get; set; }
        public int? EmployeeId { get; set; }
        public string? EmployeeFullName { get; set; }
        public int? JobTitleId { get; set; }
        public string? JobTitleNameVn { get; set; }
        public ParticipantRole ParticipantRole { get; set; }
        public int SortOrder { get; set; }
    }

    // Warning: cảnh báo không chặn lưu (vd khoảng số NumericRange chồng nhau/để hở, workflow-module.md
    // §5.2) — Controller nối vào message của response thành công, KHÔNG phải lỗi.
    public class ReplaceFormRoutesResultDto
    {
        public List<FormRouteDto> Routes { get; set; } = new();
        public string? Warning { get; set; }
    }
}
