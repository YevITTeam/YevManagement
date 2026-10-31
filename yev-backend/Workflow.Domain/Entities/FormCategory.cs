namespace Workflow.Domain.Entities;

public partial class FormCategory
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public int? OrgUnitId { get; set; }

    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }

    public virtual OrgUnit? OrgUnit { get; set; }

    public virtual ICollection<FormCategoryCoordinator> FormCategoryCoordinators { get; set; } = new List<FormCategoryCoordinator>();

    public virtual ICollection<FormDefinition> FormDefinitions { get; set; } = new List<FormDefinition>();
}
