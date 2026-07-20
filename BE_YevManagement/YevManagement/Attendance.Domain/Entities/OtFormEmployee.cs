using System;

namespace Attendance.Domain.Entities;

// List of employees participating in an OtForm along with each person's actual OT hours — composite key (OtFormId, EmployeeId).
public partial class OtFormEmployee
{
    public int OtFormId { get; set; }

    public int EmployeeId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string? NoteVn { get; set; }

    public string? NoteJp { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
