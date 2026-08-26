namespace Workflow.Domain.Entities;

// Nhánh duyệt theo điều kiện (workflow-module.md §3.2) — WorkflowRequests.FormRouteId (Pha 3B) sẽ là
// FK thật Restrict trỏ vào đây, nên ReplaceRoutesAsync PHẢI merge theo Id, không xoá-tất-tạo-lại
// (khác FormApprovalSteps/FormApprovalStepParticipants bên dưới, luôn xoá-tất-tạo-lại vì
// WorkflowRequestSteps chỉ snapshot giá trị, không FK ngược).
public partial class FormRoute
{
    public int Id { get; set; }

    public int FormDefinitionId { get; set; }

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public int SortOrder { get; set; }

    public decimal? MinValue { get; set; }

    public decimal? MaxValue { get; set; }

    public string? ClassValue { get; set; }

    public bool IsDefault { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormDefinition FormDefinition { get; set; } = null!;

    public virtual ICollection<FormApprovalStep> FormApprovalSteps { get; set; } = new List<FormApprovalStep>();

    public virtual ICollection<WorkflowRequest> WorkflowRequests { get; set; } = new List<WorkflowRequest>();
}
