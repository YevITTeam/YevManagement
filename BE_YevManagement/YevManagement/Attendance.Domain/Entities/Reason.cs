using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Reason
{
    public int Id { get; set; }

    public string ReasonNameVn { get; set; } = null!;

    public string? ReasonNameJp { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
