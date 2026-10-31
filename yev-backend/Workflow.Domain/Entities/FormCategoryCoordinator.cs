namespace Workflow.Domain.Entities;

// Who may design forms in this category; assigned by hand, never inferred from job titles.
public partial class FormCategoryCoordinator
{
    public int Id { get; set; }

    public int FormCategoryId { get; set; }

    public int EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormCategory FormCategory { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
