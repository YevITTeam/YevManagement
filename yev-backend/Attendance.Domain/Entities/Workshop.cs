using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Factory site. Departments are shared across workshops; a Group belongs to exactly
// one (Workshop, Department) pair, so a department's staff per workshop is reached through its Groups.
public partial class Workshop
{
    public int Id { get; set; }

    public string WorkshopCode { get; set; } = null!;

    public string WorkshopNameVn { get; set; } = null!;

    public string? WorkshopNameJp { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<Group> Groups { get; set; } = new List<Group>();

    public virtual ICollection<EmployeeApprovalScope> ApprovalScopes { get; set; } = new List<EmployeeApprovalScope>();
}
