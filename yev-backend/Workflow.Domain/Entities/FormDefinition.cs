using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// 1 dòng = 1 loại đơn (workflow-module.md §3.2). Đã có FormFields/FormFieldConditions (Pha 2C) +
// FormAccesses/publish/clone (Pha 2D). Chưa tạo được WorkflowRequest thật cho tới khi có Pha 3
// (FormRoutes/FormApprovalSteps).
public partial class FormDefinition
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public int FormCategoryId { get; set; }

    public string? Description { get; set; }

    public int Version { get; set; } = 1;

    public bool IsPublished { get; set; }

    public bool AllowAttachment { get; set; }

    public bool RequireAttachment { get; set; }

    public string CodePrefix { get; set; } = null!;

    public RouteConditionType RouteConditionType { get; set; }

    public string? RouteNumericFieldKey { get; set; }

    public string? RouteClassFieldKey { get; set; }

    public int CreatedByEmployeeId { get; set; }

    public int? UpdatedByEmployeeId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormCategory FormCategory { get; set; } = null!;

    public virtual Employee CreatedByEmployee { get; set; } = null!;

    public virtual Employee? UpdatedByEmployee { get; set; }

    public virtual ICollection<FormField> FormFields { get; set; } = new List<FormField>();

    public virtual ICollection<FormAccess> FormAccesses { get; set; } = new List<FormAccess>();

    public virtual ICollection<FormRoute> FormRoutes { get; set; } = new List<FormRoute>();

    public virtual ICollection<WorkflowRequest> WorkflowRequests { get; set; } = new List<WorkflowRequest>();

    public virtual ICollection<ApprovalDelegation> ApprovalDelegations { get; set; } = new List<ApprovalDelegation>();
}
