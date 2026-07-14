using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Department
{
    public int Id { get; set; }

    public string DepartmentCode { get; set; } = null!;

    public string DepartmentNameVn { get; set; } = null!;

    public string? DepartmentNameJp { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
