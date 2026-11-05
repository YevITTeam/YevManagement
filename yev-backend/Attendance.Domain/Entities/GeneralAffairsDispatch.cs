namespace Attendance.Domain.Entities;

// One mail of one OT date, workshop and department to its General Affairs recipients; a later Version replaces the earlier ones.
public class GeneralAffairsDispatch
{
    public int Id { get; set; }

    public DateOnly OtDate { get; set; }

    // Mails are per OT date, workshop and department; versions count within that triple.
    public int WorkshopId { get; set; }

    public int DepartmentId { get; set; }

    public int Version { get; set; }

    public int FormCount { get; set; }

    public long? MailLogId { get; set; }

    // JSON of the Excel rows sent, so the next version of the date can list what changed.
    public string? Snapshot { get; set; }

    public DateTime CreatedAt { get; set; }
}
