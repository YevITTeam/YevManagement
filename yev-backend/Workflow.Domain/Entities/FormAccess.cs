using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Who may create requests (FormCategoryCoordinators = who may edit the form). Exactly one target column is set
// per TargetType, validated in the Service.
public partial class FormAccess
{
    public int Id { get; set; }

    public int FormDefinitionId { get; set; }

    public AccessTargetType TargetType { get; set; }

    // Cross-DB reference to Identity.Roles.Id, no real FK.
    public int? RoleId { get; set; }

    public int? OrgUnitId { get; set; }

    public int? EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormDefinition FormDefinition { get; set; } = null!;

    public virtual OrgUnit? OrgUnit { get; set; }

    public virtual Employee? Employee { get; set; }
}
