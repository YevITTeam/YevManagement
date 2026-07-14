using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Line
{
    public int Id { get; set; }

    public string LineCode { get; set; } = null!;

    public string LineNameVn { get; set; } = null!;

    public string? LineNameJp { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
