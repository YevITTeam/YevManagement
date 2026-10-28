using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Group
{
    public int Id { get; set; }

    public string GroupCode { get; set; } = null!;

    public string GroupNameVn { get; set; } = null!;

    public string? GroupNameJp { get; set; }

    public int DepartmentId { get; set; }

    public int WorkshopId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual Workshop Workshop { get; set; } = null!;

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();

    public virtual ICollection<GroupApprovalStep> GroupApprovalSteps { get; set; } = new List<GroupApprovalStep>();

    public virtual ICollection<GroupApprovalStepCoordinator> GroupApprovalStepCoordinators { get; set; } = new List<GroupApprovalStepCoordinator>();
}
