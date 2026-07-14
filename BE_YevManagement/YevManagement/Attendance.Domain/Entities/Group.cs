using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Group
{
    public int Id { get; set; }

    public string GroupCode { get; set; } = null!;

    public string GroupNameVn { get; set; } = null!;

    public string? GroupNameJp { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
