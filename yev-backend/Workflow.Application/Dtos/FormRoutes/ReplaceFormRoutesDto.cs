using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormRoutes
{
    // Only FormRoute carries an Id (merged by Id); steps/participants have none because they are recreated on every save.
    public class ReplaceFormApprovalStepParticipantItemDto
    {
        [Required(ErrorMessage = "Nguồn người duyệt không được để trống")]
        public ParticipantSource ParticipantSource { get; set; }

        public int? EmployeeId { get; set; }

        public int? JobTitleId { get; set; }

        [Required(ErrorMessage = "Vai trò không được để trống")]
        public ParticipantRole ParticipantRole { get; set; }
    }

    public class ReplaceFormApprovalStepItemDto
    {
        [Required(ErrorMessage = "Tên bước không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        [Required(ErrorMessage = "Loại bước không được để trống")]
        public StepType StepType { get; set; }

        [Required(ErrorMessage = "Phạm vi đơn vị không được để trống")]
        public OrgUnitScope OrgUnitScope { get; set; }

        public int? OrgUnitId { get; set; }

        [Required(ErrorMessage = "Chế độ duyệt không được để trống")]
        public ApproverMode ApproverMode { get; set; }

        public bool RequireSignature { get; set; }

        public bool AllowSendBack { get; set; } = true;

        public bool AllowAddApprover { get; set; }

        [Required]
        public List<ReplaceFormApprovalStepParticipantItemDto> Participants { get; set; } = new();
    }

    public class ReplaceFormRouteItemDto
    {
        public int? Id { get; set; }

        [Required(ErrorMessage = "Tên nhánh không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        public decimal? MinValue { get; set; }

        public decimal? MaxValue { get; set; }

        public string? ClassValue { get; set; }

        public bool IsDefault { get; set; }

        [Required]
        public List<ReplaceFormApprovalStepItemDto> Steps { get; set; } = new();
    }

    public class ReplaceFormRoutesDto
    {
        [Required]
        public List<ReplaceFormRouteItemDto> Items { get; set; } = new();
    }
}
