using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Group
{
    public int Id { get; set; }

    public string GroupCode { get; set; } = null!;

    public string GroupNameVn { get; set; } = null!;

    public string? GroupNameJp { get; set; }

    public int DepartmentId { get; set; }

    public int? RequesterEmployeeId { get; set; }

    public int? ResponsibleEmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual Employee? RequesterEmployee { get; set; }

    public virtual Employee? ResponsibleEmployee { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
