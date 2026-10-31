namespace Workflow.Domain.Entities;

// Every "who" column in the Workflow DB is an FK to Employees. UserId points to Identity Users in another DB, so no real FK.
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

    public virtual ICollection<WorkflowRequestEmailToken> ReceivedWorkflowRequestEmailTokens { get; set; } = new List<WorkflowRequestEmailToken>();
}
