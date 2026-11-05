namespace Attendance.Domain.Entities;

// General Affairs recipients of one department's office forms at one workshop; no row holds that pair's mail back.
public class GeneralAffairsRecipient
{
    public int Id { get; set; }

    public int WorkshopId { get; set; }

    public int DepartmentId { get; set; }

    // "a@x; b@y"
    public string Emails { get; set; } = null!;
}
