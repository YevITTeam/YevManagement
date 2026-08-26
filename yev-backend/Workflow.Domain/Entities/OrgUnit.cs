namespace Workflow.Domain.Entities;

public partial class OrgUnit
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public int OrgLevelId { get; set; }

    public int? ParentId { get; set; }

    public int SortOrder { get; set; }

    public DateTime? ValidFrom { get; set; }

    public DateTime? ValidTo { get; set; }

    public bool IsDeleted { get; set; }

    public virtual OrgLevel OrgLevel { get; set; } = null!;

    public virtual OrgUnit? Parent { get; set; }

    public virtual ICollection<OrgUnit> Children { get; set; } = new List<OrgUnit>();

    public virtual ICollection<EmployeeOrgUnit> EmployeeOrgUnits { get; set; } = new List<EmployeeOrgUnit>();

    public virtual ICollection<FormCategory> FormCategories { get; set; } = new List<FormCategory>();

    public virtual ICollection<FormAccess> FormAccesses { get; set; } = new List<FormAccess>();

    public virtual ICollection<FormApprovalStep> FormApprovalSteps { get; set; } = new List<FormApprovalStep>();

    public virtual ICollection<WorkflowRequest> WorkflowRequests { get; set; } = new List<WorkflowRequest>();
}
