using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormRoutes
{
    // Thay NGUYÊN cây nhánh+bước+người của 1 FormDefinition trong 1 lượt PUT (workflow-module.md §6:
    // "PUT /FormDefinition/{id}/routes — replace cả nhánh + bước + người"). Id chỉ tồn tại ở cấp
    // FormRoute (merge theo Id, xem FormDefinitionService.ReplaceRoutesAsync) — Steps/Participants
    // KHÔNG có Id vì luôn xoá-tất-tạo-lại mỗi lần lưu route (không bảng nào tham chiếu Id của chúng).
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
