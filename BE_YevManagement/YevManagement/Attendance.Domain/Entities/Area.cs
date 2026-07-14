using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Area
{
    public int Id { get; set; }

    public string AreaCode { get; set; } = null!;

    public string AreaName { get; set; } = null!;

    public string? AreaDescription { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
