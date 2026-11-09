namespace Attendance.Domain.Entities;

// One flat chain per department for production forms (too many groups to configure each). The Line Leader step
// resolves from the title's holders on the form's line; other intermediate steps use the participants' real Employee.GroupId.
public partial class ProductionApprovalStep
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    public bool RequiresSignature { get; set; }

    // Separate "responsible person" box on the printout; at most one step per department.
    public bool IsResponsible { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}
