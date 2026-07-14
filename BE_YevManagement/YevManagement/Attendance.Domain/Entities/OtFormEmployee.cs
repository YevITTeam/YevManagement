using System;

namespace Attendance.Domain.Entities;

// Danh sách nhân viên tham gia 1 OtForm kèm giờ OT thực tế của từng người — khóa kép (OtFormId, EmployeeId).
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
