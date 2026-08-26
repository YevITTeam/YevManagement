namespace Workflow.Domain.Entities;

// Điểm neo định danh duy nhất của Workflow DB — mọi cột "ai đó" trong toàn bộ DB đều là
// FK -> Employees (workflow-module.md §3.1). UserId là điểm chạm cross-DB sang
// YevIdentityManagement.Users, KHÔNG có FK thật (EF không tạo được FK xuyên DB).
public partial class Employee
{
    public int Id { get; set; }

    public string EmployeeCode { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string? FullNameJp { get; set; }

    public string? Email { get; set; }

    public string? Position { get; set; }

    public int? UserId { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public virtual ICollection<EmployeeOrgUnit> EmployeeOrgUnits { get; set; } = new List<EmployeeOrgUnit>();

    public virtual ICollection<FormCategoryCoordinator> FormCategoryCoordinators { get; set; } = new List<FormCategoryCoordinator>();

    public virtual ICollection<FormDefinition> CreatedFormDefinitions { get; set; } = new List<FormDefinition>();

    public virtual ICollection<FormDefinition> UpdatedFormDefinitions { get; set; } = new List<FormDefinition>();

    public virtual ICollection<FormAccess> FormAccesses { get; set; } = new List<FormAccess>();

    public virtual ICollection<FormApprovalStepParticipant> FormApprovalStepParticipants { get; set; } = new List<FormApprovalStepParticipant>();

    public virtual ICollection<WorkflowRequest> CreatedWorkflowRequests { get; set; } = new List<WorkflowRequest>();

    public virtual ICollection<WorkflowRequestStep> InsertedWorkflowRequestSteps { get; set; } = new List<WorkflowRequestStep>();

    public virtual ICollection<WorkflowRequestStep> ActedWorkflowRequestSteps { get; set; } = new List<WorkflowRequestStep>();

    public virtual ICollection<WorkflowRequestStepParticipant> WorkflowRequestStepParticipants { get; set; } = new List<WorkflowRequestStepParticipant>();

    public virtual ICollection<WorkflowRequestHistory> ActorWorkflowRequestHistories { get; set; } = new List<WorkflowRequestHistory>();

    public virtual ICollection<WorkflowRequestHistory> OnBehalfOfWorkflowRequestHistories { get; set; } = new List<WorkflowRequestHistory>();

    public virtual ICollection<ApprovalDelegation> DelegatorApprovalDelegations { get; set; } = new List<ApprovalDelegation>();

    public virtual ICollection<ApprovalDelegation> DelegateApprovalDelegations { get; set; } = new List<ApprovalDelegation>();

    public virtual EmployeeSignature? EmployeeSignature { get; set; }

    public virtual ICollection<PendingEmployeeSignatureConfirmation> PendingEmployeeSignatureConfirmations { get; set; } = new List<PendingEmployeeSignatureConfirmation>();

    public virtual ICollection<WorkflowAttachment> UploadedWorkflowAttachments { get; set; } = new List<WorkflowAttachment>();
}
